import type { Metadata } from "next";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Laporan Permendagri 7/2024" };

export default async function Lap7Page() {
  await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const y = todayWita().slice(0, 4);
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1.5";
  const card = "space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm";
  return (
    <div className="max-w-3xl space-y-4">
      <PageTitle title="Laporan Permendagri 7/2024" desc="Format lampiran yang diisi Kuasa Pengguna Barang (sekolah). RKBMD rencana penghapusan (A.5) dicetak dari halaman usulan penghapusan." back={{ href: "/laporan", label: "Laporan" }} />
      <form action="/cetak/pemantauan" target="_blank" className={card}>
        <input type="hidden" name="jenis" value="rusak-berat" />
        <div className="font-medium">C.23 — Pemantauan BMD tindak lanjut rusak berat/usang</div>
        <p className="text-slate-600">Aset rusak berat & persediaan rusak/usang, serta yang diusulkan pemindahtanganan/pemusnahan (dari usulan penghapusan).</p>
        <div className="flex gap-2"><input name="tahun" defaultValue={y} className={`${sel} w-20`} /><select name="sifat" className={sel}><option value="periodik">Periodik</option><option value="insidentil">Insidentil</option></select><button className="rounded-md bg-teal-700 px-4 py-1.5 font-medium text-white">Cetak</button></div>
      </form>
      <form action="/cetak/pemantauan" target="_blank" className={card}>
        <input type="hidden" name="jenis" value="tidak-digunakan" />
        <div className="font-medium">C.3 — Pemantauan BMD tidak digunakan untuk penyelenggaraan tugas & fungsi</div>
        <p className="text-slate-600">Dari aset yang ditandai “tidak digunakan untuk tusi” beserta rencananya (tombol di halaman aset).</p>
        <div className="flex gap-2"><input name="tahun" defaultValue={y} className={`${sel} w-20`} /><select name="sifat" className={sel}><option value="periodik">Periodik</option><option value="insidentil">Insidentil</option></select><button className="rounded-md bg-teal-700 px-4 py-1.5 font-medium text-white">Cetak</button></div>
      </form>
      <div className={card}>
        <div className="font-medium">B.1/B.2 — Daftar dokumen bukti kepemilikan BMD</div>
        <p className="text-slate-600">Sertifikat tanah (KIB A), BPKB kendaraan (KIB B), dokumen gedung (KIB C) dari data aset — bahan untuk Pejabat Penatausahaan Barang.</p>
        <div className="flex gap-3">
          <a href="/cetak/dokumen-kepemilikan?jenis=tanah" target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:underline">B.1 Sertipikat tanah</a>
          <a href="/cetak/dokumen-kepemilikan?jenis=lain" target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:underline">B.2 Selain sertifikat tanah</a>
        </div>
      </div>
    </div>
  );
}
