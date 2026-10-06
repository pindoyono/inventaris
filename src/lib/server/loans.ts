import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Tx } from "@/db";
import { assetEvents, assets, loanLines, loans, users } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, todayWita } from "@/lib/server/ledger";
import { notifyUsers, userIdsWithRoles } from "@/lib/server/inbox";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

type Condition = (typeof assets.$inferSelect)["condition"];
const isPetugas = (s: SchoolSession) => hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);

export type LoanInput = {
  borrowerUserId: string | null;
  borrowerName: string;
  borrowerInfo: string | null;
  purpose: string | null;
  dueAt: Date;
  assetIds: string[];
};

async function lockAssetsForLoan(tx: Tx, ids: string[]) {
  const rows = await tx.select().from(assets).where(inArray(assets.id, ids)).orderBy(asc(assets.id)).for("update");
  if (rows.length !== new Set(ids).size) throw new UserError("Sebagian barang tidak ditemukan");
  const busy = rows.find((a) => a.status !== "DIGUNAKAN");
  if (busy) throw new UserError(`${busy.name} (reg. ${String(busy.regNo).padStart(6, "0")}) sedang tidak tersedia untuk dipinjam`);
  return rows;
}

async function handOver(tx: Tx, s: SchoolSession, loanId: string, number: string, rows: (typeof assets.$inferSelect)[], conditions: Record<string, Condition>) {
  const now = new Date();
  for (const a of rows) {
    await tx
      .update(loanLines)
      .set({ outAt: now, conditionOut: conditions[a.id] ?? a.condition })
      .where(and(eq(loanLines.loanId, loanId), eq(loanLines.assetId, a.id)));
  }
  await tx.update(assets).set({ status: "DIPINJAM", updatedAt: now }).where(inArray(assets.id, rows.map((a) => a.id)));
  await tx.insert(assetEvents).values(
    rows.map((a) => ({
      schoolId: s.schoolId, assetId: a.id, kind: "STATUS" as const, date: todayWita(), fromStatus: "DIGUNAKAN" as const, toStatus: "DIPINJAM" as const,
      note: `Dipinjam (${number})`, createdBy: s.userId, createdByName: s.userName,
    })),
  );
}

/**
 * Petugas mencatat peminjaman langsung (barang diserahkan sekarang), atau peminjam berakun
 * mengajukan dulu (DIAJUKAN) untuk diserahkan Petugas.
 */
export async function createLoan(tx: Tx, s: SchoolSession, input: LoanInput, handNow: boolean, conditions: Record<string, Condition> = {}) {
  if (!input.assetIds.length) throw new UserError("Pilih minimal satu barang");
  if (input.assetIds.length > 50) throw new UserError("Maksimal 50 barang per peminjaman");
  if (input.dueAt.getTime() <= Date.now()) throw new UserError("Batas pengembalian harus setelah sekarang");
  if (handNow && !isPetugas(s)) throw new UserError("Hanya Petugas Barang yang bisa menyerahkan barang");
  let borrower = { id: input.borrowerUserId, name: input.borrowerName.trim(), info: input.borrowerInfo };
  if (!isPetugas(s)) borrower = { id: s.userId, name: s.userName, info: input.borrowerInfo }; // peminjam mengajukan untuk dirinya sendiri
  if (borrower.id) {
    const [u] = await tx.select({ name: users.name, nip: users.nip }).from(users).where(and(eq(users.id, borrower.id), eq(users.isActive, true)));
    if (!u) throw new UserError("Peminjam tidak ditemukan");
    borrower.name = u.name;
    borrower.info ??= u.nip ? `NIP ${u.nip}` : null;
  }
  if (borrower.name.length < 3) throw new UserError("Isi nama peminjam");

  const rows = await lockAssetsForLoan(tx, input.assetIds);
  const number = await nextDocNumber(tx, s.schoolId, "PJ", Number(todayWita().slice(0, 4)));
  const [loan] = await tx
    .insert(loans)
    .values({
      schoolId: s.schoolId, number, status: handNow ? "DIPINJAM" : "DIAJUKAN", borrowerUserId: borrower.id, borrowerName: borrower.name,
      borrowerInfo: borrower.info, purpose: input.purpose, dueAt: input.dueAt, createdBy: s.userId,
      ...(handNow ? { loanedAt: new Date(), handedBy: s.userId } : {}),
    })
    .returning({ id: loans.id });
  await tx.insert(loanLines).values(rows.map((a) => ({ schoolId: s.schoolId, loanId: loan.id, assetId: a.id })));
  if (handNow) {
    await handOver(tx, s, loan.id, number, rows, conditions);
    if (borrower.id) await notifyUsers(tx, s.schoolId, [borrower.id], { title: `Peminjaman ${number} tercatat`, body: `Kembalikan paling lambat ${fmtDue(input.dueAt)}.`, link: `/peminjaman/${loan.id}` }, s.userId);
  } else {
    await notifyUsers(tx, s.schoolId, await userIdsWithRoles(tx, ["PETUGAS"]), { title: `Pengajuan peminjaman ${number}`, body: `${borrower.name}: ${rows.length} barang.`, link: `/peminjaman/${loan.id}` }, s.userId);
  }
  return { id: loan.id, number };
}

export const fmtDue = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Makassar" }).format(d) + " WITA";

async function lockLoan(tx: Tx, id: string) {
  const [l] = await tx.select().from(loans).where(eq(loans.id, id)).for("update");
  if (!l) throw new UserError("Peminjaman tidak ditemukan");
  return l;
}

/** Petugas menyerahkan barang untuk pengajuan */
export async function approveLoan(tx: Tx, s: SchoolSession, id: string, conditions: Record<string, Condition> = {}) {
  if (!isPetugas(s)) throw new UserError("Hanya Petugas Barang yang bisa menyerahkan barang");
  const l = await lockLoan(tx, id);
  if (l.status !== "DIAJUKAN") throw new UserError("Peminjaman tidak dalam status diajukan");
  if (l.dueAt.getTime() <= Date.now()) throw new UserError("Batas pengembalian sudah lewat; ubah atau tolak pengajuan");
  const lines = await tx.select().from(loanLines).where(eq(loanLines.loanId, id));
  const rows = await lockAssetsForLoan(tx, lines.map((x) => x.assetId));
  await handOver(tx, s, id, l.number!, rows, conditions);
  await tx.update(loans).set({ status: "DIPINJAM", loanedAt: new Date(), handedBy: s.userId, updatedAt: new Date() }).where(eq(loans.id, id));
  if (l.borrowerUserId) await notifyUsers(tx, s.schoolId, [l.borrowerUserId], { title: `Peminjaman ${l.number} disetujui`, body: `Barang diserahkan. Kembalikan paling lambat ${fmtDue(l.dueAt)}.`, link: `/peminjaman/${id}` }, s.userId);
}

export async function rejectOrCancelLoan(tx: Tx, s: SchoolSession, id: string, reason: string) {
  const l = await lockLoan(tx, id);
  if (l.status !== "DIAJUKAN") throw new UserError("Hanya pengajuan yang bisa ditolak/dibatalkan");
  const own = l.borrowerUserId === s.userId || l.createdBy === s.userId;
  if (!isPetugas(s) && !own) throw new UserError("Tidak berwenang");
  const status = isPetugas(s) && !own ? "DITOLAK" : "DIBATALKAN";
  if (status === "DITOLAK" && reason.trim().length < 5) throw new UserError("Tulis alasan penolakan (minimal 5 karakter)");
  await tx.update(loans).set({ status, lastReason: reason || null, closedAt: new Date(), updatedAt: new Date() }).where(eq(loans.id, id));
  if (status === "DITOLAK" && l.borrowerUserId)
    await notifyUsers(tx, s.schoolId, [l.borrowerUserId], { title: `Peminjaman ${l.number} ditolak`, body: `Alasan: ${reason}`, link: `/peminjaman/${id}` }, s.userId);
  return status;
}

/** Terima kembali sebagian/semua barang; kondisi kembali memperbarui kondisi aset */
export async function returnLoanItems(tx: Tx, s: SchoolSession, id: string, items: { lineId: string; condition: Condition; note: string | null }[]) {
  if (!isPetugas(s)) throw new UserError("Hanya Petugas Barang yang bisa menerima pengembalian");
  if (!items.length) throw new UserError("Pilih barang yang dikembalikan");
  if (new Set(items.map((i) => i.lineId)).size !== items.length) throw new UserError("Barang tercantum dua kali");
  const l = await lockLoan(tx, id);
  if (l.status !== "DIPINJAM") throw new UserError("Peminjaman tidak sedang berjalan");
  const lines = await tx.select().from(loanLines).where(and(eq(loanLines.loanId, id), isNull(loanLines.returnedAt)));
  const now = new Date();
  const date = todayWita();
  for (const it of items) {
    const line = lines.find((x) => x.id === it.lineId);
    if (!line) throw new UserError("Barang sudah dikembalikan atau bukan bagian peminjaman ini");
    const [a] = await tx.select().from(assets).where(eq(assets.id, line.assetId)).for("update");
    await tx.update(loanLines).set({ returnedAt: now, conditionIn: it.condition, returnedTo: s.userId, returnNote: it.note }).where(eq(loanLines.id, line.id));
    await tx.update(assets).set({ status: "DIGUNAKAN", condition: it.condition, updatedAt: now }).where(eq(assets.id, a.id));
    await tx.insert(assetEvents).values({
      schoolId: s.schoolId, assetId: a.id, kind: "STATUS", date, fromStatus: "DIPINJAM", toStatus: "DIGUNAKAN",
      note: `Dikembalikan (${l.number})${it.note ? `: ${it.note}` : ""}`, createdBy: s.userId, createdByName: s.userName,
    });
    if (a.condition !== it.condition)
      await tx.insert(assetEvents).values({
        schoolId: s.schoolId, assetId: a.id, kind: "KONDISI", date, fromCondition: a.condition, toCondition: it.condition,
        note: `Saat pengembalian ${l.number}${it.note ? `: ${it.note}` : ""}`, createdBy: s.userId, createdByName: s.userName,
      });
  }
  const left = lines.length - items.length;
  if (left === 0) await tx.update(loans).set({ status: "SELESAI", closedAt: now, updatedAt: now }).where(eq(loans.id, id));
  return { left };
}
