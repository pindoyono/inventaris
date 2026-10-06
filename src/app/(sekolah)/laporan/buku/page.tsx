import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Buku Persediaan" };
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default async function BukuPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const whs = await withSchool(s.schoolId, (tx) => tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).orderBy(asc(warehouses.name)));
  const t = todayWita();
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1.5";
  return (
    <div className="max-w-2xl">
      <PageTitle title="Buku penerimaan & pengeluaran persediaan" back={{ href: "/laporan", label: "Laporan" }} />
      <form action="/cetak/buku" target="_blank" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2"><input type="radio" name="jenis" value="penerimaan" defaultChecked className="accent-teal-700" /> Kartu Penerimaan</label>
          <label className="flex items-center gap-2"><input type="radio" name="jenis" value="pengeluaran" className="accent-teal-700" /> Kartu Pengeluaran</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <select name="bulan" defaultValue={String(Number(t.slice(5, 7)))} className={sel}>
            <option value="">Per semester →</option>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
          </select>
          <select name="semester" defaultValue="" className={sel}><option value="">—</option><option value="1">Semester I</option><option value="2">Semester II</option><option value="0">Setahun</option></select>
          <input name="tahun" defaultValue={t.slice(0, 4)} className={`${sel} w-20`} />
          <select name="gudang" defaultValue="" className={sel}><option value="">Semua gudang</option>{whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        </div>
        <p className="text-xs text-slate-500">Pilih bulan, atau kosongkan bulan lalu pilih semester/setahun.</p>
        <button className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">Cetak</button>
      </form>
    </div>
  );
}
