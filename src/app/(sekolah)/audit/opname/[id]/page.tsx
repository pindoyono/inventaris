import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { stockDocs, stockOpnameLines, stockOpnames, supplyItems, uoms, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { Alert, PageTitle } from "@/components/ui";
import { OpnameSheet } from "./sheet";

export const metadata: Metadata = { title: "Stock Opname" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function OpnameDetailPage({ params }: PageProps<"/audit/opname/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx.select({ o: stockOpnames, wh: warehouses.name }).from(stockOpnames).innerJoin(warehouses, eq(warehouses.id, stockOpnames.warehouseId)).where(eq(stockOpnames.id, id));
    if (!h) return null;
    const lines = await tx
      .select({ l: stockOpnameLines, name: supplyItems.name, nusp: supplyItems.nusp, uom: uoms.name })
      .from(stockOpnameLines).innerJoin(supplyItems, eq(supplyItems.id, stockOpnameLines.itemId)).innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .where(eq(stockOpnameLines.opnameId, id)).orderBy(asc(supplyItems.name));
    const docs = await tx.select({ id: stockDocs.id, number: stockDocs.number, kind: stockDocs.kind }).from(stockDocs).where(eq(stockDocs.opnameId, id));
    const items = h.o.status === "DRAF"
      ? await tx.select({ id: supplyItems.id, name: supplyItems.name, nusp: supplyItems.nusp }).from(supplyItems).where(eq(supplyItems.isActive, true)).orderBy(asc(supplyItems.name))
      : [];
    return { ...h, lines, docs, items };
  });
  if (!data) notFound();
  const { o } = data;
  const role = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) ? "petugas" : hasAnyRole(s.roles, ["KEPSEK"]) ? "kepsek" : "lihat";
  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle title={`Stock opname ${o.number}`} desc={`${data.wh} · ${fmtDate(o.date)}${o.note ? ` · ${o.note}` : ""}`} back={{ href: "/audit/opname", label: "Stock opname" }} />
      {o.status === "DRAF" && o.lastReason && <Alert tone="warning">Dikembalikan Kepala Sekolah: {o.lastReason}</Alert>}
      {(o.status === "DRAF" || o.status === "DIAJUKAN") && <Alert tone="info">{data.wh} dibekukan selama stock opname ini berjalan.</Alert>}
      {data.docs.length > 0 && (
        <p className="text-sm">Dokumen penyesuaian: {data.docs.map((d, i) => <span key={d.id}>{i > 0 && ", "}<Link href={`/persediaan/dokumen/${d.id}`} className="text-teal-700 hover:underline">{d.number}</Link></span>)}</p>
      )}
      <OpnameSheet
        id={o.id}
        status={o.status}
        role={role}
        items={data.items.filter((i) => !data.lines.some((l) => l.l.itemId === i.id))}
        lines={data.lines.map(({ l, name, nusp, uom }) => ({ id: l.id, name, nusp, uom, systemQty: l.systemQty, physicalQty: l.physicalQty, damagedQty: l.damagedQty, surplusPrice: l.surplusPrice, note: l.note }))}
      />
      <p className="text-xs text-slate-500">Versi cetak Berita Acara Inventarisasi Fisik Persediaan (format 11) dipasang setelah contoh format disetujui.</p>
    </div>
  );
}
