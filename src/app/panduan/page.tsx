import type { Metadata } from "next";
import Link from "next/link";
import { TOPICS } from "./topics";
import { FLOWS } from "./flows";

export const metadata: Metadata = { title: "Panduan pengguna" };

export default function PanduanHome() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panduan pengguna Inventaris</h1>
        <p className="mt-1 leading-relaxed text-slate-600">Penjelasan langkah demi langkah untuk setiap menu, disertai flowchart interaktif. Klik kotak berwarna <span className="rounded bg-teal-100 px-1 text-teal-900">hijau toska</span> di flowchart untuk langsung membuka halaman aplikasi yang dimaksud.</p>
      </div>
      <Link href="/panduan/alur" className="block rounded-lg border border-teal-300 bg-teal-50 p-4 hover:border-teal-600">
        <span className="font-semibold text-teal-900">Flowchart alur penggunaan →</span>
        <span className="mt-1 block text-sm text-teal-900/80">{FLOWS.length} diagram: {FLOWS.map((f) => f.title.split(" ")[0].toLowerCase()).slice(0, 8).join(", ")}, dan lainnya.</span>
      </Link>
      <div>
        <h2 className="mb-2 font-semibold">Mulai dari mana?</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Admin sekolah baru</b>: <Link className="text-teal-700 underline" href="/panduan/mulai">Memulai</Link> → <Link className="text-teal-700 underline" href="/panduan/penyiapan">Penyiapan</Link> → <Link className="text-teal-700 underline" href="/panduan/impor">Impor Excel</Link></li>
          <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Petugas barang</b>: <Link className="text-teal-700 underline" href="/panduan/persediaan">Persediaan</Link>, <Link className="text-teal-700 underline" href="/panduan/aset">Aset</Link>, <Link className="text-teal-700 underline" href="/panduan/audit">Audit</Link>, <Link className="text-teal-700 underline" href="/panduan/laporan">Laporan</Link></li>
          <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Kepala sekolah / verifikator</b>: <Link className="text-teal-700 underline" href="/panduan/peran">Peran</Link>, <Link className="text-teal-700 underline" href="/panduan/usulan-pengadaan">Usulan</Link>, <Link className="text-teal-700 underline" href="/panduan/permintaan">Permintaan</Link>, <Link className="text-teal-700 underline" href="/panduan/penghapusan">Penghapusan</Link></li>
          <li className="rounded-lg border border-slate-200 bg-white p-3"><b>Guru / pengusul / peminjam</b>: <Link className="text-teal-700 underline" href="/panduan/permintaan">Permintaan barang</Link>, <Link className="text-teal-700 underline" href="/panduan/peminjaman">Peminjaman</Link></li>
        </ul>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">Semua topik</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <Link key={t.slug} href={`/panduan/${t.slug}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">
              <span className="font-medium">{t.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{t.summary}</span>
              <span className="mt-2 block text-xs text-slate-500">Untuk: {t.who}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
