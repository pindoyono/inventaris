import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db";
import { assetEvents, assets, disposalLines, disposals } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, todayWita } from "@/lib/server/ledger";
import { notifyUsers, userIdsWithRoles } from "@/lib/server/inbox";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

export type DisposalReason = (typeof disposalLines.$inferSelect)["reason"];
export const DISPOSAL_REASON_LABEL: Record<DisposalReason, string> = {
  RUSAK_BERAT: "Rusak berat",
  USANG: "Usang/tidak dapat digunakan",
  KECURIAN: "Hilang karena kecurian",
  HILANG: "Hilang/tidak ditemukan",
  TERBAKAR_SUSUT: "Terbakar/susut/kedaluwarsa",
  KAHAR: "Keadaan kahar (bencana)",
  INVENTARISASI: "Tindak lanjut hasil inventarisasi",
};

const petugas = (s: SchoolSession) => hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
async function lockD(tx: Tx, id: string) {
  const [d] = await tx.select().from(disposals).where(eq(disposals.id, id)).for("update");
  if (!d) throw new UserError("Usulan tidak ditemukan");
  return d;
}

export type DisposalLineInput = { assetId: string; reason: DisposalReason; policeLetter?: string | null; note?: string | null };

/** Petugas menyiapkan draf usulan */
export async function saveDisposalDraft(tx: Tx, s: SchoolSession, input: { id?: string; date: string; note: string | null; lines: DisposalLineInput[] }) {
  if (!petugas(s)) throw new UserError("Hanya Petugas Barang yang menyiapkan usulan penghapusan");
  if (!input.lines.length) throw new UserError("Pilih minimal satu barang");
  if (new Set(input.lines.map((l) => l.assetId)).size !== input.lines.length) throw new UserError("Barang tercantum dua kali");
  const rows = await tx.select().from(assets).where(inArray(assets.id, input.lines.map((l) => l.assetId)));
  for (const a of rows) {
    if (["DIHAPUS", "DIUSULKAN_HAPUS"].includes(a.status)) throw new UserError(`${a.name} sudah dihapus/diusulkan`);
    if (a.status === "DIPINJAM") throw new UserError(`${a.name} sedang dipinjam`);
  }
  let id = input.id;
  if (id) {
    const d = await lockD(tx, id);
    if (d.status !== "DRAF") throw new UserError("Usulan yang sudah diajukan tidak bisa diubah");
    await tx.update(disposals).set({ date: input.date, note: input.note, updatedAt: new Date() }).where(eq(disposals.id, id));
    await tx.delete(disposalLines).where(eq(disposalLines.disposalId, id));
  } else {
    [{ id }] = await tx.insert(disposals).values({ schoolId: s.schoolId, date: input.date, note: input.note, createdBy: s.userId }).returning({ id: disposals.id });
  }
  await tx.insert(disposalLines).values(input.lines.map((l) => ({ schoolId: s.schoolId, disposalId: id!, assetId: l.assetId, reason: l.reason, policeLetter: l.policeLetter?.trim() || null, note: l.note?.trim() || null })));
  return id!;
}

const ev = (s: SchoolSession, assetId: string, from: (typeof assets.$inferSelect)["status"], to: (typeof assets.$inferSelect)["status"], note: string) =>
  ({ schoolId: s.schoolId, assetId, kind: "STATUS" as const, date: todayWita(), fromStatus: from, toStatus: to, note, createdBy: s.userId, createdByName: s.userName });

export async function actOnDisposal(
  tx: Tx,
  s: SchoolSession,
  id: string,
  a: { action: "AJUKAN" | "KIRIM" | "SK" | "TOLAK" | "BATAL"; letterNumber?: string; letterDate?: string; skNumber?: string; skDate?: string; skFile?: string | null; approvedLineIds?: string[]; reason?: string },
) {
  const d = await lockD(tx, id);
  const lines = await tx.select().from(disposalLines).where(eq(disposalLines.disposalId, id));
  const now = new Date();
  const restore = async (ls: typeof lines, note: string) => {
    for (const l of ls) {
      const back = l.prevStatus ?? "DIGUNAKAN";
      await tx.update(assets).set({ status: back, updatedAt: now }).where(and(eq(assets.id, l.assetId), eq(assets.status, "DIUSULKAN_HAPUS")));
      await tx.insert(assetEvents).values(ev(s, l.assetId, "DIUSULKAN_HAPUS", back, note));
    }
  };

  switch (a.action) {
    case "AJUKAN": {
      if (!hasAnyRole(s.roles, ["KEPSEK"])) throw new UserError("Usulan diajukan oleh Kepala Sekolah selaku Kuasa Pengguna Barang");
      if (d.status !== "DRAF") throw new UserError("Usulan tidak dalam status draf");
      const missing = lines.find((l) => l.reason === "KECURIAN" && !l.policeLetter);
      if (missing) throw new UserError("Barang hilang karena kecurian wajib dilengkapi nomor surat keterangan kepolisian");
      const rows = await tx.select().from(assets).where(inArray(assets.id, lines.map((l) => l.assetId))).for("update");
      const bad = rows.find((r) => ["DIHAPUS", "DIUSULKAN_HAPUS", "DIPINJAM"].includes(r.status));
      if (bad) throw new UserError(`${bad.name} sedang ${bad.status.toLowerCase().replace("_", " ")}`);
      const number = d.number ?? (await nextDocNumber(tx, s.schoolId, "UPH", Number(todayWita().slice(0, 4))));
      for (const r of rows) {
        await tx.update(disposalLines).set({ prevStatus: r.status }).where(and(eq(disposalLines.disposalId, id), eq(disposalLines.assetId, r.id)));
        await tx.update(assets).set({ status: "DIUSULKAN_HAPUS", updatedAt: now }).where(eq(assets.id, r.id));
        await tx.insert(assetEvents).values(ev(s, r.id, r.status, "DIUSULKAN_HAPUS", `Diusulkan penghapusan ${number}`));
      }
      await tx.update(disposals).set({ status: "DIAJUKAN", number, submittedBy: s.userId, submittedAt: now, lastReason: null, updatedAt: now }).where(eq(disposals.id, id));
      await notifyUsers(tx, s.schoolId, await userIdsWithRoles(tx, ["PETUGAS"]), { title: `Usulan penghapusan ${number} diajukan`, body: "Kirimkan surat usulan ke Dinas/BPKAD lalu catat nomor suratnya.", link: `/audit/penghapusan/${id}` }, s.userId);
      return number;
    }
    case "KIRIM":
      if (!petugas(s) && !hasAnyRole(s.roles, ["KEPSEK"])) throw new UserError("Tidak berwenang");
      if (d.status !== "DIAJUKAN") throw new UserError("Usulan belum diajukan Kepala Sekolah");
      if (!a.letterNumber?.trim() || !a.letterDate) throw new UserError("Isi nomor dan tanggal surat usulan");
      await tx.update(disposals).set({ status: "DIKIRIM", letterNumber: a.letterNumber.trim(), letterDate: a.letterDate, sentAt: now, updatedAt: now }).where(eq(disposals.id, id));
      return d.number;
    case "SK": {
      if (!petugas(s) && !hasAnyRole(s.roles, ["KEPSEK"])) throw new UserError("Tidak berwenang");
      if (d.status !== "DIKIRIM") throw new UserError("Catat SK setelah usulan dikirim");
      if (!a.skNumber?.trim() || !a.skDate) throw new UserError("Isi nomor dan tanggal SK kepala daerah");
      const ok = new Set(a.approvedLineIds ?? lines.map((l) => l.id));
      if (!lines.some((l) => ok.has(l.id))) throw new UserError("Pilih barang yang disetujui SK (atau gunakan Tolak bila tidak ada)");
      for (const l of lines.filter((x) => ok.has(x.id))) {
        await tx.update(assets).set({ status: "DIHAPUS", updatedAt: now }).where(eq(assets.id, l.assetId));
        await tx.insert(assetEvents).values(ev(s, l.assetId, "DIUSULKAN_HAPUS", "DIHAPUS", `Dihapus berdasarkan SK ${a.skNumber.trim()} tanggal ${a.skDate}`));
      }
      await restore(lines.filter((x) => !ok.has(x.id)), `Tidak termasuk SK ${a.skNumber.trim()}`);
      await tx.update(disposals).set({ status: "SELESAI", skNumber: a.skNumber.trim(), skDate: a.skDate, skFile: a.skFile ?? null, closedAt: now, updatedAt: now }).where(eq(disposals.id, id));
      return d.number;
    }
    case "TOLAK":
      if (d.status !== "DIKIRIM" && d.status !== "DIAJUKAN") throw new UserError("Usulan tidak bisa ditolak pada tahap ini");
      if ((a.reason ?? "").trim().length < 5) throw new UserError("Tulis alasan/keterangan penolakan");
      await restore(lines, `Usulan ${d.number} ditolak`);
      await tx.update(disposals).set({ status: "DITOLAK", lastReason: a.reason!.trim(), closedAt: now, updatedAt: now }).where(eq(disposals.id, id));
      return d.number;
    case "BATAL":
      if (d.status !== "DRAF") throw new UserError("Hanya draf yang bisa dibatalkan");
      await tx.update(disposals).set({ status: "DIBATALKAN", closedAt: now, updatedAt: now }).where(eq(disposals.id, id));
      return null;
  }
}


