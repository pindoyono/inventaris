import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq } from "drizzle-orm";
import { fundingComponents, fundingSources, procurements, proposalEvents, proposalLines, proposals, schoolSettings, units, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { budgetStatus } from "@/lib/server/proposals";
import { proposalRemaining } from "@/lib/server/procurement";
import { hasAnyRole } from "@/lib/roles";
import { P_STATUS_CLASS, P_STATUS_LABEL, PRIORITY_LABEL, proposalActions } from "@/lib/proposals-shared";
import { fmtNum, fmtRp, mulDec, parseDec } from "@/lib/decimal";
import { Alert, PageTitle } from "@/components/ui";
import { proposalScope } from "../data";
import { ProposalActions } from "./actions-panel";

export const metadata: Metadata = { title: "Usulan Kebutuhan" };
const fmtTs = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export default async function UsulanDetailPage({ params }: PageProps<"/usulan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const by = alias(users, "by");
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx.select({ p: proposals, unit: units.name, by: by.name, fs: fundingSources.name, fc: fundingComponents.name })
      .from(proposals).innerJoin(units, eq(units.id, proposals.unitId)).leftJoin(by, eq(by.id, proposals.requestedBy))
      .leftJoin(fundingSources, eq(fundingSources.id, proposals.fundingSourceId)).leftJoin(fundingComponents, eq(fundingComponents.id, proposals.fundingComponentId))
      .where(and(eq(proposals.id, id), await proposalScope(tx, s)));
    if (!h) return null;
    const lines = await tx.select().from(proposalLines).where(eq(proposalLines.proposalId, id)).orderBy(asc(proposalLines.lineNo));
    const events = await tx.select().from(proposalEvents).where(eq(proposalEvents.proposalId, id)).orderBy(asc(proposalEvents.id));
    const procs = await tx.select().from(procurements).where(eq(procurements.proposalId, id)).orderBy(desc(procurements.createdAt));
    const [st] = await tx.select({ l: schoolSettings.approvalLevels }).from(schoolSettings);
    const budget = await budgetStatus(tx, h.p.unitId, h.p.fundingSourceId, h.p.year, ["DISETUJUI", "SELESAI"].includes(h.p.status) ? id : undefined);
    const remaining = h.p.status === "DISETUJUI" ? await proposalRemaining(tx, id) : [];
    return { ...h, lines, events, procs, levels: h.p.levels ?? st.l, budget, remaining };
  });
  if (!data) notFound();
  const { p, lines } = data;
  const actions = proposalActions(p.status, data.levels, s.roles, p.requestedBy === s.userId);
  const total = lines.reduce((a, l) => a + mulDec(parseDec(l.qtyApproved ?? l.qty), parseDec(l.estPrice)), 0n);
  const canProcure = p.status === "DISETUJUI" && hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) && data.remaining.some((r) => r.remaining > 0n);
  return (
    <div className="max-w-5xl space-y-5">
      <PageTitle title={`Usulan ${p.number ?? "(draf)"}: ${p.title}`} desc={`${data.unit} · TA ${p.year} · ${data.fs ?? "sumber dana belum dipilih"}${data.fc ? ` — ${data.fc}` : ""} · pengusul ${data.by}`} back={{ href: "/usulan", label: "Usulan" }} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded px-1.5 py-0.5 text-xs ${P_STATUS_CLASS[p.status]}`}>{P_STATUS_LABEL[p.status]}</span>
        {data.budget ? <span>Pagu {data.unit}: Rp{fmtRp(data.budget.ceiling)} · terpakai Rp{fmtRp(data.budget.used)} · <b>sisa Rp{fmtRp(data.budget.left)}</b></span> : <span className="text-slate-500">Belum ada pagu untuk unit & sumber dana ini (tidak dibatasi).</span>}
      </div>
      {p.lastReason && p.status === "DRAF" && <Alert tone="warning">Dikembalikan: {p.lastReason}</Alert>}
      {p.status === "DITOLAK" && <Alert>Ditolak: {p.lastReason}</Alert>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 text-right font-medium">Diusulkan</th><th className="px-3 py-2 text-right font-medium">Disetujui</th><th className="px-3 py-2 text-right font-medium">Harga satuan</th><th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th><th className="px-3 py-2 font-medium">Prioritas</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2">{l.lineNo}</td>
                <td className="px-3 py-2">{l.description}<span className="block text-xs text-slate-500">{l.kind === "ASET" ? `Aset${l.bmdCode ? ` · ${l.bmdCode}` : ""}` : "Persediaan"}{l.reason ? ` · ${l.reason}` : ""}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{fmtNum(l.qty)} {l.uom}</td>
                <td className="px-3 py-2 text-right">{l.qtyApproved === null ? "—" : fmtNum(l.qtyApproved)}</td>
                <td className="px-3 py-2 text-right">{fmtRp(l.estPrice)}</td>
                <td className="px-3 py-2 text-right">{fmtRp(mulDec(parseDec(l.qtyApproved ?? l.qty), parseDec(l.estPrice)))}</td>
                <td className="px-3 py-2">{PRIORITY_LABEL[l.priority]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-medium"><tr><td colSpan={5} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{fmtRp(total)}</td><td /></tr></tfoot>
        </table>
      </div>
      {actions.length > 0 && <ProposalActions id={p.id} actions={actions} canEdit={p.status === "DRAF"} budgetLeft={data.budget ? data.budget.left.toString() : null} lines={lines.map((l) => ({ id: l.id, label: l.description, qty: l.qty, approved: l.qtyApproved, price: l.estPrice, uom: l.uom }))} />}
      {canProcure && <Link href={`/pengadaan/baru?usulan=${p.id}`} className="inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Buat pengadaan dari usulan ini</Link>}
      {data.procs.length > 0 && (
        <section><h2 className="mb-2 font-semibold">Pengadaan</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">{data.procs.map((x) => <li key={x.id} className="px-4 py-2"><Link href={`/pengadaan/${x.id}`} className="text-teal-700 hover:underline">{x.number}</Link> · {x.status.toLowerCase().replace("_", " ")}</li>)}</ul>
        </section>
      )}
      <section><h2 className="mb-2 font-semibold">Jejak alur</h2>
        <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">{data.events.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2"><span><b>{e.action}</b> → {P_STATUS_LABEL[e.toStatus]}{e.note && <span className="text-slate-600"> — {e.note}</span>}</span><span className="text-slate-500">{e.userName} · {fmtTs.format(e.createdAt)}</span></li>)}</ol>
      </section>
    </div>
  );
}
