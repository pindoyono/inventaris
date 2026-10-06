import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { stockDocLines, stockDocs } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { loadDocOptions } from "../../../data";
import { DocForm } from "../../doc-form";
import { FORM_KINDS, KIND_LABEL, type FormKind } from "../../labels";

export const metadata: Metadata = { title: "Ubah Draf Dokumen" };

export default async function UbahDokumenPage({ params }: PageProps<"/persediaan/dokumen/[id]/ubah">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [d] = await tx.select().from(stockDocs).where(eq(stockDocs.id, id));
    if (!d) return null;
    const lines = await tx.select().from(stockDocLines).where(eq(stockDocLines.docId, id)).orderBy(asc(stockDocLines.lineNo));
    return { d, lines, opts: await loadDocOptions(tx) };
  });
  if (!data) notFound();
  const { d, lines, opts } = data;
  if (d.status !== "DRAF" || !FORM_KINDS.includes(d.kind as FormKind)) redirect(`/persediaan/dokumen/${id}`);
  return (
    <div className="max-w-4xl">
      <PageTitle title={`Ubah draf ${KIND_LABEL[d.kind]}`} back={{ href: `/persediaan/dokumen/${id}`, label: "Dokumen" }} />
      <DocForm
        today={todayWita()}
        opts={opts}
        initial={{
          id: d.id,
          kind: d.kind as FormKind,
          date: d.date,
          warehouseId: d.warehouseId,
          toWarehouseId: d.toWarehouseId,
          unitId: d.unitId,
          vendorId: d.vendorId,
          fundingSourceId: d.fundingSourceId,
          fundingComponentId: d.fundingComponentId,
          acquisition: d.acquisition,
          refNumber: d.refNumber,
          refDate: d.refDate,
          note: d.note,
          lines: lines.map((l) => ({ itemId: l.itemId, qty: String(Number(l.qty)), unitPrice: l.unitPrice ? String(Number(l.unitPrice)) : "", note: l.note ?? "" })),
        }}
      />
    </div>
  );
}
