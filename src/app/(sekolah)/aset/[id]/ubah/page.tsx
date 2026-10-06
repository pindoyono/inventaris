import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, bmdCodes, localBmdCodes } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { AssetForm } from "../../asset-form";
import { loadAssetFormOptions } from "../../data";

export const metadata: Metadata = { title: "Ubah Aset" };

export default async function UbahAsetPage({ params }: PageProps<"/aset/[id]/ubah">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [a] = await tx.select().from(assets).where(eq(assets.id, id));
    if (!a) return null;
    const [loc] = await tx.select({ name: localBmdCodes.name }).from(localBmdCodes).where(eq(localBmdCodes.code, a.bmdCode));
    return { a, opts: await loadAssetFormOptions(tx), localName: loc?.name };
  });
  if (!data) notFound();
  const { a } = data;
  const [off] = await db.select({ name: bmdCodes.name }).from(bmdCodes).where(eq(bmdCodes.code, a.bmdCode));
  return (
    <div className="max-w-3xl">
      <PageTitle title={`Ubah ${a.name}`} back={{ href: `/aset/${id}`, label: a.name }} />
      <AssetForm
        opts={data.opts}
        today={todayWita()}
        edit={{
          id: a.id, bmdCode: a.bmdCode, kib: a.kib, codeName: off?.name ?? data.localName ?? "", name: a.name, brand: a.brand, attrs: a.attrs,
          vendorId: a.vendorId, fundingSourceId: a.fundingSourceId, fundingComponentId: a.fundingComponentId, refNumber: a.refNumber, unitId: a.unitId, note: a.note,
        }}
      />
    </div>
  );
}
