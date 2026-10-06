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
