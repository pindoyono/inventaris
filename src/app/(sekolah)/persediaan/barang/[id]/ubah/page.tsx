import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { supplyItems } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { ItemForm } from "../../item-form";
import { bmdName, loadItemFormOptions } from "../../load";

export const metadata: Metadata = { title: "Ubah Barang Persediaan" };

export default async function UbahBarangPage({ params }: PageProps<"/persediaan/barang/[id]/ubah">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [item] = await tx.select().from(supplyItems).where(eq(supplyItems.id, id));
    if (!item) return null;
    return { item: { ...item, bmdName: await bmdName(tx, item.bmdCode) }, opts: await loadItemFormOptions(tx) };
  });
  if (!data) notFound();
  return (
    <div className="max-w-3xl">
      <PageTitle title={`Ubah ${data.item.name}`} back={{ href: `/persediaan/barang/${id}`, label: data.item.name }} />
      <ItemForm item={data.item} uoms={data.opts.uoms} favorites={data.opts.favorites} />
    </div>
  );
}
