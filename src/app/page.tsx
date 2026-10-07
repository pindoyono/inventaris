import Link from "next/link";
import { ScopeNotice } from "@/components/ui";

const FITUR = [
  ["Aset tetap per unit", "Setiap barang punya kode register BMD, label, riwayat lokasi, kondisi, pemeliharaan, dan penghapusan."],
  ["Persediaan FIFO", "Stok habis pakai di beberapa gudang, permintaan unit, SPPB dan BAST, dengan kartu barang persediaan."],
  ["Peminjaman", "Peminjaman barang ke guru, unit, atau siswa, lengkap dengan jatuh tempo dan pengembalian."],
  ["Laporan BMD", "KIR, KIB, mutasi persediaan, berita acara, dan stock opname per semester sesuai Permendagri."],
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-lg font-semibold">Inventaris</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/panduan" className="rounded-md px-3 py-2 hover:bg-white">Panduan</Link>
          <Link href="/login" className="rounded-md px-3 py-2 hover:bg-white">Masuk</Link>
          <Link href="/daftar" className="rounded-md bg-teal-700 px-3 py-2 font-medium text-white hover:bg-teal-800">Daftarkan sekolah</Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-10 pb-12">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Pengelolaan Barang Milik Daerah di sekolah negeri, rapi dari penerimaan sampai laporan.
        </h1>
        <p className="max-w-2xl text-slate-600">
          Kode barang mengikuti Permendagri 108/2016, persediaan dicatat perpetual dengan metode FIFO sesuai Permendagri
          47/2021, dan dokumen cetak mengikuti format pengelolaan BMD.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/panduan" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z" /><path d="M8 7h7M8 11h5" /></svg>
            Baca panduan pengguna
          </Link>
          <Link href="/panduan/alur" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="7" height="5" rx="1" /><rect x="14" y="16" width="7" height="5" rx="1" /><path d="M6.5 8v4.5h11V16" /></svg>
            Lihat flowchart alur
          </Link>
        </div>
        <div className="max-w-3xl">
          <ScopeNotice />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-2">
        {FITUR.map(([judul, isi]) => (
          <div key={judul} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{judul}</h2>
            <p className="mt-1 text-sm text-slate-600">{isi}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Inventaris · <a href="https://ankdev.id" className="hover:underline">ankdev.id</a>
      </footer>
    </main>
  );
}
