import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { procurementLines, procurements, proposals, vendors } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { fmtRp } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Pengadaan" };
const PROC_LABEL = { DRAF: "Draf", DIPESAN: "Dipesan", DITERIMA_SEBAGIAN: "Diterima sebagian", DITERIMA: "Diterima", DIBATALKAN: "Dibatalkan" } as const;
const CLS = { DRAF: "bg-slate-100 text-slate-700", DIPESAN: "bg-sky-100 text-sky-800", DITERIMA_SEBAGIAN: "bg-amber-100 text-amber-800", DITERIMA: "bg-emerald-100 text-emerald-800", DIBATALKAN: "bg-slate-200 text-slate-500" } as const;
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function PengadaanPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const rows = await withSchool(s.schoolId, (tx) =>
    tx.select({ p: procurements, vendor: vendors.name, usulan: proposals.number, total: sql<string>`(select coalesce(sum(round(${procurementLines.qty} * ${procurementLines.unitPrice}, 2)),0) from ${procurementLines} where ${procurementLines.procurementId} = ${procurements.id})` })
      .from(procurements).leftJoin(vendors, eq(vendors.id, procurements.vendorId)).leftJoin(proposals, eq(proposals.id, procurements.proposalId))
      .orderBy(desc(procurements.createdAt)).limit(300));
  return (
    <div>
      <PageTitle title="Pengadaan barang" desc="Pembelian dari usulan yang disetujui atau langsung. Penerimaan barang otomatis membukukan persediaan (FIFO) dan mencatat aset per unit." />
      <div className="mb-4 flex justify-end"><Link href="/pengadaan/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Pengadaan langsung</Link></div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Nomor</th><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Penyedia</th><th className="px-3 py-2 font-medium">Usulan</th><th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Belum ada pengadaan. Buat dari usulan yang disetujui, atau pengadaan langsung.</td></tr>}
            {rows.map(({ p, vendor, usulan, total }) => (
              <tr key={p.id}><td className="px-3 py-2"><Link href={`/pengadaan/${p.id}`} className="font-medium text-teal-800 hover:underline">{p.number}</Link></td><td className="px-3 py-2">{fmtDate(p.orderDate)}</td><td className="px-3 py-2">{vendor ?? "—"}</td><td className="px-3 py-2">{usulan ?? "langsung"}</td><td className="px-3 py-2 text-right">{fmtRp(total)}</td><td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${CLS[p.status]}`}>{PROC_LABEL[p.status]}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
