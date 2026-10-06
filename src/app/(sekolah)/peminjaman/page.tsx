import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt, inArray, lt, sql, type SQL } from "drizzle-orm";
import { loanLines, loans } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { PageTitle } from "@/components/ui";
import { loanScope } from "./scope";

export const metadata: Metadata = { title: "Peminjaman" };
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });
const STATUS = { DIAJUKAN: ["Diajukan", "bg-sky-100 text-sky-800"], DIPINJAM: ["Dipinjam", "bg-amber-100 text-amber-800"], SELESAI: ["Selesai", "bg-emerald-100 text-emerald-800"], DITOLAK: ["Ditolak", "bg-red-100 text-red-700"], DIBATALKAN: ["Dibatalkan", "bg-slate-200 text-slate-500"] } as const;
const TABS = [["berjalan", "Sedang dipinjam"], ["terlambat", "Terlambat"], ["diajukan", "Pengajuan"], ["selesai", "Selesai"], ["semua", "Semua"]] as const;

export default async function PeminjamanPage({ searchParams }: PageProps<"/peminjaman">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR", "PEMINJAM"]);
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as string) : "berjalan";
  const now = new Date();
  const { rows, counts } = await withSchool(s.schoolId, async (tx) => {
    const scope = loanScope(s);
    const conds: SQL[] = scope ? [scope] : [];
    if (tab === "berjalan") conds.push(eq(loans.status, "DIPINJAM"));
    if (tab === "terlambat") conds.push(eq(loans.status, "DIPINJAM"), lt(loans.dueAt, now));
    if (tab === "diajukan") conds.push(eq(loans.status, "DIAJUKAN"));
    if (tab === "selesai") conds.push(inArray(loans.status, ["SELESAI", "DITOLAK", "DIBATALKAN"]));
    const rows = await tx
      .select({
        l: loans,
        items: sql<number>`(select count(*)::int from ${loanLines} where ${loanLines.loanId} = ${loans.id})`,
        out: sql<number>`(select count(*)::int from ${loanLines} where ${loanLines.loanId} = ${loans.id} and ${loanLines.outAt} is not null and ${loanLines.returnedAt} is null)`,
      })
      .from(loans)
      .where(and(...conds))
      .orderBy(tab === "berjalan" || tab === "terlambat" ? loans.dueAt : desc(loans.createdAt))
      .limit(300);
    const base = scope ? [scope] : [];
    const [c] = await tx
      .select({
        late: sql<number>`count(*) filter (where ${loans.status} = 'DIPINJAM' and ${loans.dueAt} < now())::int`,
        req: sql<number>`count(*) filter (where ${loans.status} = 'DIAJUKAN')::int`,
      })
      .from(loans)
      .where(and(...base, gt(loans.createdAt, new Date(0))));
    return { rows, counts: c };
  });
  const canLend = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const canRequest = hasAnyRole(s.roles, ["PEMINJAM"]) && !canLend;

  return (
    <div>
      <PageTitle title="Peminjaman barang" desc="Peminjaman alat oleh guru/siswa di dalam sekolah. Kondisi dicatat saat diserahkan dan saat kembali." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/peminjaman?tab=${k}`} className={`rounded-full px-3 py-1 text-sm ${tab === k ? "bg-slate-800 text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}>
            {l}
            {k === "terlambat" && counts.late > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{counts.late}</span>}
            {k === "diajukan" && counts.req > 0 && <span className="ml-1 rounded-full bg-sky-600 px-1.5 text-xs text-white">{counts.req}</span>}
          </Link>
        ))}
        <span className="flex-1" />
        {(canLend || canRequest) && (
          <Link href="/peminjaman/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            {canLend ? "+ Catat peminjaman" : "+ Ajukan peminjaman"}
          </Link>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2 font-medium">Nomor</th><th className="px-3 py-2 font-medium">Peminjam</th><th className="px-3 py-2 text-right font-medium">Barang</th><th className="px-3 py-2 font-medium">Batas kembali</th><th className="px-3 py-2 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Tidak ada peminjaman.</td></tr>}
            {rows.map(({ l, items, out }) => {
              const late = l.status === "DIPINJAM" && l.dueAt < now;
              return (
                <tr key={l.id} className={late ? "bg-red-50" : ""}>
                  <td className="px-3 py-2 whitespace-nowrap"><Link href={`/peminjaman/${l.id}`} className="font-medium text-teal-800 hover:underline">{l.number}</Link></td>
                  <td className="px-3 py-2">{l.borrowerName}{l.borrowerInfo && <span className="block text-xs text-slate-500">{l.borrowerInfo}</span>}</td>
                  <td className="px-3 py-2 text-right">{l.status === "DIPINJAM" && out !== items ? `${out}/${items}` : items}</td>
                  <td className={`px-3 py-2 whitespace-nowrap ${late ? "font-medium text-red-700" : ""}`}>{fmt.format(l.dueAt)}{late && " · terlambat"}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS[l.status][1]}`}>{STATUS[l.status][0]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
