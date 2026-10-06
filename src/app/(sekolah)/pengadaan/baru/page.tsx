import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { fundingComponents, fundingSources, proposals, supplyItems, vendors } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { proposalRemaining } from "@/lib/server/procurement";
import { Alert, PageTitle } from "@/components/ui";
import { ProcForm } from "../proc-form";

export const metadata: Metadata = { title: "Pengadaan Baru" };

export default async function PengadaanBaruPage({ searchParams }: PageProps<"/pengadaan/baru">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const { usulan } = await searchParams;
  const data = await withSchool(s.schoolId, async (tx) => {
    const base = {
      vendors: await tx.select({ id: vendors.id, name: vendors.name }).from(vendors).orderBy(asc(vendors.name)),
      sources: await tx.select({ id: fundingSources.id, name: fundingSources.name }).from(fundingSources).where(eq(fundingSources.isActive, true)).orderBy(asc(fundingSources.name)),
      components: await tx.select({ id: fundingComponents.id, name: fundingComponents.name, sourceId: fundingComponents.fundingSourceId }).from(fundingComponents).orderBy(asc(fundingComponents.name)),
      items: await tx.select({ id: supplyItems.id, name: supplyItems.name, nusp: supplyItems.nusp }).from(supplyItems).where(eq(supplyItems.isActive, true)).orderBy(asc(supplyItems.name)),
    };
    if (typeof usulan !== "string" || !/^[0-9a-f-]{36}$/.test(usulan)) return { ...base, p: null, lines: [] };
    const [p] = await tx.select().from(proposals).where(eq(proposals.id, usulan));
    if (!p || p.status !== "DISETUJUI") return { ...base, p: null, lines: [], invalid: true };
    return { ...base, p, lines: (await proposalRemaining(tx, p.id)).filter((l) => l.remaining > 0n) };
  });
  const today = todayWita();
  return (
    <div className="max-w-4xl">
      <PageTitle title={data.p ? `Pengadaan dari usulan ${data.p.number}` : "Pengadaan langsung"} back={{ href: data.p ? `/usulan/${data.p.id}` : "/pengadaan", label: data.p ? "Usulan" : "Pengadaan" }} />
      {"invalid" in data && <Alert>Usulan tidak ditemukan atau belum disetujui.</Alert>}
      <ProcForm today={today} vendors={data.vendors} sources={data.sources} components={data.components} items={data.items} fromProposal={data.p?.number ?? null}
        initial={{ proposalId: data.p?.id ?? "", vendorId: "", fundingSourceId: data.p?.fundingSourceId ?? "", fundingComponentId: data.p?.fundingComponentId ?? "", orderDate: today, refNumber: "", refDate: "", taxAmount: "", note: "",
          lines: data.lines.map((l) => ({ proposalLineId: l.id, kind: l.kind, itemId: l.itemId ?? "", bmdCode: l.bmdCode ?? "", description: l.description, brand: "", qty: (Number(l.remaining) / 100).toString(), unitPrice: String(Number(l.estPrice)), max: `${Number(l.remaining) / 100} ${l.uom}`, lockCode: !!l.bmdCode })) }} />
    </div>
  );
}
