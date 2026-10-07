import type { Metadata } from "next";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { transferDestinations } from "@/lib/server/transfers";
import { PageTitle } from "@/components/ui";
import { TransferForm } from "./form";

export const metadata: Metadata = { title: "Serahkan barang" };

export default async function PengalihanBaruPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const dest = await transferDestinations(s.schoolId);
  return (
    <div className="max-w-3xl">
      <PageTitle title="Serahkan barang ke Kuasa Pengguna lain" desc="Barang keluar dari daftar barang sekolah saat BAST dicatat. Wajib ada surat persetujuan Pengguna Barang (Dinas)." back={{ href: "/aset/pengalihan", label: "Pengalihan" }} />
      <TransferForm today={todayWita()} destinations={dest.map((d) => ({ id: d.id, label: `${d.name} (${d.npsn})` }))} />
    </div>
  );
}
