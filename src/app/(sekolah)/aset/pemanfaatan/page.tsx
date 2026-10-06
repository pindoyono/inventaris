import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { utilizations } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { fmtRp } from "@/lib/decimal";
import { UTIL_FORM_LABEL, UTIL_KIND_LABEL, UTIL_STATUS_LABEL } from "@/lib/utilization-shared";
import { PageTitle } from "@/components/ui";
import { AsetTabs } from "../tabs";

export const metadata: Metadata = { title: "Pemanfaatan BMD" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "");
const CLS = {
  RENCANA: "bg-slate-100 text-slate-700", DISETUJUI: "bg-sky-100 text-sky-800", BERJALAN: "bg-emerald-100 text-emerald-800",
  SELESAI: "bg-slate-200 text-slate-600", DITOLAK: "bg-red-100 text-red-800", DIBATALKAN: "bg-slate-200 text-slate-500",
} as const;

export default async function PemanfaatanPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const today = todayWita();
  const rows = await withSchool(s.schoolId, (tx) =>
    tx
      .select({
        u: utilizations,
        n: sql<number>`(select count(*)::int from utilization_lines ul where ul.utilization_id = utilizations.id)`,
        first: sql<string>`(select a.name from utilization_lines ul join assets a on a.id = ul.asset_id where ul.utilization_id = utilizations.id order by a.name limit 1)`,
      })
      .from(utilizations)
      .orderBy(desc(utilizations.createdAt))
      .limit(300),
  );
  const soon = rows.filter((r) => r.u.status === "BERJALAN" && r.u.endDate && r.u.endDate >= today && r.u.endDate <= addDays(today, 30));
  return (
    <div>
      <PageTitle title="Aset tetap" desc="Pemanfaatan BMD (sewa, pinjam pakai, BGS/BSG, KSP, KSPI), penggunaan sementara oleh Pengguna Barang lain, dan BMD yang dioperasikan pihak lain — dari rencana (RKBMD), persetujuan, sampai pelaksanaan." />
      <AsetTabs active="/aset/pemanfaatan" />
      {soon.length > 0 && <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">⚠ {soon.length} perjanjian berakhir dalam 30 hari: {soon.map((r) => r.u.partner).join(", ")}</p>}
      {canEdit && <div className="mb-4 flex justify-end"><Link href="/aset/pemanfaatan/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Catat rencana / pemanfaatan</Link></div>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 font-medium">Bentuk</th><th className="px-3 py-2 font-medium">Mitra / peruntukan</th><th className="px-3 py-2 font-medium">Jangka waktu</th><th className="px-3 py-2 text-right font-medium">Kontribusi (Rp)</th><th className="px-3 py-2 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Belum ada pemanfaatan atau penggunaan oleh pihak lain.</td></tr>}
            {rows.map(({ u, n, first }) => (
              <tr key={u.id}>
                <td className="px-3 py-2"><Link href={`/aset/pemanfaatan/${u.id}`} className="font-medium text-teal-800 hover:underline">{first}{n > 1 ? ` +${n - 1} lainnya` : ""}</Link><span className="block text-xs text-slate-500">RKBMD {u.planYear}</span></td>
                <td className="px-3 py-2">{u.form ? UTIL_FORM_LABEL[u.form] : UTIL_KIND_LABEL[u.kind]}{u.withoutApproval && <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-800">tanpa persetujuan</span>}</td>
                <td className="px-3 py-2">{u.partner ?? "—"}<span className="block text-xs text-slate-500">{u.purpose}</span></td>
                <td className="px-3 py-2">{u.startDate ? `${fmtDate(u.startDate)} – ${u.endDate ? fmtDate(u.endDate) : "…"}` : u.term ?? "—"}</td>
                <td className="px-3 py-2 text-right">{fmtRp(u.contribution)}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${CLS[u.status]}`}>{UTIL_STATUS_LABEL[u.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
