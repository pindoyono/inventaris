import type { Metadata } from "next";
import Link from "next/link";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { kirStatus } from "@/lib/server/kir";
import { PageTitle } from "@/components/ui";
import { hasAnyRole } from "@/lib/roles";
import { KirMarkAll } from "../../kir-mark";

export const metadata: Metadata = { title: "Status KIR" };
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Makassar" });

export default async function KirStatusPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const list = await withSchool(s.schoolId, (tx) => kirStatus(tx, todayWita()));
  return (
    <div className="max-w-4xl">
      <PageTitle title="Status KIR per ruangan" desc="KIR diperbarui tiap semester dan tiap ada perpindahan/penambahan barang atau pergantian penanggung jawab (Permendagri 47/2021)." back={{ href: "/laporan/kir", label: "KIR" }} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <a href="/cetak/kir?ruang=semua" target="_blank" rel="noreferrer" className="rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800">Cetak KIR semua ruangan</a>
        {canEdit && <KirMarkAll count={list.filter((r) => r.reasons.length).length} />}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Ruangan</th><th className="px-3 py-2 font-medium">Penanggung jawab</th><th className="px-3 py-2 font-medium">KIR terakhir</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r) => (
              <tr key={r.roomId}>
                <td className="px-3 py-2"><Link href={`/laporan/kir?ruang=${r.roomId}`} className="text-teal-800 hover:underline">{r.room}</Link></td>
                <td className="px-3 py-2">{r.pic ?? "—"}</td>
                <td className="px-3 py-2">{r.last ? `${fmt.format(r.last.at)} (semester ${r.last.period.replace("-", "/")})` : "—"}</td>
                <td className="px-3 py-2">{r.reasons.length ? <span className="text-amber-800">Perlu diperbarui: {r.reasons.join(", ")}</span> : <span className="text-emerald-700">Mutakhir</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
