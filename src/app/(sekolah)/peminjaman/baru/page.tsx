import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { schoolSettings, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { LoanForm } from "../loan-form";

export const metadata: Metadata = { title: "Peminjaman Baru" };

export default async function PeminjamanBaruPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PEMINJAM"]);
  const canLend = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const { list, days } = await withSchool(s.schoolId, async (tx) => ({
    list: canLend ? await tx.select({ id: users.id, name: users.name, info: users.nip }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)) : [],
    days: (await tx.select({ d: schoolSettings.loanDefaultDays }).from(schoolSettings))[0].d,
  }));
  // Bawaan: hari ini + lama pinjam bawaan, pukul 15.00 WITA
  const due = new Date(`${todayWita()}T15:00:00+08:00`);
  due.setUTCDate(due.getUTCDate() + days);
  const defaultDue = `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(due)}T15:00`;
  return (
    <div className="max-w-3xl">
      <PageTitle title={canLend ? "Catat peminjaman" : "Ajukan peminjaman"} desc={canLend ? "Barang langsung diserahkan dan berstatus dipinjam." : "Petugas Barang akan menyerahkan barang setelah pengajuan diterima."} back={{ href: "/peminjaman", label: "Peminjaman" }} />
      <LoanForm canLend={canLend} users={list.map((u) => ({ ...u, info: u.info ? `NIP ${u.info}` : null }))} defaultDue={defaultDue} />
    </div>
  );
}
