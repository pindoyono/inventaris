import "server-only";
import { and, eq, inArray, max } from "drizzle-orm";
import type { Tx } from "@/db";
import { assetEvents, assets, bmdCodes, localBmdCodes, qrTokens, rooms, schoolSettings } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { todayWita } from "@/lib/server/ledger";
import { isIntraFor, kibOfCode } from "@/lib/assets-shared";
import { parseDec, toDec } from "@/lib/decimal";
import type { SchoolSession } from "@/lib/tenant";

type Condition = (typeof assets.$inferSelect)["condition"];

/** Kode barang aset yang sah: tingkat 7 golongan A–F/ATB yang bisa dipilih, atau kode lokal di bawahnya */
export async function resolveAssetCode(tx: Tx, code: string) {
  const [off] = await tx.select().from(bmdCodes).where(eq(bmdCodes.code, code));
  if (off) {
    if (!off.selectable || !off.class || off.class === "PERSEDIAAN") throw new UserError("Pilih kode barang aset tetap (golongan A–F)");
    return { name: off.name, kib: off.class };
  }
  const [loc] = await tx.select().from(localBmdCodes).where(eq(localBmdCodes.code, code));
  const kib = kibOfCode(code);
  if (loc && kib) return { name: loc.name, kib };
  throw new UserError("Kode barang tidak ditemukan");
}

export type NewAssetsInput = {
  bmdCode: string;
  name: string;
  brand: string | null;
  attrs: Record<string, string>;
  acqDate: string;
  acqPrice: string; // desimal "2500000.00"
  acquisition: string;
  fundingSourceId: string | null;
  fundingComponentId: string | null;
  vendorId: string | null;
  refNumber: string | null;
  roomId: string | null;
  unitId: string | null;
  condition: Condition;
  note: string | null;
  qty: number;
  /** Nomor register pertama (untuk menyamakan dengan register Dinas); kosong = lanjut dari terakhir */
  startRegNo: number | null;
};

/** Catat sejumlah unit aset sekaligus; tiap unit mendapat nomor register berurutan. */
export async function createAssets(tx: Tx, s: SchoolSession, input: NewAssetsInput) {
  if (input.qty < 1 || input.qty > 500) throw new UserError("Jumlah unit 1–500 per pencatatan");
  if (input.acqDate > todayWita()) throw new UserError("Tanggal perolehan tidak boleh di masa depan");
  const { kib } = await resolveAssetCode(tx, input.bmdCode);
  const [st] = await tx.select({ cap: schoolSettings.capitalization }).from(schoolSettings);
  const price = parseDec(input.acqPrice);
  if (price < 0n) throw new UserError("Harga tidak boleh negatif");
  const isIntra = isIntraFor(kib, price, st.cap);

  let first = input.startRegNo;
  if (!first) {
    const [r] = await tx.select({ m: max(assets.regNo) }).from(assets).where(eq(assets.bmdCode, input.bmdCode));
    first = (r?.m ?? 0) + 1;
  }
  const regNos = Array.from({ length: input.qty }, (_, i) => first! + i);
  if (regNos.at(-1)! > 999999) throw new UserError("Nomor register melebihi 999999");
  const taken = await tx
    .select({ regNo: assets.regNo })
    .from(assets)
    .where(and(eq(assets.bmdCode, input.bmdCode), inArray(assets.regNo, regNos)));
  if (taken.length)
    throw new UserError(`Nomor register sudah dipakai untuk kode ini: ${taken.map((t) => String(t.regNo).padStart(6, "0")).slice(0, 5).join(", ")}`);

  const batchId = crypto.randomUUID();
  const { qty: _q, startRegNo: _s, ...common } = input;
  const rows = await tx
    .insert(assets)
    .values(regNos.map((regNo) => ({ ...common, schoolId: s.schoolId, kib, regNo, isIntra, acqPrice: toDec(price), batchId, createdBy: s.userId })))
    .returning({ id: assets.id, regNo: assets.regNo, qrToken: assets.qrToken });

  await tx.insert(qrTokens).values(rows.map((r) => ({ token: r.qrToken, schoolId: s.schoolId, kind: "ASET", refId: r.id })));
  await tx.insert(assetEvents).values(
    rows.map((r) => ({
      schoolId: s.schoolId,
      assetId: r.id,
      kind: "DICATAT" as const,
      date: input.acqDate,
      toRoomId: input.roomId,
      toCondition: input.condition,
      toStatus: "DIGUNAKAN" as const,
      note: isIntra ? "Intrakomptabel" : "Ekstrakomptabel (di bawah batas kapitalisasi)",
      createdBy: s.userId,
      createdByName: s.userName,
    })),
  );
  return { batchId, ids: rows.map((r) => r.id), isIntra, kib, first, last: regNos.at(-1)! };
}

export async function lockAssets(tx: Tx, ids: string[], forMove = false) {
  if (!ids.length || ids.length > 1000) throw new UserError("Pilih 1–1000 aset");
  const rows = await tx.select().from(assets).where(inArray(assets.id, ids)).for("update");
  if (rows.length !== new Set(ids).size) throw new UserError("Sebagian aset tidak ditemukan");
  const gone = rows.find((r) => r.status === "DIHAPUS");
  if (gone) throw new UserError(`Aset ${gone.name} sudah dihapus dari daftar barang`);
  const locked = forMove && rows.find((r) => r.status === "DIUSULKAN_HAPUS");
  if (locked) throw new UserError(`Aset ${locked.name} sedang diusulkan penghapusan dan tidak bisa dipindah`);
  return rows;
}

/** Pindah ruangan (KIR berubah). */
export async function moveAssets(tx: Tx, s: SchoolSession, ids: string[], toRoomId: string, date: string, note: string | null) {
  if (date > todayWita()) throw new UserError("Tanggal tidak boleh di masa depan");
  const [room] = await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, toRoomId));
  if (!room) throw new UserError("Ruangan tidak ditemukan");
  const rows = (await lockAssets(tx, ids, true)).filter((r) => r.roomId !== toRoomId);
  if (!rows.length) throw new UserError("Semua aset terpilih sudah berada di ruangan tersebut");
  await tx.update(assets).set({ roomId: toRoomId, updatedAt: new Date() }).where(inArray(assets.id, rows.map((r) => r.id)));
  await tx.insert(assetEvents).values(
    rows.map((r) => ({ schoolId: s.schoolId, assetId: r.id, kind: "PINDAH" as const, date, fromRoomId: r.roomId, toRoomId, note, createdBy: s.userId, createdByName: s.userName })),
  );
  return rows.length;
}

/** Ubah kondisi (hasil pemeriksaan/inventarisasi). */
export async function setCondition(tx: Tx, s: SchoolSession, ids: string[], condition: Condition, date: string, note: string | null) {
  if (date > todayWita()) throw new UserError("Tanggal tidak boleh di masa depan");
  const rows = (await lockAssets(tx, ids)).filter((r) => r.condition !== condition);
  if (!rows.length) throw new UserError("Kondisi aset terpilih sudah sama");
  await tx.update(assets).set({ condition, updatedAt: new Date() }).where(inArray(assets.id, rows.map((r) => r.id)));
  await tx.insert(assetEvents).values(
    rows.map((r) => ({ schoolId: s.schoolId, assetId: r.id, kind: "KONDISI" as const, date, fromCondition: r.condition, toCondition: condition, note, createdBy: s.userId, createdByName: s.userName })),
  );
  return rows.length;
}
