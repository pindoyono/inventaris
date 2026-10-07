import "server-only";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { assetEvents, assets, schools, transfers, type TransferItem } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, todayWita } from "@/lib/server/ledger";
import { createAssets, resolveAssetCode } from "@/lib/server/assets";
import { INTERNAL_OUT_NOTE } from "@/lib/server/bmd-ledger";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

/**
 * Pengeluaran internal Pengguna Barang (Permendagri 47/2021 Ps. 6 huruf d): penyerahan aset ke Kuasa Pengguna Barang
 * lain di bawah Pengguna Barang yang sama (mis. sekolah lain di Dinas yang sama), dengan persetujuan Pengguna Barang.
 * Penerima yang memakai aplikasi ini mencatat penerimaan internal dari daftar "masuk".
 */

const manage = (s: SchoolSession) => {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya Petugas Barang");
};

/** Sekolah aktif di bawah Pengguna Barang yang sama (kepemilikan & wilayah sama) */
export async function transferDestinations(schoolId: string) {
  const [me] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!me) return [];
  return db
    .select({ id: schools.id, npsn: schools.npsn, name: schools.name })
    .from(schools)
    .where(
      and(
        eq(schools.status, "ACTIVE"),
        ne(schools.id, schoolId),
        eq(schools.ownershipCode, me.ownershipCode),
        eq(schools.provinceCode, me.provinceCode),
        me.ownershipCode === "12" ? eq(schools.regencyCode, me.regencyCode) : undefined,
      ),
    )
    .orderBy(asc(schools.name));
}

export type NewTransfer = {
  toSchoolId: string | null; toName: string | null; date: string; reason: string; approvalNo: string | null; approvalDate: string | null;
  assetIds: string[]; note: string | null;
};

export async function createTransfer(tx: Tx, s: SchoolSession, t: NewTransfer) {
  manage(s);
  if (t.date > todayWita()) throw new UserError("Tanggal tidak boleh di masa depan");
  if (t.reason.trim().length < 5) throw new UserError("Isi alasan penyerahan");
  if (!t.assetIds.length || t.assetIds.length > 500) throw new UserError("Pilih 1–500 barang");
  let toName = t.toName?.trim() ?? "";
  if (t.toSchoolId) {
    const dest = (await transferDestinations(s.schoolId)).find((d) => d.id === t.toSchoolId);
    if (!dest) throw new UserError("Sekolah penerima tidak tersedia (harus aktif & di bawah Pengguna Barang yang sama)");
    toName = dest.name;
  } else if (toName.length < 3) throw new UserError("Isi nama penerima");
  const rows = await tx.select().from(assets).where(inArray(assets.id, t.assetIds)).for("update");
  if (rows.length !== new Set(t.assetIds).size) throw new UserError("Sebagian barang tidak ditemukan");
  const bad = rows.find((a) => a.status !== "DIGUNAKAN" && a.status !== "DALAM_PEMELIHARAAN");
  if (bad) throw new UserError(`${bad.name} berstatus ${bad.status.toLowerCase().replaceAll("_", " ")}`);
  const wip = rows.find((a) => a.kib === "F");
  if (wip) throw new UserError(`${wip.name} masih KDP`);
  const items: TransferItem[] = rows.map((a) => ({
    assetId: a.id, bmdCode: a.bmdCode, kib: a.kib, regNo: a.regNo, name: a.name, brand: a.brand, attrs: a.attrs, acqDate: a.acqDate,
    acqPrice: a.acqPrice, acquisition: a.acquisition, isIntra: a.isIntra, condition: a.condition,
  }));
  const [row] = await tx
    .insert(transfers)
    .values({ fromSchoolId: s.schoolId, toSchoolId: t.toSchoolId, toName, date: t.date, reason: t.reason.trim(), approvalNo: t.approvalNo, approvalDate: t.approvalDate, items, note: t.note, createdBy: s.userId })
    .returning({ id: transfers.id });
  return row.id;
}

async function lockT(tx: Tx, id: string) {
  const [t] = await tx.select().from(transfers).where(eq(transfers.id, id)).for("update");
  if (!t) throw new UserError("Data pengalihan tidak ditemukan");
  return t;
}

/** Pengirim menyerahkan barang (BAST): barang keluar dari daftar barang sekolah pengirim */
export async function handOverTransfer(tx: Tx, s: SchoolSession, id: string, h: { bastNo: string; bastDate: string; approvalNo?: string | null; approvalDate?: string | null }) {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK"])) throw new UserError("Tidak berwenang");
  const t = await lockT(tx, id);
  if (t.fromSchoolId !== s.schoolId || t.status !== "DRAF") throw new UserError("Pengalihan tidak dalam status draf");
  const approvalNo = h.approvalNo?.trim() || t.approvalNo;
  if (!approvalNo) throw new UserError("Isi nomor surat persetujuan Pengguna Barang (Dinas)");
  if (h.bastNo.trim().length < 3) throw new UserError("Isi nomor BAST");
  if (h.bastDate > todayWita() || h.bastDate < t.date) throw new UserError("Tanggal BAST tidak valid");
  const rows = await tx.select().from(assets).where(inArray(assets.id, t.items.map((i) => i.assetId))).for("update");
  const bad = rows.find((a) => a.status !== "DIGUNAKAN" && a.status !== "DALAM_PEMELIHARAAN");
  if (bad) throw new UserError(`${bad.name} berstatus ${bad.status.toLowerCase().replaceAll("_", " ")} — keluarkan dari daftar dulu`);
  const number = await nextDocNumber(tx, s.schoolId, "PI", Number(h.bastDate.slice(0, 4)));
  const now = new Date();
  await tx.update(assets).set({ status: "DIHAPUS", updatedAt: now }).where(inArray(assets.id, rows.map((a) => a.id)));
  await tx.insert(assetEvents).values(
    rows.map((a) => ({
      schoolId: s.schoolId, assetId: a.id, kind: "STATUS" as const, date: h.bastDate, fromStatus: a.status, toStatus: "DIHAPUS" as const,
      note: `${INTERNAL_OUT_NOTE}: diserahkan ke ${t.toName} (BAST ${h.bastNo.trim()})`, createdBy: s.userId, createdByName: s.userName,
    })),
  );
  await tx
    .update(transfers)
    .set({ status: "DISERAHKAN", number, bastNo: h.bastNo.trim(), bastDate: h.bastDate, approvalNo, approvalDate: h.approvalDate || t.approvalDate, handedBy: s.userId, updatedAt: now })
    .where(eq(transfers.id, id));
  return { number, toSchoolId: t.toSchoolId };
}

/** Pengirim membatalkan: draf, atau sudah diserahkan tetapi belum/tidak diterima → barang kembali ke daftar */
export async function cancelTransfer(tx: Tx, s: SchoolSession, id: string, reason: string) {
  manage(s);
  const t = await lockT(tx, id);
  if (t.fromSchoolId !== s.schoolId) throw new UserError("Hanya sekolah pengirim");
  if (!["DRAF", "DISERAHKAN", "DITOLAK"].includes(t.status)) throw new UserError("Pengalihan yang sudah diterima tidak bisa dibatalkan");
  if (reason.trim().length < 5) throw new UserError("Isi alasan pembatalan");
  if (t.status !== "DRAF") {
    const ids = t.items.map((i) => i.assetId);
    await tx.update(assets).set({ status: "DIGUNAKAN", updatedAt: new Date() }).where(and(inArray(assets.id, ids), eq(assets.status, "DIHAPUS")));
    await tx.insert(assetEvents).values(
      ids.map((assetId) => ({
        schoolId: s.schoolId, assetId, kind: "STATUS" as const, date: todayWita(), fromStatus: "DIHAPUS" as const, toStatus: "DIGUNAKAN" as const,
        note: `Pembatalan pengeluaran internal ${t.number ?? ""}: ${reason.trim()}`, createdBy: s.userId, createdByName: s.userName,
      })),
    );
  }
  await tx.update(transfers).set({ status: "DIBATALKAN", note: [t.note, `Dibatalkan: ${reason.trim()}`].filter(Boolean).join(" · "), updatedAt: new Date() }).where(eq(transfers.id, id));
}

/** Sekolah penerima mencatat penerimaan internal: barang dicatat sebagai aset baru (nilai & tahun perolehan asal) */
export async function receiveTransfer(tx: Tx, s: SchoolSession, id: string, r: { date: string; roomId: string | null; note: string | null }) {
  manage(s);
  const t = await lockT(tx, id);
  if (t.toSchoolId !== s.schoolId || t.status !== "DISERAHKAN") throw new UserError("Tidak ada penyerahan yang menunggu diterima");
  if (r.date > todayWita() || (t.bastDate && r.date < t.bastDate)) throw new UserError("Tanggal terima tidak valid");
  const [from] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, t.fromSchoolId));
  const items: TransferItem[] = [];
  for (const it of t.items) {
    let code = it.bmdCode;
    try {
      await resolveAssetCode(tx, code);
    } catch {
      code = code.split(".").slice(0, 7).join("."); // kode lokal pengirim → kode resmi induknya
    }
    const res = await createAssets(tx, s, {
      bmdCode: code, name: it.name, brand: it.brand, attrs: it.attrs, acqDate: it.acqDate, acqPrice: it.acqPrice, acquisition: "PENERIMAAN_INTERNAL",
      fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: t.bastNo, roomId: r.roomId, unitId: null, condition: it.condition,
      note: `Diterima dari ${from?.name ?? "sekolah lain"} (BAST ${t.bastNo}; register asal ${it.bmdCode}.${String(it.regNo).padStart(6, "0")})`,
      qty: 1, startRegNo: null, entryDate: r.date,
    });
    // Klasifikasi intra/ekstra mengikuti pencatatan asal
    if (res.isIntra !== it.isIntra) await tx.update(assets).set({ isIntra: it.isIntra }).where(eq(assets.id, res.ids[0]));
    items.push({ ...it, newAssetId: res.ids[0] });
  }
  await tx.update(transfers).set({ status: "DITERIMA", items, receivedBy: s.userId, receivedAt: new Date(), receiveNote: r.note, updatedAt: new Date() }).where(eq(transfers.id, id));
  return { fromSchoolId: t.fromSchoolId, count: items.length };
}

export async function rejectTransfer(tx: Tx, s: SchoolSession, id: string, reason: string) {
  manage(s);
  const t = await lockT(tx, id);
  if (t.toSchoolId !== s.schoolId || t.status !== "DISERAHKAN") throw new UserError("Tidak ada penyerahan yang menunggu diterima");
  if (reason.trim().length < 5) throw new UserError("Isi alasan penolakan");
  await tx.update(transfers).set({ status: "DITOLAK", receiveNote: reason.trim(), updatedAt: new Date() }).where(eq(transfers.id, id));
  return { fromSchoolId: t.fromSchoolId };
}

export const TRANSFER_STATUS_LABEL = { DRAF: "Draf", DISERAHKAN: "Diserahkan", DITERIMA: "Diterima", DITOLAK: "Ditolak penerima", DIBATALKAN: "Dibatalkan" } as const;
