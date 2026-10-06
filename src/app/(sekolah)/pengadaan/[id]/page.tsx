import { Attachments } from "@/components/lampiran/attachments";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assets, fundingComponents, fundingSources, procurementLines, procurements, proposals, rooms, stockDocs, supplyItems, vendors, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { hasAnyRole } from "@/lib/roles";
import { fmtNum, fmtRp, mulDec, parseDec } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { ProcActions } from "./proc-actions";

export const metadata: Metadata = { title: "Pengadaan" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");
const LABEL = { DRAF: "Draf", DIPESAN: "Dipesan", DITERIMA_SEBAGIAN: "Diterima sebagian", DITERIMA: "Diterima", DIBATALKAN: "Dibatalkan" } as const;

export default async function PengadaanDetailPage({ params }: PageProps<"/pengadaan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx.select({ p: procurements, vendor: vendors.name, fs: fundingSources.name, fc: fundingComponents.name, usulan: proposals.number })
      .from(procurements).leftJoin(vendors, eq(vendors.id, procurements.vendorId)).leftJoin(fundingSources, eq(fundingSources.id, procurements.fundingSourceId))
      .leftJoin(fundingComponents, eq(fundingComponents.id, procurements.fundingComponentId)).leftJoin(proposals, eq(proposals.id, procurements.proposalId)).where(eq(procurements.id, id));
    if (!h) return null;
    const lines = await tx.select({ l: procurementLines, item: supplyItems.name }).from(procurementLines).leftJoin(supplyItems, eq(supplyItems.id, procurementLines.itemId)).where(eq(procurementLines.procurementId, id)).orderBy(asc(procurementLines.lineNo));
    const docs = await tx.select({ id: stockDocs.id, number: stockDocs.number, date: stockDocs.date }).from(stockDocs).where(eq(stockDocs.procurementId, id));
    const assetRows = await tx.select({ id: assets.id, name: assets.name, regNo: assets.regNo, batch: assets.batchId }).from(assets).where(eq(assets.procurementId, id)).orderBy(asc(assets.regNo));
    const opts = {
      warehouses: await tx.select({ id: warehouses.id, name: warehouses.name, isDefault: warehouses.isDefault }).from(warehouses).where(eq(warehouses.isActive, true)).orderBy(asc(warehouses.name)),
      rooms: await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name)),
      items: await tx.select({ id: supplyItems.id, name: supplyItems.name, nusp: supplyItems.nusp }).from(supplyItems).where(eq(supplyItems.isActive, true)).orderBy(asc(supplyItems.name)),
    };
    return { ...h, lines, docs, assetRows, opts };
  });
  if (!data) notFound();
  const { p, lines } = data;
  const total = lines.reduce((a, { l }) => a + mulDec(parseDec(l.qty), parseDec(l.unitPrice)), 0n);
  const batches = [...new Set(data.assetRows.map((a) => a.batch))];
  return (
    <div className="max-w-5xl space-y-5">
      <PageTitle title={`Pengadaan ${p.number}`} desc={`${LABEL[p.status]} · ${fmtDate(p.orderDate)} · ${data.vendor ?? "penyedia belum diisi"}${data.usulan ? ` · dari usulan ${data.usulan}` : ""}`} back={{ href: "/pengadaan", label: "Pengadaan" }} />
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[9rem_1fr_9rem_1fr]">
          <dt className="text-slate-500">Nota</dt><dd>{p.refNumber ?? "—"} ({fmtDate(p.refDate)})</dd>
          <dt className="text-slate-500">Sumber dana</dt><dd>{data.fs ?? "—"}{data.fc ? ` — ${data.fc}` : ""}</dd>
          <dt className="text-slate-500">Nilai barang</dt><dd>Rp{fmtRp(total)}</dd>
          <dt className="text-slate-500">Pajak dicatat</dt><dd>Rp{fmtRp(p.taxAmount)}</dd>
          {data.usulan && (<><dt className="text-slate-500">Usulan</dt><dd><Link href={`/usulan/${p.proposalId}`} className="text-teal-700 hover:underline">{data.usulan}</Link></dd></>)}
          {p.note && (<><dt className="text-slate-500">Catatan</dt><dd>{p.note}</dd></>)}
        </dl>
      </section>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 text-right font-medium">Jumlah</th><th className="px-3 py-2 text-right font-medium">Diterima</th><th className="px-3 py-2 text-right font-medium">Harga</th><th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map(({ l, item }) => (
              <tr key={l.id}><td className="px-3 py-2">{l.lineNo}</td>
                <td className="px-3 py-2">{l.description}{l.brand ? ` · ${l.brand}` : ""}<span className="block text-xs text-slate-500">{l.kind === "ASET" ? `Aset · ${l.bmdCode}` : `Persediaan${item ? ` · ${item}` : " · NUSP dipilih saat diterima"}`}</span></td>
                <td className="px-3 py-2 text-right">{fmtNum(l.qty)}</td><td className="px-3 py-2 text-right">{fmtNum(l.qtyReceived)}</td><td className="px-3 py-2 text-right">{fmtRp(l.unitPrice)}</td><td className="px-3 py-2 text-right">{fmtRp(mulDec(parseDec(l.qty), parseDec(l.unitPrice)))}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data.docs.length > 0 || data.assetRows.length > 0) && (
        <section className="space-y-1 text-sm">
          <h2 className="font-semibold">Hasil penerimaan</h2>
          {data.docs.map((d) => <p key={d.id}>Persediaan: <Link href={`/persediaan/dokumen/${d.id}`} className="text-teal-700 hover:underline">{d.number}</Link> ({fmtDate(d.date)})</p>)}
          {data.assetRows.length > 0 && <p>Aset: {data.assetRows.length} unit — {data.assetRows.slice(0, 8).map((a, i) => <span key={a.id}>{i > 0 && ", "}<Link href={`/aset/${a.id}`} className="text-teal-700 hover:underline">{a.name} {String(a.regNo).padStart(6, "0")}</Link></span>)}{data.assetRows.length > 8 && " …"} · {batches.map((b) => <a key={b} href={`/cetak/label?batch=${b}`} target="_blank" rel="noreferrer" className="ml-2 text-teal-700 hover:underline">cetak label</a>)}</p>}
        </section>
      )}
      <Attachments schoolId={s.schoolId} entity="pengadaan" entityId={p.id} path={`/pengadaan/${p.id}`} canEdit={hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK"])} title="Nota, kuitansi & dokumen" />
      {hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) && (
        <ProcActions id={p.id} status={p.status} today={todayWita()} orderDate={p.orderDate} opts={data.opts}
          lines={lines.map(({ l }) => ({ id: l.id, kind: l.kind, label: l.description, itemId: l.itemId, left: String(Number(l.qty) - Number(l.qtyReceived)) }))} />
      )}
    </div>
  );
}
