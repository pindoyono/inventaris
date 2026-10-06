import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bmdCodes, proposalLines, proposals } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { loadProposalOptions } from "../../data";
import { ProposalForm } from "../../proposal-form";

export const metadata: Metadata = { title: "Ubah Usulan" };

export default async function UbahUsulanPage({ params }: PageProps<"/usulan/[id]/ubah">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [p] = await tx.select().from(proposals).where(eq(proposals.id, id));
    if (!p) return null;
    return { p, lines: await tx.select().from(proposalLines).where(eq(proposalLines.proposalId, id)).orderBy(asc(proposalLines.lineNo)), opts: await loadProposalOptions(tx, s) };
  });
  if (!data) notFound();
  if (data.p.status !== "DRAF") redirect(`/usulan/${id}`);
  const codes = data.lines.map((l) => l.bmdCode).filter((c): c is string => !!c);
  const names = new Map((codes.length ? await db.select({ c: bmdCodes.code, n: bmdCodes.name }).from(bmdCodes) : []).filter((x) => codes.includes(x.c)).map((x) => [x.c, x.n]));
  const { p } = data;
  return (
    <div className="max-w-4xl">
      <PageTitle title="Ubah usulan" back={{ href: `/usulan/${id}`, label: "Usulan" }} />
      <ProposalForm opts={data.opts} initial={{ id, unitId: p.unitId, year: p.year, fundingSourceId: p.fundingSourceId ?? "", fundingComponentId: p.fundingComponentId ?? "", title: p.title,
        lines: data.lines.map((l) => ({ kind: l.kind, itemId: l.itemId ?? "", bmdCode: l.bmdCode ?? "", codeName: l.bmdCode ? names.get(l.bmdCode) ?? "" : "", description: l.description, uom: l.uom, qty: String(Number(l.qty)), estPrice: String(Number(l.estPrice)), reason: l.reason ?? "", priority: l.priority })) }} />
    </div>
  );
}
