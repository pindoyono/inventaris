import "server-only";
import { and, asc, eq, isNotNull, isNull, max, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { assetChanges, assetEvents, assetInventories, assetInventoryLines, assets, assetValueChanges, schoolSettings } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { todayWita } from "@/lib/server/ledger";
import { resolveAssetCode } from "@/lib/server/assets";
import { isIntraFor } from "@/lib/assets-shared";
import { parseDec, toDec } from "@/lib/decimal";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

type ValueKind = (typeof assetValueChanges.$inferSelect)["kind"];
type Asset = typeof assets.$inferSelect;

function mustManage(s: SchoolSession) {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya Petugas Barang");
}

async function lockOne(tx: Tx, id: string) {
  const [a] = await tx.select().from(assets).where(eq(assets.id, id)).for("update");
  if (!a) throw new UserError("Aset tidak ditemukan");
  if (a.status === "DIHAPUS") throw new UserError("Aset sudah dihapus dari daftar barang");
  return a;
}

/**
 * Tambah/kurangi nilai aset. `assets.acq_price` selalu nilai terkini (termasuk kapitalisasi & pembayaran KDP);
 * riwayatnya di asset_value_changes sehingga nilai pada tanggal lampau bisa direkonstruksi.
 */
export async function addAssetValue(
  tx: Tx, s: SchoolSession, a: Asset, kind: ValueKind, amount: bigint, date: string,
  extra: { maintenanceId?: string | null; docNo?: string | null; note?: string | null } = {},
) {
  if (amount === 0n) return;
  const next = parseDec(a.acqPrice) + amount;
  if (next < 0n) throw new UserError("Nilai aset tidak boleh negatif");
  await tx.update(assets).set({ acqPrice: toDec(next), updatedAt: new Date() }).where(eq(assets.id, a.id));
  await tx.insert(assetValueChanges).values({
    schoolId: s.schoolId, assetId: a.id, kind, date, amount: toDec(amount), maintenanceId: extra.maintenanceId ?? null,
    docNo: extra.docNo ?? null, note: extra.note ?? null, createdBy: s.userId, createdByName: s.userName,
  });
  a.acqPrice = toDec(next);
}

/** Temuan inventarisasi (LHI) yang menunggu tindak lanjut untuk aset ini */
export async function openFindings(tx: Tx, assetId: string) {
  return tx
    .select({ id: assetInventoryLines.id, kind: assetInventoryLines.followUp, note: assetInventoryLines.followUpNote, number: assetInventories.number, date: assetInventories.date })
    .from(assetInventoryLines)
    .innerJoin(assetInventories, eq(assetInventories.id, assetInventoryLines.inventoryId))
    .where(and(eq(assetInventoryLines.assetId, assetId), isNotNull(assetInventoryLines.followUp), isNull(assetInventoryLines.followUpDoneAt), eq(assetInventories.status, "SELESAI")))
    .orderBy(asc(assetInventories.date));
}

async function closeFinding(tx: Tx, assetId: string, lineId: string | null | undefined, kind: "REKLASIFIKASI" | "KOREKSI") {
  if (!lineId) return null;
  const [f] = (await openFindings(tx, assetId)).filter((x) => x.id === lineId);
  if (!f) throw new UserError("Temuan inventarisasi tidak ditemukan atau sudah ditindaklanjuti");
  if (f.kind !== kind) throw new UserError(`Temuan tersebut perlu ${f.kind === "KOREKSI" ? "koreksi" : "reklasifikasi"}`);
  await tx.update(assetInventoryLines).set({ followUpDoneAt: new Date() }).where(eq(assetInventoryLines.id, lineId));
  return lineId;
}

const pick = (a: Asset) => ({ bmdCode: a.bmdCode, kib: a.kib, regNo: a.regNo, name: a.name, isIntra: a.isIntra, acqDate: a.acqDate, acqPrice: a.acqPrice, acquisition: a.acquisition });

export type ReclassInput = {
  assetId: string;
  date: string;
  bmdCode: string;
  /** "auto" = hitung ulang dari batas kapitalisasi */
  intra: "auto" | "intra" | "ekstra";
  name?: string | null;
  acqDate?: string | null;
  reason: string;
  docNo: string | null;
  inventoryLineId?: string | null;
  note?: string;
};

/** Reklasifikasi: pindah kode barang/golongan KIB dan/atau intra↔ekstrakomptabel (nomor register baru bila kode berubah) */
export async function reclassifyAsset(tx: Tx, s: SchoolSession, r: ReclassInput) {
  mustManage(s);
  if (r.date > todayWita()) throw new UserError("Tanggal tidak boleh di masa depan");
  if (r.reason.trim().length < 5) throw new UserError("Isi alasan reklasifikasi");
  const a = await lockOne(tx, r.assetId);
  const { kib } = await resolveAssetCode(tx, r.bmdCode);
  const [st] = await tx.select({ cap: schoolSettings.capitalization }).from(schoolSettings);
  const isIntra = r.intra === "auto" ? isIntraFor(kib, parseDec(a.acqPrice), st.cap) : r.intra === "intra";
  const name = r.name?.trim() || a.name;
  const acqDate = r.acqDate || a.acqDate;
  if (acqDate > todayWita()) throw new UserError("Tanggal perolehan tidak boleh di masa depan");
  let regNo = a.regNo;
  if (r.bmdCode !== a.bmdCode) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`reg:${s.schoolId}:${r.bmdCode}`}))`);
    const [m] = await tx.select({ m: max(assets.regNo) }).from(assets).where(eq(assets.bmdCode, r.bmdCode));
    regNo = (m?.m ?? 0) + 1;
  }
  if (r.bmdCode === a.bmdCode && isIntra === a.isIntra && name === a.name && acqDate === a.acqDate) throw new UserError("Tidak ada perubahan klasifikasi");
  const before = pick(a);
  await tx.update(assets).set({ bmdCode: r.bmdCode, kib, regNo, isIntra, name, acqDate, updatedAt: new Date() }).where(eq(assets.id, a.id));
  const after = { ...before, bmdCode: r.bmdCode, kib, regNo, isIntra, name, acqDate };
  const lineId = await closeFinding(tx, a.id, r.inventoryLineId, "REKLASIFIKASI");
  await tx.insert(assetChanges).values({
    schoolId: s.schoolId, assetId: a.id, kind: "REKLASIFIKASI", date: r.date, before, after, reason: r.reason.trim(), docNo: r.docNo, inventoryLineId: lineId,
    createdBy: s.userId, createdByName: s.userName,
  });
  const desc = [
    r.bmdCode !== a.bmdCode ? `${a.bmdCode}.${String(a.regNo).padStart(6, "0")} → ${r.bmdCode}.${String(regNo).padStart(6, "0")}` : null,
    isIntra !== a.isIntra ? (isIntra ? "menjadi intrakomptabel" : "menjadi ekstrakomptabel") : null,
  ].filter(Boolean).join(", ");
  await tx.insert(assetEvents).values({
    schoolId: s.schoolId, assetId: a.id, kind: "UBAH_DATA", date: r.date, createdBy: s.userId, createdByName: s.userName,
    note: `Reklasifikasi${desc ? `: ${desc}` : ""}${r.note ? ` (${r.note})` : ""}`,
  });
  return { before, after };
}

export type CorrectionInput = {
  assetId: string;
  date: string;
  acqPrice: string | null;
  acqDate: string | null;
  acquisition: string | null;
  reason: string;
  docNo: string | null;
  inventoryLineId?: string | null;
};

/** Koreksi data perolehan (nilai/tanggal/asal) hasil inventarisasi atau temuan pemeriksaan */
export async function correctAsset(tx: Tx, s: SchoolSession, c: CorrectionInput) {
  mustManage(s);
  const today = todayWita();
  if (c.date > today) throw new UserError("Tanggal tidak boleh di masa depan");
  if (c.reason.trim().length < 5) throw new UserError("Isi alasan koreksi");
  const a = await lockOne(tx, c.assetId);
  const before = pick(a);
  const acqDate = c.acqDate || a.acqDate;
  if (acqDate > today) throw new UserError("Tanggal perolehan tidak boleh di masa depan");
  const acquisition = c.acquisition || a.acquisition;
  const delta = c.acqPrice === null ? 0n : parseDec(c.acqPrice) - parseDec(a.acqPrice);
  if (delta === 0n && acqDate === a.acqDate && acquisition === a.acquisition) throw new UserError("Tidak ada data yang dikoreksi");
  if (acqDate !== a.acqDate || acquisition !== a.acquisition)
    await tx.update(assets).set({ acqDate, acquisition, updatedAt: new Date() }).where(eq(assets.id, a.id));
  await addAssetValue(tx, s, a, "KOREKSI", delta, c.date, { docNo: c.docNo, note: c.reason.trim() });
  const after = { ...before, acqDate, acquisition, acqPrice: a.acqPrice };
  const lineId = await closeFinding(tx, a.id, c.inventoryLineId, "KOREKSI");
  await tx.insert(assetChanges).values({
    schoolId: s.schoolId, assetId: a.id, kind: "KOREKSI", date: c.date, before, after, reason: c.reason.trim(), docNo: c.docNo, inventoryLineId: lineId,
    createdBy: s.userId, createdByName: s.userName,
  });
  await tx.insert(assetEvents).values({
    schoolId: s.schoolId, assetId: a.id, kind: "UBAH_DATA", date: c.date, createdBy: s.userId, createdByName: s.userName, note: `Koreksi: ${c.reason.trim()}`,
  });
  return { before, after };
}

/** Riwayat nilai & perubahan klasifikasi untuk halaman aset */
export async function assetHistory(tx: Tx, assetId: string) {
  const values = await tx.select().from(assetValueChanges).where(eq(assetValueChanges.assetId, assetId)).orderBy(asc(assetValueChanges.id));
  const changes = await tx.select().from(assetChanges).where(eq(assetChanges.assetId, assetId)).orderBy(asc(assetChanges.id));
  return { values, changes };
}
