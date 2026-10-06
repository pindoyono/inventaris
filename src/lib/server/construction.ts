import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { assets, constructions } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { todayWita } from "@/lib/server/ledger";
import { createAssets, moveAssets } from "@/lib/server/assets";
import { addAssetValue, reclassifyAsset } from "@/lib/server/asset-changes";
import { parseDec, toDec } from "@/lib/decimal";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";
import { isConstructionCode } from "@/lib/construction-shared";

type Kind = "KDP" | "ATR";

function mustManage(s: SchoolSession) {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya Petugas Barang");
}

export type NewConstruction = {
  kind: Kind;
  bmdCode: string;
  name: string;
  attrs: Record<string, string>;
  ownerName: string | null;
  contractNo: string | null;
  contractDate: string | null;
  vendorId: string | null;
  contractValue: string;
  startDate: string;
  targetDate: string | null;
  fundingSourceId: string | null;
  fundingComponentId: string | null;
  note: string | null;
};

/** Catat KDP (KIB F) / ATR (KIB E 1.3.5.07): aset bernilai awal 0, bertambah dari pembayaran */
export async function createConstruction(tx: Tx, s: SchoolSession, c: NewConstruction) {
  mustManage(s);
  if (!isConstructionCode(c.kind, c.bmdCode)) throw new UserError(c.kind === "KDP" ? "Pilih kode Konstruksi Dalam Pengerjaan (1.3.6…)" : "Pilih kode Aset Tetap Dalam Renovasi (1.3.5.07…)");
  if (c.kind === "ATR" && !c.ownerName?.trim()) throw new UserError("Isi pemilik/pengguna aset yang direnovasi");
  if (c.startDate > todayWita()) throw new UserError("Tanggal mulai tidak boleh di masa depan");
  if (c.targetDate && c.targetDate < c.startDate) throw new UserError("Target selesai sebelum tanggal mulai");
  const r = await createAssets(tx, s, {
    bmdCode: c.bmdCode, name: c.name, brand: null, attrs: c.attrs, acqDate: c.startDate, acqPrice: "0", acquisition: "PEMBELIAN",
    fundingSourceId: c.fundingSourceId, fundingComponentId: c.fundingComponentId, vendorId: c.vendorId, refNumber: c.contractNo,
    roomId: null, unitId: null, condition: "BAIK", note: c.note, qty: 1, startRegNo: null,
  });
  // KDP & ATR selalu dikapitalisasi
  if (!r.isIntra) await tx.update(assets).set({ isIntra: true }).where(eq(assets.id, r.ids[0]));
  const [row] = await tx
    .insert(constructions)
    .values({
      schoolId: s.schoolId, kind: c.kind, assetId: r.ids[0], ownerName: c.kind === "ATR" ? c.ownerName!.trim() : null, contractNo: c.contractNo,
      contractDate: c.contractDate, vendorId: c.vendorId, contractValue: c.contractValue, startDate: c.startDate, targetDate: c.targetDate, note: c.note, createdBy: s.userId,
    })
    .returning({ id: constructions.id });
  return { id: row.id, assetId: r.ids[0] };
}

async function lockC(tx: Tx, id: string) {
  const [c] = await tx.select().from(constructions).where(eq(constructions.id, id)).for("update");
  if (!c) throw new UserError("Data konstruksi tidak ditemukan");
  return c;
}

/** Pembayaran termin/biaya lain → menambah nilai KDP/ATR */
export async function addConstructionPayment(tx: Tx, s: SchoolSession, id: string, p: { date: string; amount: string; docNo: string | null; note: string | null }) {
  mustManage(s);
  const c = await lockC(tx, id);
  if (c.status === "DIHENTIKAN") throw new UserError("Pekerjaan sedang dihentikan");
  if (p.date < c.startDate || p.date > todayWita()) throw new UserError("Tanggal pembayaran tidak valid");
  const amt = parseDec(p.amount);
  if (amt <= 0n) throw new UserError("Nilai pembayaran harus lebih dari 0");
  const [a] = await tx.select().from(assets).where(eq(assets.id, c.assetId)).for("update");
  await addAssetValue(tx, s, a, "PEMBAYARAN_KDP", amt, p.date, { docNo: p.docNo, note: p.note ?? (c.kind === "KDP" ? "Pembayaran KDP" : "Pembayaran renovasi") });
  await tx.update(constructions).set({ updatedAt: new Date() }).where(eq(constructions.id, id));
  return toDec(parseDec(a.acqPrice));
}

export async function setConstructionProgress(tx: Tx, s: SchoolSession, id: string, progress: number, targetDate: string | null) {
  mustManage(s);
  const c = await lockC(tx, id);
  if (c.status !== "BERJALAN") throw new UserError("Pekerjaan tidak sedang berjalan");
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new UserError("Progres 0–100%");
  if (targetDate && targetDate < c.startDate) throw new UserError("Target selesai sebelum tanggal mulai");
  await tx.update(constructions).set({ progress, targetDate: targetDate ?? c.targetDate, updatedAt: new Date() }).where(eq(constructions.id, id));
}

export async function stopConstruction(tx: Tx, s: SchoolSession, id: string, stop: boolean, reason: string | null) {
  mustManage(s);
  const c = await lockC(tx, id);
  if (stop) {
    if (c.status !== "BERJALAN") throw new UserError("Pekerjaan tidak sedang berjalan");
    if (!reason || reason.trim().length < 5) throw new UserError("Isi alasan penghentian");
    await tx.update(constructions).set({ status: "DIHENTIKAN", stopReason: reason.trim(), updatedAt: new Date() }).where(eq(constructions.id, id));
  } else {
    if (c.status !== "DIHENTIKAN") throw new UserError("Pekerjaan tidak sedang dihentikan");
    await tx.update(constructions).set({ status: "BERJALAN", stopReason: null, updatedAt: new Date() }).where(eq(constructions.id, id));
  }
}

export type FinishInput = { date: string; bastNo: string; bmdCode: string | null; name: string | null; roomId: string | null };

/** Selesai: KDP direklasifikasi ke aset definitif (KIB A–E) senilai akumulasi biaya; ATR tetap tercatat di KIB E */
export async function finishConstruction(tx: Tx, s: SchoolSession, id: string, f: FinishInput) {
  mustManage(s);
  const c = await lockC(tx, id);
  if (c.status !== "BERJALAN") throw new UserError("Pekerjaan tidak sedang berjalan");
  if (f.date < c.startDate || f.date > todayWita()) throw new UserError("Tanggal BAST tidak valid");
  if (f.bastNo.trim().length < 3) throw new UserError("Isi nomor BAST/berita acara serah terima");
  const [a] = await tx.select().from(assets).where(eq(assets.id, c.assetId));
  if (parseDec(a.acqPrice) <= 0n) throw new UserError("Belum ada biaya/pembayaran yang dicatat");
  if (c.kind === "KDP") {
    if (!f.bmdCode || f.bmdCode.startsWith("1.3.6.") || f.bmdCode.startsWith("1.3.5.07.")) throw new UserError("Pilih kode barang aset definitif (golongan A–E)");
    await reclassifyAsset(tx, s, {
      assetId: a.id, date: f.date, bmdCode: f.bmdCode, intra: "auto", name: f.name, acqDate: f.date,
      reason: `KDP selesai, diserahterimakan (BAST ${f.bastNo.trim()})`, docNo: f.bastNo.trim(),
    });
    if (f.roomId) await moveAssets(tx, s, [a.id], f.roomId, f.date, "Hasil KDP");
  }
  await tx.update(constructions).set({ status: "SELESAI", progress: 100, finishedDate: f.date, bastNo: f.bastNo.trim(), updatedAt: new Date() }).where(eq(constructions.id, id));
}

export async function setAtrFollowUp(tx: Tx, s: SchoolSession, id: string, v: "PEMINDAHTANGANAN" | "PENGALIHAN_STATUS" | null) {
  mustManage(s);
  const c = await lockC(tx, id);
  if (c.kind !== "ATR") throw new UserError("Hanya untuk aset tetap renovasi");
  await tx.update(constructions).set({ atrFollowUp: v, updatedAt: new Date() }).where(eq(constructions.id, id));
}
