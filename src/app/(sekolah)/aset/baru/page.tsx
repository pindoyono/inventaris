import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { AssetForm } from "../asset-form";
import { loadAssetFormOptions } from "../data";

export const metadata: Metadata = { title: "Catat Aset" };

export default async function AsetBaruPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const opts = await withSchool(s.schoolId, loadAssetFormOptions);
  return (
    <div className="max-w-3xl">
      <PageTitle title="Catat aset tetap" desc="Satu baris per unit: 30 kursi = 30 unit dengan nomor register masing-masing." back={{ href: "/aset", label: "Aset" }} />
      <AssetForm opts={opts} today={todayWita()} />
    </div>
  );
}
