import type { Metadata } from "next";
import Link from "next/link";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadRegisterParts } from "@/lib/server/register";
import { mutasiData, warehouseOptions } from "@/lib/server/reports";
import { fmtNum, fmtRp } from "@/lib/decimal";
import { ReportHeader, td, th } from "../shared";
import { PeriodForm } from "../period-form";
import { periodFrom, str } from "../params";

export const metadata: Metadata = { title: "Mutasi Persediaan" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function MutasiPage({ searchParams }: PageProps<"/laporan/mutasi">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const sp = await searchParams;
  const per = periodFrom(sp, todayWita());
  const data = await withSchool(s.schoolId, async (tx) => {
    const whs = await warehouseOptions(tx);
    const wh = whs.some((w) => w.id === str(sp.gudang)) ? str(sp.gudang) : null;
    return { whs, wh, m: await mutasiData(tx, per.from, per.to, wh), parts: await loadRegisterParts(tx, s.schoolId) };
  });
  const { m } = data;
  const qs = new URLSearchParams({ tahun: String(per.year), semester: per.sem, ...(data.wh ? { gudang: data.wh } : {}) });
  const whName = data.wh ? data.whs.find((w) => w.id === data.wh)?.name : "Semua gudang";

  return (
    <div>
      <ReportHeader parts={data.parts} title="Laporan Mutasi Persediaan" subtitle={`${per.label} (${fmtDate(per.from)} s/d ${fmtDate(per.to)}) · ${whName}`} csv={`/laporan/mutasi/csv?${qs}`} print={`/cetak/mutasi?${qs}`}>
        <PeriodForm year={per.year} sem={per.sem}>
          <select name="gudang" defaultValue={data.wh ?? ""} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
            <option value="">Semua gudang</option>
            {data.whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </PeriodForm>
      </ReportHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white text-sm">
          <thead className="bg-slate-50 text-center">
            <tr>
              <th rowSpan={2} className={th}>No</th><th rowSpan={2} className={th}>NUSP</th><th rowSpan={2} className={th}>Nama Barang</th><th rowSpan={2} className={th}>Satuan</th>
              <th colSpan={2} className={th}>Saldo Awal</th><th colSpan={2} className={th}>Masuk</th><th colSpan={2} className={th}>Keluar</th><th colSpan={2} className={th}>Saldo Akhir</th>
            </tr>
            <tr>{["Jml", "Rp", "Jml", "Rp", "Jml", "Rp", "Jml", "Rp"].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {m.rows.length === 0 && <tr><td colSpan={12} className={`${td} py-6 text-center text-slate-500`}>Tidak ada persediaan pada periode ini.</td></tr>}
            {m.rows.map((r, i) => (
              <tr key={r.itemId}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} font-mono text-xs whitespace-nowrap`}><Link href={`/persediaan/barang/${r.itemId}`} className="hover:underline">{r.nusp}</Link></td>
                <td className={td}>{r.name}</td>
                <td className={td}>{r.uom}</td>
                <td className={`${td} text-right`}>{fmtNum(r.openQ)}</td><td className={`${td} text-right`}>{fmtRp(r.openV)}</td>
                <td className={`${td} text-right`}>{fmtNum(r.inQ)}</td><td className={`${td} text-right`}>{fmtRp(r.inV)}</td>
                <td className={`${td} text-right`}>{fmtNum(r.outQ)}</td><td className={`${td} text-right`}>{fmtRp(r.outV)}</td>
                <td className={`${td} text-right font-medium`}>{fmtNum(r.closeQ)}</td><td className={`${td} text-right font-medium`}>{fmtRp(r.closeV)}</td>
              </tr>
            ))}
          </tbody>
          {m.rows.length > 0 && (
            <tfoot className="font-medium">
              <tr><td colSpan={4} className={`${td} text-right`}>Jumlah</td>
                <td className={td} /><td className={`${td} text-right`}>{fmtRp(m.totals.openV)}</td>
                <td className={td} /><td className={`${td} text-right`}>{fmtRp(m.totals.inV)}</td>
                <td className={td} /><td className={`${td} text-right`}>{fmtRp(m.totals.outV)}</td>
                <td className={td} /><td className={`${td} text-right`}>{fmtRp(m.totals.closeV)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Metode FIFO. Pembatalan dokumen mengurangi masuk/keluar asalnya. {data.wh ? "Mutasi antar gudang dihitung sebagai masuk/keluar gudang ini." : "Mutasi antar gudang tidak dihitung (perpindahan internal)."}</p>
    </div>
  );
}
