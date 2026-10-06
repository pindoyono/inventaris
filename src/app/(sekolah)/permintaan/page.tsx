import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { schoolSettings, supplyRequestLines, supplyRequests, units, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { allowedActions, REQ_STATUS_CLASS, REQ_STATUS_LABEL, waitingFor, type ReqStatus } from "@/lib/requests-shared";
import { PageTitle } from "@/components/ui";
import { requestScope } from "./visibility";

export const metadata: Metadata = { title: "Permintaan Barang" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const OPEN: ReqStatus[] = ["DRAF", "DIAJUKAN", "DITERUSKAN", "DIVERIFIKASI", "DISETUJUI"];

export default async function PermintaanPage({ searchParams }: PageProps<"/permintaan">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" && ["tugas", "berjalan", "semua"].includes(sp.tab) ? sp.tab : "tugas";

  const { rows, settings } = await withSchool(s.schoolId, async (tx) => {
    const conds: SQL[] = [];
    const scope = await requestScope(tx, s);
    if (scope) conds.push(scope);
    if (tab !== "semua") conds.push(inArray(supplyRequests.status, OPEN));
    const rows = await tx
      .select({
        r: supplyRequests,
        unit: units.name,
        by: users.name,
        lines: sql<number>`(select count(*)::int from ${supplyRequestLines} where ${supplyRequestLines.requestId} = ${supplyRequests.id})`,
      })
      .from(supplyRequests)
      .innerJoin(units, eq(units.id, supplyRequests.unitId))
      .leftJoin(users, eq(users.id, supplyRequests.requestedBy))
      .where(and(...conds))
      .orderBy(desc(supplyRequests.updatedAt))
      .limit(300);
    const [settings] = await tx.select().from(schoolSettings);
    return { rows, settings };
  });
  const flowOf = (r: (typeof rows)[number]["r"]) => ({ mode: r.mode ?? settings.distributionMode, levels: r.levels ?? settings.approvalLevels });
  const mine = (r: (typeof rows)[number]["r"]) => allowedActions(r.status, flowOf(r), s.roles, r.requestedBy === s.userId).some((a) => a !== "BATAL");
  const shown = tab === "tugas" ? rows.filter(({ r }) => mine(r)) : rows;

  return (
    <div>
      <PageTitle title="Permintaan barang" desc={`Nota permintaan persediaan dari unit. Mode ${settings.distributionMode === "LENGKAP" ? `lengkap, persetujuan ${settings.approvalLevels} tingkat` : "ringkas: Petugas langsung menyetujui & menyalurkan"}.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["tugas", "Perlu tindakan saya"], ["berjalan", "Sedang berjalan"], ["semua", "Semua"]].map(([k, l]) => (
          <Link key={k} href={`/permintaan?tab=${k}`} className={`rounded-full px-3 py-1 text-sm ${tab === k ? "bg-slate-800 text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}>{l}</Link>
        ))}
        <span className="flex-1" />
        <Link href="/permintaan/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Nota permintaan</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Nomor</th><th className="px-3 py-2 font-medium">Unit</th><th className="px-3 py-2 font-medium">Pengusul</th><th className="px-3 py-2 text-right font-medium">Barang</th><th className="px-3 py-2 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">{tab === "tugas" ? "Tidak ada permintaan yang menunggu tindakan Anda." : "Belum ada permintaan."}</td></tr>}
            {shown.map(({ r, unit, by, lines }) => (
              <tr key={r.id}>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-3 py-2 whitespace-nowrap"><Link href={`/permintaan/${r.id}`} className="font-medium text-teal-800 hover:underline">{r.number ?? "(draf)"}</Link></td>
                <td className="px-3 py-2">{unit}</td>
                <td className="px-3 py-2">{by ?? "—"}</td>
                <td className="px-3 py-2 text-right">{lines}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${REQ_STATUS_CLASS[r.status]}`}>{REQ_STATUS_LABEL[r.status]}</span>
                  {waitingFor(r.status, flowOf(r)) && <span className="block text-xs text-slate-500">menunggu {waitingFor(r.status, flowOf(r))}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
