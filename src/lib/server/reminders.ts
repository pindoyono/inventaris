import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { constructions, loans, schools, stockBalances, stockOpnames, supplyItems, utilizations, warehouses } from "@/db/schema";
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
      // Pengingat stock opname semester (Permendagri 47/2021 Ps. 39): 15 & 25 Juni/Desember
      const wita = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(now);
      const [y, mo, d] = wita.split("-").map(Number);
      if ((mo === 6 || mo === 12) && (d === 15 || d === 25)) {
        const semStart = `${y}-${mo === 6 ? "01" : "07"}-01`;
        const pending = await tx
          .selectDistinct({ name: warehouses.name })
          .from(stockBalances)
          .innerJoin(warehouses, eq(warehouses.id, stockBalances.warehouseId))
          .where(
            and(
              sql`${stockBalances.qty} > 0`,
              sql`not exists (select 1 from ${stockOpnames} o where o.warehouse_id = ${stockBalances.warehouseId} and o.status = 'DISETUJUI' and o.date >= ${semStart}::date)`,
            ),
          );
        if (pending.length)
          n += await notifyUsers(tx, schoolId, petugas, {
            title: "Stock opname semester belum dilakukan",
            body: `Gudang: ${pending.map((p) => p.name).join(", ")}. Opname wajib setiap semester (Permendagri 47/2021 Pasal 39).`,
            link: "/audit/opname",
          });
      }
      // KIR perlu diperbarui — diingatkan tiap Senin
      if (new Date(`${wita}T12:00:00+08:00`).getUTCDay() === 1) {
        const { kirStatus } = await import("@/lib/server/kir");
        const need = (await kirStatus(tx, wita)).filter((r) => r.reasons.length);
        if (need.length)
          n += await notifyUsers(tx, schoolId, petugas, {
            title: `${need.length} ruangan perlu KIR baru`,
            body: need.slice(0, 20).map((r) => `• ${r.room}: ${r.reasons.join(", ")}`).join("\n"),
            link: "/laporan/kir/status",
          });
      }
      // Perjanjian pemanfaatan berakhir dalam 30/7 hari atau hari ini
      const dayPlus = (k: number) => {
        const d = new Date(`${wita}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + k);
        return d.toISOString().slice(0, 10);
      };
      const ending = await tx
        .select({ id: utilizations.id, partner: utilizations.partner, endDate: utilizations.endDate })
        .from(utilizations)
        .where(and(eq(utilizations.status, "BERJALAN"), inArray(utilizations.endDate, [dayPlus(30), dayPlus(7), wita])));
      const managers = await userIdsWithRoles(tx, ["ADMIN", "PETUGAS", "KEPSEK"]);
      for (const u of ending)
        n += await notifyUsers(tx, schoolId, managers, {
          title: u.endDate === wita ? `Perjanjian pemanfaatan dengan ${u.partner} berakhir hari ini` : `Perjanjian pemanfaatan dengan ${u.partner} berakhir ${u.endDate}`,
          body: "Tandai selesai atau siapkan perpanjangan (perlu persetujuan Pengelola/Kepala Daerah).",
          link: `/aset/pemanfaatan/${u.id}`,
        });
      // KDP melewati target selesai — diingatkan tiap Senin
      if (new Date(`${wita}T12:00:00+08:00`).getUTCDay() === 1) {
        const late = await tx
          .select({ id: constructions.id })
          .from(constructions)
          .where(and(eq(constructions.status, "BERJALAN"), lt(constructions.targetDate, wita)));
        if (late.length)
          n += await notifyUsers(tx, schoolId, petugas, {
            title: `${late.length} pekerjaan KDP/renovasi melewati target selesai`,
            body: "Perbarui progres, catat BAST bila sudah selesai, atau tandai dihentikan.",
            link: "/aset/kdp",
          });
      }
      return n;
    });
  }
  return total;
}
