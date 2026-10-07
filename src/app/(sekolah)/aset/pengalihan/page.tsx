import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { schools, transfers } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { TRANSFER_STATUS_LABEL } from "@/lib/server/transfers";
import { fmtRp, parseDec } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { AsetTabs } from "../tabs";

export const metadata: Metadata = { title: "Pengalihan aset" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");
const CLS = { DRAF: "bg-slate-100 text-slate-700", DISERAHKAN: "bg-amber-100 text-amber-800", DITERIMA: "bg-emerald-100 text-emerald-800", DITOLAK: "bg-red-100 text-red-800", DIBATALKAN: "bg-slate-200 text-slate-500" } as const;

export default async function PengalihanPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const rows = await withSchool(s.schoolId, (tx) =>
    tx.select({ t: transfers, from: schools.name }).from(transfers).leftJoin(schools, eq(schools.id, transfers.fromSchoolId)).orderBy(desc(transfers.createdAt)).limit(300),
  );
  const incoming = rows.filter((r) => r.t.toSchoolId === s.schoolId);
  const outgoing = rows.filter((r) => r.t.fromSchoolId === s.schoolId);
  const waiting = incoming.filter((r) => r.t.status === "DISERAHKAN").length;
  const table = (list: typeof rows, dir: "keluar" | "masuk") => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Nomor / tanggal</th><th className="px-3 py-2 font-medium">{dir === "keluar" ? "Penerima" : "Pengirim"}</th><th className="px-3 py-2 text-right font-medium">Barang</th><th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Belum ada.</td></tr>}
          {list.map(({ t, from }) => (
            <tr key={t.id}>
              <td className="px-3 py-2"><Link href={`/aset/pengalihan/${t.id}`} className="font-medium text-teal-800 hover:underline">{t.number ?? "Draf"}</Link><span className="block text-xs text-slate-500">{fmtDate(t.bastDate ?? t.date)}</span></td>
              <td className="px-3 py-2">{dir === "keluar" ? t.toName : from}{dir === "keluar" && !t.toSchoolId && <span className="block text-xs text-slate-500">di luar aplikasi</span>}</td>
              <td className="px-3 py-2 text-right">{t.items.length}</td>
              <td className="px-3 py-2 text-right">{fmtRp(t.items.reduce((a, i) => a + parseDec(i.acqPrice), 0n))}</td>
              <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${CLS[t.status]}`}>{TRANSFER_STATUS_LABEL[t.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-5">
      <div>
        <PageTitle title="Aset tetap" desc="Pengeluaran internal: menyerahkan barang ke Kuasa Pengguna Barang lain (mis. sekolah lain di bawah Dinas yang sama) dengan persetujuan Pengguna Barang. Sekolah penerima yang memakai aplikasi ini mencatat penerimaan internal dari daftar masuk." />
        <AsetTabs active="/aset/pengalihan" />
      </div>
      {waiting > 0 && <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">⚠ {waiting} penyerahan barang dari sekolah lain menunggu dicatat.</p>}
      <section className="space-y-2">
        <h2 className="font-semibold">Masuk (penerimaan internal)</h2>
        {table(incoming, "masuk")}
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Keluar (pengeluaran internal)</h2>
          {hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) && <Link href="/aset/pengalihan/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Serahkan barang</Link>}</div>
        {table(outgoing, "keluar")}
      </section>
    </div>
  );
}
