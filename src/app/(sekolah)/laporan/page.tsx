import type { Metadata } from "next";
import Link from "next/link";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Laporan" };
const LIST = [
  ["/laporan/kir", "Kartu Inventaris Ruangan (KIR)", "Isi tiap ruangan per semester, kondisi B/RR/RB. Ditempel di ruangan & diarsipkan."],
  ["/laporan/kib?gol=B", "Kartu Inventaris Barang (KIB) A–F", "Aset tetap per golongan: tanah, peralatan & mesin, gedung, jaringan, aset tetap lainnya, KDP."],
  ["/laporan/mutasi", "Laporan Mutasi Persediaan", "Per NUSP: saldo awal, masuk, keluar, saldo akhir (jumlah & rupiah), per gudang."],
] as const;

export default async function LaporanPage() {
  await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  return (
    <div className="max-w-3xl">
      <PageTitle title="Laporan" desc="Tampilan layar & ekspor Excel. Versi cetak resmi mengikuti contoh format setelah disetujui." />
      <div className="space-y-3">
        {LIST.map(([href, t, d]) => (
          <Link key={href} href={href} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">
            <span className="font-medium">{t}</span>
            <span className="mt-1 block text-sm text-slate-600">{d}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
