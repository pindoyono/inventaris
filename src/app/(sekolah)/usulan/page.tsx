import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { proposalLines, proposals, schoolSettings, units } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { P_STATUS_CLASS, P_STATUS_LABEL, proposalActions } from "@/lib/proposals-shared";
import { fmtRp } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { proposalScope } from "./data";

export const metadata: Metadata = { title: "Usulan Kebutuhan" };

export default async function UsulanPage({ searchParams }: PageProps<"/usulan">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" && ["tugas", "berjalan", "semua"].includes(sp.tab) ? sp.tab : "tugas";
  const { rows, levels } = await withSchool(s.schoolId, async (tx) => {
    const conds: SQL[] = [];
    const sc = await proposalScope(tx, s);
    if (sc) conds.push(sc);
    if (tab !== "semua") conds.push(inArray(proposals.status, ["DRAF", "DIAJUKAN", "DIVERIFIKASI", "DISETUJUI"]));
    const rows = await tx
      .select({ p: proposals, unit: units.name, total: sql<string>`(select coalesce(sum(round(coalesce(qty_approved, qty) * est_price, 2)),0) from ${proposalLines} where ${proposalLines.proposalId} = ${proposals.id})` })
      .from(proposals).innerJoin(units, eq(units.id, proposals.unitId)).where(and(...conds)).orderBy(desc(proposals.updatedAt)).limit(300);
    const [st] = await tx.select({ l: schoolSettings.approvalLevels }).from(schoolSettings);
    return { rows, levels: st.l };
  });
  const mine = rows.filter(({ p }) => proposalActions(p.status, p.levels ?? levels, s.roles, p.requestedBy === s.userId).some((a) => a !== "BATAL" && a !== "SELESAI") || (p.status === "DISETUJUI" && hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])));
  const shown = tab === "tugas" ? mine : rows;
  return (
    <div>
      <PageTitle title="Usulan kebutuhan" desc="Perencanaan kebutuhan barang per unit, dicocokkan dengan pagu sumber dana sebelum diadakan." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["tugas", "Perlu tindakan saya"], ["berjalan", "Sedang berjalan"], ["semua", "Semua"]].map(([k, l]) => (
          <Link key={k} href={`/usulan?tab=${k}`} className={`rounded-full px-3 py-1 text-sm ${tab === k ? "bg-slate-800 text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}>{l}</Link>
        ))}
        <span className="flex-1" />
        {hasAnyRole(s.roles, ["ADMIN", "KEPSEK"]) && <Link href="/usulan/pagu" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Pagu</Link>}
        <Link href="/usulan/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Usulan</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Nomor</th><th className="px-3 py-2 font-medium">Judul</th><th className="px-3 py-2 font-medium">Unit</th><th className="px-3 py-2 font-medium">Tahun</th><th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">{tab === "tugas" ? "Tidak ada usulan yang menunggu tindakan Anda." : "Belum ada usulan."}</td></tr>}
            {shown.map(({ p, unit, total }) => (
              <tr key={p.id}>
                <td className="px-3 py-2 whitespace-nowrap"><Link href={`/usulan/${p.id}`} className="font-medium text-teal-800 hover:underline">{p.number ?? "(draf)"}</Link></td>
                <td className="px-3 py-2">{p.title}</td><td className="px-3 py-2">{unit}</td><td className="px-3 py-2">{p.year}</td>
                <td className="px-3 py-2 text-right">{fmtRp(total)}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${P_STATUS_CLASS[p.status]}`}>{P_STATUS_LABEL[p.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
