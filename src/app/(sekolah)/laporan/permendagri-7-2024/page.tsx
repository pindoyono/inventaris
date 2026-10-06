import type { Metadata } from "next";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Laporan Permendagri 7/2024" };

const PEMANTAUAN = [
  { jenis: "tidak-digunakan", no: "C.3", title: "BMD tidak digunakan untuk penyelenggaraan tugas & fungsi", src: "Aset yang ditandai “tidak digunakan untuk tusi” beserta rencananya (tombol di halaman aset)." },
  { jenis: "penggunaan-sementara", no: "C.5", title: "BMD penggunaan sementara", src: "Aset › Pemanfaatan, jenis “penggunaan sementara oleh Pengguna Barang lain”." },
  { jenis: "operasional-pihak-lain", no: "C.7", title: "BMD yang dioperasionalkan oleh pihak lain", src: "Aset › Pemanfaatan, jenis “dioperasikan oleh pihak lain”." },
  { jenis: "pemanfaatan", no: "C.9", title: "Pemanfaatan BMD (sewa, pinjam pakai, BGS/BSG, KSP, KSPI)", src: "Aset › Pemanfaatan: rencana, persetujuan, dan pelaksanaan per bentuk." },
  { jenis: "pemanfaatan-tanpa-persetujuan", no: "C.11", title: "Pemanfaatan BMD tanpa persetujuan", src: "Pemanfaatan yang dicatat “sudah berjalan” tanpa nomor persetujuan." },
  { jenis: "pemindahtanganan", no: "C.13", title: "Pemindahtanganan BMD", src: "Usulan penghapusan dengan tindak lanjut pemindahtanganan (penjualan/tukar menukar/hibah/penyertaan modal)." },
  { jenis: "kdp", no: "C.21", title: "Pelaksanaan konstruksi dalam pengerjaan (KDP)", src: "Aset › KDP & renovasi: KDP berjalan/dihentikan pada akhir tahun." },
  { jenis: "rusak-berat", no: "C.23", title: "BMD tindak lanjut rusak berat/usang", src: "Aset rusak berat & persediaan rusak/usang, serta yang diusulkan pemindahtanganan/pemusnahan." },
  { jenis: "atr", no: "C.25", title: "Tindak lanjut aset tetap renovasi (ATR)", src: "Aset › KDP & renovasi: renovasi aset pihak lain dan rencana tindak lanjutnya." },
  { jenis: "reklasifikasi", no: "C.27", title: "Tindak lanjut LHI melalui reklasifikasi", src: "Temuan inventarisasi “perlu reklasifikasi” dan reklasifikasi yang sudah dicatat di halaman aset." },
  { jenis: "koreksi", no: "C.29", title: "Tindak lanjut LHI melalui koreksi", src: "Temuan inventarisasi “perlu koreksi” dan koreksi yang sudah dicatat di halaman aset." },
] as const;

export default async function Lap7Page() {
  await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const y = todayWita().slice(0, 4);
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-1.5";
  const card = "space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm";
  const btn = "rounded-md bg-teal-700 px-4 py-1.5 font-medium text-white";
  return (
    <div className="max-w-3xl space-y-4">
      <PageTitle title="Laporan Permendagri 7/2024" desc="Format lampiran yang diisi Kuasa Pengguna Barang (sekolah)." back={{ href: "/laporan", label: "Laporan" }} />

      <h2 className="pt-2 font-semibold">A. RKBMD</h2>
      <form action="/cetak/rkbmd-pemanfaatan" target="_blank" className={card}>
        <div className="font-medium">A.1 — RKBMD rencana pemanfaatan</div>
        <p className="text-slate-600">Dari Aset › Pemanfaatan yang dicatat sebagai rencana untuk tahun anggaran tersebut.</p>
        <div className="flex gap-2"><input name="tahun" defaultValue={Number(y) + 1} className={`${sel} w-20`} aria-label="Tahun anggaran" /><button className={btn}>Cetak</button></div>
      </form>
      <div className={card}>
        <div className="font-medium">A.3 — RKBMD rencana pemindahtanganan · A.5 — RKBMD rencana penghapusan</div>
        <p className="text-slate-600">Dicetak dari halaman tiap usulan penghapusan (Audit › Penghapusan). Barang dengan tindak lanjut pemindahtanganan masuk A.3, sisanya A.5.</p>
      </div>

      <h2 className="pt-2 font-semibold">B. Daftar dokumen kepemilikan</h2>
      <div className={card}>
        <div className="font-medium">B.1/B.2 — Daftar dokumen bukti kepemilikan BMD</div>
        <p className="text-slate-600">Sertifikat tanah (KIB A), BPKB kendaraan (KIB B), dokumen gedung (KIB C) dari data aset — bahan untuk Pejabat Penatausahaan Barang.</p>
        <div className="flex gap-3">
          <a href="/cetak/dokumen-kepemilikan?jenis=tanah" target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:underline">B.1 Sertipikat tanah</a>
          <a href="/cetak/dokumen-kepemilikan?jenis=lain" target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:underline">B.2 Selain sertifikat tanah</a>
        </div>
      </div>

      <h2 className="pt-2 font-semibold">C. Laporan pemantauan</h2>
      {PEMANTAUAN.map((p) => (
        <form key={p.jenis} action="/cetak/pemantauan" target="_blank" className={card}>
          <input type="hidden" name="jenis" value={p.jenis} />
          <div className="font-medium">{p.no} — Pemantauan {p.title}</div>
          <p className="text-slate-600">{p.src}</p>
          <div className="flex gap-2">
            <input name="tahun" defaultValue={y} className={`${sel} w-20`} aria-label="Tahun" />
            <select name="sifat" className={sel} aria-label="Sifat"><option value="periodik">Periodik</option><option value="insidentil">Insidentil</option></select>
            <button className={btn}>Cetak</button>
          </div>
        </form>
      ))}
      <p className="text-xs text-slate-500">Format bernomor genap (C.4, C.6, …) dan D/E/F disusun Pengguna Barang (Dinas), Pengelola, atau BPKAD dari laporan sekolah. C.15 (pemindahtanganan tanpa persetujuan), C.17–C.20 (pemantauan penyampaian laporan), C.31/C.33 (pengalihan status/penggunaan internal) tidak relevan untuk pencatatan di tingkat sekolah.</p>
    </div>
  );
}
