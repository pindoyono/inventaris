import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { supplyRequestLines, supplyRequests } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { loadRequestOptions } from "../../data";
import { RequestForm } from "../../request-form";

export const metadata: Metadata = { title: "Ubah Nota Permintaan" };

export default async function UbahPermintaanPage({ params }: PageProps<"/permintaan/[id]/ubah">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [r] = await tx.select().from(supplyRequests).where(eq(supplyRequests.id, id));
    if (!r) return null;
    const lines = await tx.select().from(supplyRequestLines).where(eq(supplyRequestLines.requestId, id)).orderBy(asc(supplyRequestLines.lineNo));
    return { r, lines, opts: await loadRequestOptions(tx, s) };
  });
  if (!data) notFound();
  if (data.r.status !== "DRAF") redirect(`/permintaan/${id}`);
  return (
    <div className="max-w-4xl">
      <PageTitle title="Ubah nota permintaan" back={{ href: `/permintaan/${id}`, label: "Nota" }} />
      <RequestForm
        opts={data.opts}
        today={todayWita()}
        initial={{ id, unitId: data.r.unitId, date: data.r.date, purpose: data.r.purpose ?? "", lines: data.lines.map((l) => ({ itemId: l.itemId, qty: String(Number(l.qtyRequested)), note: l.note ?? "" })) }}
      />
    </div>
  );
}
