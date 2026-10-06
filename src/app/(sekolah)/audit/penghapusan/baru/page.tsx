import type { Metadata } from "next";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { DisposalForm } from "../disposal-form";

export const metadata: Metadata = { title: "Usulan Penghapusan Baru" };

export default async function UsulanBaruPage() {
  await pageSchoolUser(["ADMIN", "PETUGAS"]);
  return (
    <div className="max-w-4xl">
      <PageTitle title="Siapkan usulan penghapusan" desc="Draf disiapkan Petugas, lalu diajukan oleh Kepala Sekolah selaku Kuasa Pengguna Barang." back={{ href: "/audit/penghapusan", label: "Usulan penghapusan" }} />
      <DisposalForm today={todayWita()} initial={{ date: todayWita(), note: "", lines: [] }} />
    </div>
  );
}
