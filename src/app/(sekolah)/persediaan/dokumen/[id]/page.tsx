import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { fundingComponents, fundingSources, stockDocLines, stockDocs, stockMovements, supplyItems, units, uoms, users, vendors, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { fmtNum, fmtRp, mulDec, parseDec } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { ACQUISITION, KIND_LABEL, STATUS_CLASS, STATUS_LABEL } from "../labels";
import { CancelAction, DraftActions } from "./doc-actions";

export const metadata: Metadata = { title: "Dokumen Stok" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");
const fmtTs = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export default async function DokumenDetailPage({ params }: PageProps<"/persediaan/dokumen/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser();
  const toWh = alias(warehouses, "to_wh");
  const creator = alias(users, "creator");
  const poster = alias(users, "poster");

  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx
      .select({ d: stockDocs, wh: warehouses.name, toWh: toWh.name, unit: units.name, vendor: vendors.name, fs: fundingSources.name, fc: fundingComponents.name, creator: creator.name, poster: poster.name })
      .from(stockDocs)
      .innerJoin(warehouses, eq(warehouses.id, stockDocs.warehouseId))
      .leftJoin(toWh, eq(toWh.id, stockDocs.toWarehouseId))
      .leftJoin(units, eq(units.id, stockDocs.unitId))
      .leftJoin(vendors, eq(vendors.id, stockDocs.vendorId))
      .leftJoin(fundingSources, eq(fundingSources.id, stockDocs.fundingSourceId))
      .leftJoin(fundingComponents, eq(fundingComponents.id, stockDocs.fundingComponentId))
      .leftJoin(creator, eq(creator.id, stockDocs.createdBy))
      .leftJoin(poster, eq(poster.id, stockDocs.postedBy))
      .where(eq(stockDocs.id, id));
    if (!h) return null;
    const lines = await tx
      .select({ l: stockDocLines, nusp: supplyItems.nusp, name: supplyItems.name, uom: uoms.name })
      .from(stockDocLines)
      .innerJoin(supplyItems, eq(supplyItems.id, stockDocLines.itemId))
      .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .where(eq(stockDocLines.docId, id))
      .orderBy(asc(stockDocLines.lineNo));
    const moves = await tx.select().from(stockMovements).where(eq(stockMovements.docId, id)).orderBy(asc(stockMovements.id));
    return { ...h, lines, moves };
  });
  if (!data) notFound();
  const { d, lines, moves } = data;
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const canCancel = hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK"]);
  const inboundDoc = d.kind === "SALDO_AWAL" || d.kind === "PENERIMAAN" || d.kind === "PENYESUAIAN_TAMBAH";

  // Nilai per baris: dokumen masuk = qty × harga; keluar = Σ potongan FIFO dari buku besar (bukan pembalik/mutasi masuk)
  const lineValue = (itemId: string, qty: string, price: string | null) => {
    if (inboundDoc) return price === null ? null : mulDec(parseDec(qty), parseDec(price));
    const out = moves.filter((m) => m.itemId === itemId && m.kind !== "PEMBALIK" && m.kind !== "MUTASI_MASUK" && Number(m.qtyOut) > 0);
    return out.length ? out.reduce((a, m) => a + parseDec(m.value), 0n) : null;
  };
  const pieces = (itemId: string) =>
    moves.filter((m) => m.itemId === itemId && m.kind !== "PEMBALIK" && m.kind !== "MUTASI_MASUK" && Number(m.qtyOut) > 0).map((m) => `${fmtNum(m.qtyOut)}×${fmtRp(m.unitPrice)}`);
  const total = lines.reduce((a, { l }) => a + (lineValue(l.itemId, l.qty, l.unitPrice) ?? 0n), 0n);

  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle title={`${KIND_LABEL[d.kind]} ${d.number ?? "(draf)"}`} back={{ href: "/persediaan/dokumen", label: "Dokumen stok" }} />

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[10rem_1fr_10rem_1fr]">
          <dt className="text-slate-500">Status</dt>
          <dd><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLASS[d.status]}`}>{STATUS_LABEL[d.status]}</span></dd>
          <dt className="text-slate-500">Tanggal</dt><dd>{fmtDate(d.date)}</dd>
          <dt className="text-slate-500">{d.kind === "MUTASI" ? "Gudang asal" : "Gudang"}</dt><dd>{data.wh}</dd>
          {data.toWh && (<><dt className="text-slate-500">Gudang tujuan</dt><dd>{data.toWh}</dd></>)}
          {data.unit && (<><dt className="text-slate-500">Unit penerima</dt><dd>{data.unit}</dd></>)}
          {d.acquisition && (<><dt className="text-slate-500">Cara perolehan</dt><dd>{ACQUISITION.find(([k]) => k === d.acquisition)?.[1] ?? d.acquisition}</dd></>)}
          {data.vendor && (<><dt className="text-slate-500">Penyedia</dt><dd>{data.vendor}</dd></>)}
          {d.refNumber && (<><dt className="text-slate-500">No. nota</dt><dd>{d.refNumber} ({fmtDate(d.refDate)})</dd></>)}
          {data.fs && (<><dt className="text-slate-500">Sumber dana</dt><dd>{data.fs}{data.fc ? ` — ${data.fc}` : ""}</dd></>)}
          <dt className="text-slate-500">Dibuat</dt><dd>{data.creator ?? "—"} · {fmtTs.format(d.createdAt)}</dd>
          {d.postedAt && (<><dt className="text-slate-500">Diposting</dt><dd>{data.poster ?? "—"} · {fmtTs.format(d.postedAt)}</dd></>)}
        </dl>
        {d.note && <p className="mt-3 text-slate-600">Catatan: {d.note}</p>}
        {d.status === "DIBATALKAN" && <p className="mt-3 text-red-700">Dibatalkan {d.cancelledAt ? fmtTs.format(d.cancelledAt) : ""}: {d.cancelReason}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">No</th>
              <th className="px-3 py-2 font-medium">Barang</th>
              <th className="px-3 py-2 text-right font-medium">Jumlah</th>
              <th className="px-3 py-2 text-right font-medium">Harga satuan</th>
              <th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map(({ l, nusp, name, uom }) => {
              const v = lineValue(l.itemId, l.qty, l.unitPrice);
              const p = inboundDoc ? (l.unitPrice ? [fmtRp(l.unitPrice)] : []) : pieces(l.itemId);
              return (
                <tr key={l.id}>
                  <td className="px-3 py-2">{l.lineNo}</td>
                  <td className="px-3 py-2">
                    <Link href={`/persediaan/barang/${l.itemId}`} className="text-teal-800 hover:underline">{name}</Link>
                    <span className="block font-mono text-xs text-slate-500">{nusp}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtNum(l.qty)} {uom}</td>
                  <td className="px-3 py-2 text-right text-xs">{p.length ? p.join(" ") : d.status === "DRAF" && !inboundDoc ? "FIFO saat posting" : "—"}</td>
                  <td className="px-3 py-2 text-right">{v === null ? "—" : fmtRp(v)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-medium">
            <tr><td colSpan={4} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{fmtRp(total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {d.status === "DRAF" && canEdit && <DraftActions docId={d.id} />}
      {d.status === "DIPOSTING" && canCancel && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Dokumen yang sudah diposting tidak bisa diubah. Bila salah, batalkan lalu buat dokumen baru.</p>
          <CancelAction docId={d.id} />
        </div>
      )}
      {d.status !== "DRAF" && (
        <a href={`/cetak/dokumen/${d.id}`} target="_blank" rel="noreferrer" className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
          Cetak {d.kind === "PENYALURAN" ? "BAST" : d.kind === "PENERIMAAN" || d.kind === "SALDO_AWAL" ? "kartu penerimaan" : "berita acara"}
        </a>
      )}
    </div>
  );
}
