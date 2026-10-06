import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { loadAssetFormOptions } from "../../data";
import { ConstructionForm } from "./form";

export const metadata: Metadata = { title: "Catat KDP / renovasi" };

export default async function KdpBaruPage({ searchParams }: PageProps<"/aset/kdp/baru">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const sp = await searchParams;
  const kind = sp.jenis === "ATR" ? "ATR" : "KDP";
  const o = await withSchool(s.schoolId, (tx) => loadAssetFormOptions(tx));
  return (
    <div className="max-w-3xl">
      <PageTitle
        title={kind === "KDP" ? "Catat konstruksi dalam pengerjaan" : "Catat renovasi aset pihak lain"}
        desc={kind === "KDP" ? "Pembangunan/pengadaan aset yang belum selesai pada tanggal pelaporan (KIB F). Nilai dicatat dari pembayaran." : "Renovasi atas aset milik Pengguna Barang lain/pihak lain yang dipakai sekolah — dicatat sebagai aset tetap renovasi (KIB E)."}
        back={{ href: "/aset/kdp", label: "KDP & renovasi" }}
      />
      <ConstructionForm kind={kind} today={todayWita()} vendors={o.vendors} fundingSources={o.fundingSources} fundingComponents={o.fundingComponents} />
    </div>
  );
}
