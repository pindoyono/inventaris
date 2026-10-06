import type { Metadata } from "next";
import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { stockDocLines, stockDocs, units, vendors, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { PageTitle } from "@/components/ui";
import { FORM_KINDS, KIND_LABEL, STATUS_CLASS, STATUS_LABEL } from "./labels";

export const metadata: Metadata = { title: "Dokumen Stok" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function DokumenPage({ searchParams }: PageProps<"/persediaan/dokumen">) {
  const s = await pageSchoolUser();
  const sp = await searchParams;
  const kind = typeof sp.jenis === "string" && sp.jenis in KIND_LABEL ? (sp.jenis as keyof typeof KIND_LABEL) : null;
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? (sp.status as keyof typeof STATUS_LABEL) : null;
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const toWh = alias(warehouses, "to_wh");

  const rows = await withSchool(s.schoolId, (tx) => {
    const conds: SQL[] = [];
    if (kind) conds.push(eq(stockDocs.kind, kind));
    if (status) conds.push(eq(stockDocs.status, status));
    return tx
      .select({
        d: stockDocs,
        wh: warehouses.name,
        toWh: toWh.name,
        unit: units.name,
        vendor: vendors.name,
        lines: sql<number>`(select count(*)::int from ${stockDocLines} where ${stockDocLines.docId} = ${stockDocs.id})`,
      })
      .from(stockDocs)
      .innerJoin(warehouses, eq(warehouses.id, stockDocs.warehouseId))
      .leftJoin(toWh, eq(toWh.id, stockDocs.toWarehouseId))
      .leftJoin(units, eq(units.id, stockDocs.unitId))
      .leftJoin(vendors, eq(vendors.id, stockDocs.vendorId))
      .where(and(...conds))
      .orderBy(desc(stockDocs.date), desc(stockDocs.createdAt))
      .limit(300);
  });

  return (
    <div>
      <PageTitle title="Dokumen stok" desc="Setiap perubahan stok tercatat lewat dokumen. Dokumen yang sudah diposting tidak bisa diubah; koreksi dengan pembatalan." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 flex-wrap gap-2 text-sm">
          <select name="jenis" defaultValue={kind ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Semua jenis</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="rounded-md border border-slate-300 bg-white px-4 py-2">Tampilkan</button>
        </form>
        {canEdit &&
          FORM_KINDS.map((k) => (
            <Link key={k} href={`/persediaan/dokumen/baru?jenis=${k}`} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              + {KIND_LABEL[k]}
            </Link>
          ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Tanggal</th>
              <th className="px-3 py-2 font-medium">Nomor</th>
              <th className="px-3 py-2 font-medium">Jenis</th>
              <th className="px-3 py-2 font-medium">Keterangan</th>
              <th className="px-3 py-2 text-right font-medium">Baris</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Belum ada dokumen.</td></tr>}
            {rows.map(({ d, wh, toWh: tw, unit, vendor, lines }) => (
              <tr key={d.id}>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(d.date)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/persediaan/dokumen/${d.id}`} className="font-medium text-teal-800 hover:underline">{d.number ?? "(draf)"}</Link>
                </td>
                <td className="px-3 py-2">{KIND_LABEL[d.kind]}</td>
                <td className="px-3 py-2 text-slate-600">
                  {wh}
                  {tw ? ` → ${tw}` : ""}
                  {unit ? ` → ${unit}` : ""}
                  {vendor ? ` · ${vendor}` : ""}
                </td>
                <td className="px-3 py-2 text-right">{lines}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLASS[d.status]}`}>{STATUS_LABEL[d.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
