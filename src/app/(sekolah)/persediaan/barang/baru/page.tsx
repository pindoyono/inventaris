import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { ItemForm } from "../item-form";
import { loadItemFormOptions } from "../load";

export const metadata: Metadata = { title: "Barang Persediaan Baru" };

export default async function BarangBaruPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const opts = await withSchool(s.schoolId, loadItemFormOptions);
  return (
    <div className="max-w-3xl">
      <PageTitle title="Barang persediaan baru" back={{ href: "/persediaan", label: "Persediaan" }} />
      <ItemForm item={null} uoms={opts.uoms} favorites={opts.favorites} />
    </div>
  );
}
