import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, sql } from "drizzle-orm";
import { requestEvents, schoolSettings, stockBalances, stockDocs, supplyItems, supplyRequestLines, supplyRequests, units, uoms, users, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { allowedActions, REQ_STATUS_CLASS, REQ_STATUS_LABEL, waitingFor } from "@/lib/requests-shared";
import { fmtNum } from "@/lib/decimal";
import { Alert, PageTitle } from "@/components/ui";
import { requestScope } from "../visibility";
import { ActionPanel } from "./action-panel";

export const metadata: Metadata = { title: "Nota Permintaan" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const fmtTs = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export default async function PermintaanDetailPage({ params }: PageProps<"/permintaan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const requester = alias(users, "requester");

  const data = await withSchool(s.schoolId, async (tx) => {
    const scope = await requestScope(tx, s);
    const [h] = await tx
      .select({ r: supplyRequests, unit: units.name, by: requester.name })
      .from(supplyRequests)
      .innerJoin(units, eq(units.id, supplyRequests.unitId))
      .leftJoin(requester, eq(requester.id, supplyRequests.requestedBy))
      .where(and(eq(supplyRequests.id, id), scope));
    if (!h) return null;
    const lines = await tx
      .select({ l: supplyRequestLines, name: supplyItems.name, nusp: supplyItems.nusp, uom: uoms.name })
      .from(supplyRequestLines)
      .innerJoin(supplyItems, eq(supplyItems.id, supplyRequestLines.itemId))
      .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .where(eq(supplyRequestLines.requestId, id))
      .orderBy(asc(supplyRequestLines.lineNo));
    const events = await tx.select().from(requestEvents).where(eq(requestEvents.requestId, id)).orderBy(asc(requestEvents.id));
    const [st] = await tx.select().from(schoolSettings);
    const whs = await tx.select({ id: warehouses.id, name: warehouses.name, isDefault: warehouses.isDefault }).from(warehouses).where(eq(warehouses.isActive, true)).orderBy(asc(warehouses.name));
    const stock = await tx
      .select({ itemId: stockBalances.itemId, warehouseId: stockBalances.warehouseId, qty: stockBalances.qty })
      .from(stockBalances)
      .where(sql`${stockBalances.itemId} in (select item_id from supply_request_lines where request_id = ${id})`);
    const [doc] = h.r.issueDocId ? await tx.select({ id: stockDocs.id, number: stockDocs.number, status: stockDocs.status }).from(stockDocs).where(eq(stockDocs.id, h.r.issueDocId)) : [];
    return { ...h, lines, events, st, whs, stock, doc };
  });
  if (!data) notFound();
  const { r, st } = data;
  const flow = { mode: r.mode ?? st.distributionMode, levels: r.levels ?? st.approvalLevels };
  const actions = allowedActions(r.status, flow, s.roles, r.requestedBy === s.userId);
  const waiting = waitingFor(r.status, flow);
  const stockMap: Record<string, Record<string, string>> = {};
  for (const b of data.stock) (stockMap[b.itemId] ??= {})[b.warehouseId] = b.qty;

  return (
    <div className="max-w-5xl space-y-6">
      <PageTitle title={`Nota permintaan ${r.number ?? "(draf)"}`} back={{ href: "/permintaan", label: "Permintaan" }} />
      {r.status === "DRAF" && r.lastReason && <Alert tone="warning">Dikembalikan untuk diperbaiki: {r.lastReason}</Alert>}
      {r.status === "DITOLAK" && <Alert>Ditolak: {r.lastReason}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
              <dt className="text-slate-500">Status</dt>
              <dd><span className={`rounded px-1.5 py-0.5 text-xs ${REQ_STATUS_CLASS[r.status]}`}>{REQ_STATUS_LABEL[r.status]}</span>{waiting && <span className="ml-2 text-slate-500">menunggu {waiting}</span>}</dd>
              <dt className="text-slate-500">Unit</dt><dd>{data.unit}</dd>
              <dt className="text-slate-500">Pengusul</dt><dd>{data.by ?? "—"} · {fmtDate(r.date)}</dd>
              {r.purpose && (<><dt className="text-slate-500">Keperluan</dt><dd>{r.purpose}</dd></>)}
              <dt className="text-slate-500">Alur</dt><dd>{flow.mode === "LENGKAP" ? `Lengkap, ${flow.levels} tingkat` : "Ringkas"}</dd>
              {r.spNumber && (<><dt className="text-slate-500">Surat permintaan</dt><dd>{r.spNumber}</dd></>)}
              {r.sppbNumber && (<><dt className="text-slate-500">SPPB</dt><dd>{r.sppbNumber}</dd></>)}
              {data.doc && (<><dt className="text-slate-500">BAST</dt><dd><Link href={`/persediaan/dokumen/${data.doc.id}`} className="text-teal-700 hover:underline">{data.doc.number}</Link>{data.doc.status === "DIBATALKAN" && " (dibatalkan)"}</dd></>)}
            </dl>
          </section>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 text-right font-medium">Diminta</th><th className="px-3 py-2 text-right font-medium">Disetujui</th><th className="px-3 py-2 text-right font-medium">Disalurkan</th><th className="px-3 py-2 font-medium">Keterangan</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lines.map(({ l, name, nusp, uom }) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">{name}<span className="block font-mono text-xs text-slate-500">{nusp}</span></td>
                    <td className="px-3 py-2 text-right">{fmtNum(l.qtyRequested)} {uom}</td>
                    <td className="px-3 py-2 text-right">{l.qtyApproved === null ? "—" : fmtNum(l.qtyApproved)}</td>
                    <td className="px-3 py-2 text-right">{l.qtyIssued === null ? "—" : fmtNum(l.qtyIssued)}</td>
                    <td className="px-3 py-2 text-slate-600">{l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section>
            <h2 className="mb-2 font-semibold">Jejak alur</h2>
            <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
              {data.events.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span><strong>{e.action}</strong> → {REQ_STATUS_LABEL[e.toStatus]}{e.note && <span className="text-slate-600"> — {e.note}</span>}</span>
                  <span className="text-slate-500">{e.userName} · {fmtTs.format(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div>
          {actions.length > 0 ? (
            <ActionPanel
              id={r.id}
              actions={actions}
              mode={flow.mode}
              canEditDraft={r.status === "DRAF"}
              today={todayWita()}
              warehouses={data.whs}
              stock={stockMap}
              lines={data.lines.map(({ l, name, uom }) => ({ id: l.id, itemId: l.itemId, name, uom, requested: l.qtyRequested, approved: l.qtyApproved }))}
            />
          ) : (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">{waiting ? `Menunggu ${waiting}.` : "Tidak ada tindakan lagi."}</p>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">Versi cetak nota permintaan (format 04), SPPB (05), dan BAST (06) dipasang setelah contoh format disetujui.</p>
    </div>
  );
}
