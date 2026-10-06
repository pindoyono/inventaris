import type { Metadata } from "next";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { budgetCeilings, fundingSources, proposalLines, proposals, units } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { thisYear } from "@/lib/server/proposals";
import { PageTitle } from "@/components/ui";
import { BudgetGrid } from "./grid";

export const metadata: Metadata = { title: "Pagu" };

export default async function PaguPage({ searchParams }: PageProps<"/usulan/pagu">) {
  const s = await pageSchoolUser(["ADMIN", "KEPSEK"]);
  const sp = await searchParams;
  const year = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? Number(sp.tahun) : thisYear();
  const data = await withSchool(s.schoolId, async (tx) => {
    const un = await tx.select({ id: units.id, name: units.name }).from(units).where(eq(units.isActive, true)).orderBy(asc(units.name));
    const fs = await tx.select({ id: fundingSources.id, name: fundingSources.name }).from(fundingSources).where(eq(fundingSources.isActive, true)).orderBy(asc(fundingSources.name));
    const ceil = await tx.select().from(budgetCeilings).where(eq(budgetCeilings.year, year));
    const used = await tx
      .select({ unitId: proposals.unitId, fs: proposals.fundingSourceId, v: sql<string>`coalesce(sum(round(coalesce(${proposalLines.qtyApproved},0) * ${proposalLines.estPrice}, 2)),0)` })
      .from(proposalLines).innerJoin(proposals, eq(proposals.id, proposalLines.proposalId))
      .where(and(eq(proposals.year, year), inArray(proposals.status, ["DISETUJUI", "SELESAI"])))
      .groupBy(proposals.unitId, proposals.fundingSourceId);
    return { un, fs, ceil, used };
  });
  return (
    <div>
      <PageTitle title={`Pagu belanja barang ${year}`} desc="Batas nilai usulan yang bisa disetujui per unit dan sumber dana. Kosongkan untuk tanpa batas." back={{ href: "/usulan", label: "Usulan" }} />
      <form className="mb-4 flex gap-2 text-sm"><input name="tahun" defaultValue={year} className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5" /><button className="rounded-md border border-slate-300 bg-white px-3 py-1.5">Tampilkan</button></form>
      <BudgetGrid year={year} units={data.un} sources={data.fs}
        values={Object.fromEntries(data.ceil.map((c) => [`${c.unitId}|${c.fundingSourceId}`, String(Number(c.amount))]))}
        used={Object.fromEntries(data.used.map((u) => [`${u.unitId}|${u.fs}`, u.v]))} />
    </div>
  );
}
