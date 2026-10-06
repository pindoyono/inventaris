import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { disposalLines, disposals } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Usulan Penghapusan" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const LABEL = { DRAF: "Draf", DIAJUKAN: "Diajukan Kepala Sekolah", DIKIRIM: "Dikirim ke Dinas/BPKAD", SELESAI: "SK terbit", DITOLAK: "Ditolak", DIBATALKAN: "Dibatalkan" } as const;

export default async function PenghapusanPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const list = await withSchool(s.schoolId, (tx) =>
    tx.select({ d: disposals, n: sql<number>`(select count(*)::int from ${disposalLines} where ${disposalLines.disposalId} = ${disposals.id})` }).from(disposals).orderBy(desc(disposals.createdAt)).limit(100),
  );
  return (
    <div className="max-w-4xl space-y-4">
      <PageTitle title="Usulan penghapusan" desc="Sekolah mengusulkan; penghapusan diputus kepala daerah. Barang yang diusulkan tidak bisa dipinjam atau dipindah sampai ada keputusan." back={{ href: "/audit", label: "Audit" }} />
      {hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) && <Link href="/audit/penghapusan/baru" className="inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Siapkan usulan</Link>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Nomor</th><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 text-right font-medium">Barang</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">SK</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Belum ada usulan.</td></tr>}
            {list.map(({ d, n }) => (
              <tr key={d.id}>
                <td className="px-3 py-2"><Link href={`/audit/penghapusan/${d.id}`} className="font-medium text-teal-800 hover:underline">{d.number ?? "(draf)"}</Link></td>
                <td className="px-3 py-2">{fmtDate(d.date)}</td><td className="px-3 py-2 text-right">{n}</td><td className="px-3 py-2">{LABEL[d.status]}</td><td className="px-3 py-2">{d.skNumber ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
