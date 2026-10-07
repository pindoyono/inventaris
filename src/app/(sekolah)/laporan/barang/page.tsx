import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { buildDoc, FORMATS, needsSemester, type FormatKey } from "@/lib/server/laporan-docs";
import { parsePeriod, periodQuery } from "@/lib/period";
import { PageTitle } from "@/components/ui";
import { DocScreenTable } from "@/components/cetak/doc-table";

export const metadata: Metadata = { title: "Laporan Barang Kuasa Pengguna" };
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default async function LaporanBarangPage({ searchParams }: PageProps<"/laporan/barang">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const sp = await searchParams;
  const today = todayWita();
  const p = parsePeriod(sp, today);
  const preview = await withSchool(s.schoolId, (tx) => buildDoc(tx, s.schoolId, p, "IV.L.4.2", false));
  const q = periodQuery(p);
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";
  const link = "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs hover:bg-slate-50";
  const groups: [string, FormatKey[]][] = [
    ["Laporan barang (mutasi)", ["IV.L.4.2", "IV.L.2.2", "IV.L.2.1", "IV.L.2.3", "IV.L.3.2", "IV.L.1.1"]],
    ["Penyusutan / amortisasi", ["IV.H.4", "IV.H.5", "IV.H.R"]],
    ["Daftar barang", ["DBKP"]],
  ];
  return (
    <div className="space-y-5">
      <PageTitle
        title="Laporan Barang Kuasa Pengguna"
        desc="Disusun otomatis dari riwayat setiap barang (Permendagri 47/2021 Pasal 75): bulanan paling lambat tanggal 10 bulan berikutnya; semester I paling lambat minggu ke-4 Juli, semester II minggu ke-2 Februari."
        back={{ href: "/laporan", label: "Laporan" }}
      />
      <form className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <label className="space-y-1 text-sm"><span className="block text-slate-600">Periode</span>
          <select name="periode" defaultValue={p.kind} className={sel}><option value="bulan">Bulanan</option><option value="semester">Semesteran</option><option value="tahun">Tahunan</option></select></label>
        <label className="space-y-1 text-sm"><span className="block text-slate-600">Tahun</span><input name="tahun" defaultValue={p.year} className={`${sel} w-20`} inputMode="numeric" /></label>
        <label className="space-y-1 text-sm"><span className="block text-slate-600">Semester</span>
          <select name="semester" defaultValue={p.sem} className={sel}><option value="1">I (Jan–Jun)</option><option value="2">II (Jul–Des)</option></select></label>
        <label className="space-y-1 text-sm"><span className="block text-slate-600">Bulan</span>
          <select name="bulan" defaultValue={p.month} className={sel}>{BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}</select></label>
        <button className="rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white">Tampilkan</button>
        <span className="text-sm text-slate-600">Periode: <b>{p.label}</b> ({p.from} s.d. {p.to})</span>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Ringkasan — {preview.title}</h2>
        {preview.tables.map((t, i) => <DocScreenTable key={i} t={t} />)}
        <p className="text-xs text-slate-500">{preview.note}</p>
      </section>

      {groups.map(([label, keys]) => (
        <section key={label} className="space-y-2">
          <h2 className="font-semibold">{label}</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {keys.map((k) => {
              const f = FORMATS[k];
              const off = needsSemester(k) && p.kind === "bulan";
              const variants: [string, string][] = f.ie ? [["intra", "Intrakomptabel"], ["ekstra", "Ekstrakomptabel"]] : [["", ""]];
              return (
                <li key={k} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span><span className="font-mono text-xs text-slate-500">{k === "DBKP" ? "DBKP" : k}</span> <span className="font-medium">{f.title}</span><span className="block text-xs text-slate-500">{off ? "Pilih periode semesteran/tahunan untuk laporan penyusutan." : f.desc}</span></span>
                  {!off && (
                    <span className="flex flex-wrap gap-1.5">
                      {variants.map(([j, jl]) => (
                        <span key={j} className="flex gap-1.5">
                          <a className={link} target="_blank" rel="noreferrer" href={`/cetak/laporan-barang?format=${k}&${q}${j ? `&jenis=${j}` : ""}`}>Cetak{jl ? ` ${jl.toLowerCase()}` : ""}</a>
                          <a className={link} href={`/laporan/barang/unduh?format=${k}&${q}${j ? `&jenis=${j}` : ""}`}>Excel{jl ? ` ${jl.slice(0, 5).toLowerCase()}` : ""}</a>
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-xs text-slate-500">Masa manfaat penyusutan diatur di Penyiapan › Kode BMD. Format tabel resmi Lampiran IV tidak dimuat dalam PDF regulasi; kolom disusun menurut judul format dan isi pasal — kabari bila Dinas/BPKAD memakai susunan lain.</p>
    </div>
  );
}
