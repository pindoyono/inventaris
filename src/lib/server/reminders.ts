import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { loans, schools, stockBalances, supplyItems } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { notifyUsers, userIdsWithRoles } from "@/lib/server/inbox";
import { fmtDue } from "@/lib/server/loans";
import { fmtNum } from "@/lib/decimal";

/**
 * Pengingat harian per sekolah aktif: peminjaman jatuh tempo ≤ 24 jam / terlambat (ke peminjam berakun
 * & ringkasan ke Petugas) dan barang persediaan di bawah stok minimum (ke Petugas).
 * `reminded_at` mencegah pengingat ganda di hari yang sama.
 */
export async function runDailyReminders(now = new Date()) {
  const active = await db.select({ id: schools.id }).from(schools).where(eq(schools.status, "ACTIVE"));
  const startOfDay = new Date(now.getTime() - 20 * 3600_000);
  let total = 0;
  for (const { id: schoolId } of active) {
    total += await withSchool(schoolId, async (tx) => {
      let n = 0;
      const soon = new Date(now.getTime() + 24 * 3600_000);
      const due = await tx
        .select()
        .from(loans)
        .where(and(eq(loans.status, "DIPINJAM"), lt(loans.dueAt, soon), or(isNull(loans.remindedAt), lt(loans.remindedAt, startOfDay))));
      for (const l of due) {
        const late = l.dueAt < now;
        if (l.borrowerUserId)
          n += await notifyUsers(tx, schoolId, [l.borrowerUserId], {
            title: late ? `Peminjaman ${l.number} terlambat dikembalikan` : `Peminjaman ${l.number} jatuh tempo`,
            body: `Batas pengembalian: ${fmtDue(l.dueAt)}. Kembalikan barang ke Petugas Barang.`,
            link: `/peminjaman/${l.id}`,
          });
        await tx.update(loans).set({ remindedAt: now }).where(eq(loans.id, l.id));
      }
      const lateLoans = due.filter((l) => l.dueAt < now);
      const petugas = await userIdsWithRoles(tx, ["PETUGAS"]);
      if (lateLoans.length)
        n += await notifyUsers(tx, schoolId, petugas, {
          title: `${lateLoans.length} peminjaman terlambat dikembalikan`,
          body: lateLoans.map((l) => `• ${l.number} — ${l.borrowerName} (batas ${fmtDue(l.dueAt)})`).join("\n"),
          link: "/peminjaman?tab=terlambat",
        });

      const low = await tx
        .select({ name: supplyItems.name, min: supplyItems.minStock, qty: sql<string>`coalesce(sum(${stockBalances.qty}), 0)` })
        .from(supplyItems)
        .leftJoin(stockBalances, eq(stockBalances.itemId, supplyItems.id))
        .where(and(eq(supplyItems.isActive, true), sql`${supplyItems.minStock} > 0`))
        .groupBy(supplyItems.id)
        .having(sql`coalesce(sum(${stockBalances.qty}), 0) <= ${supplyItems.minStock}`);
      if (low.length)
        n += await notifyUsers(tx, schoolId, petugas, {
          title: `${low.length} barang persediaan di bawah stok minimum`,
          body: low.slice(0, 30).map((x) => `• ${x.name}: ${fmtNum(x.qty)} (min. ${fmtNum(x.min)})`).join("\n"),
          link: "/persediaan?f=menipis",
        });
      return n;
    });
  }
  return total;
}
