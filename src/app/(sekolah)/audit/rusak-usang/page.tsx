import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { stockDocs, stockMovements, supplyItems, uoms, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { fmtNum, fmtRp, parseDec } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Persediaan Rusak/Usang" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function RusakUsangPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const rows = await withSchool(s.schoolId, (tx) =>
    tx
      .select({ m: stockMovements, name: supplyItems.name, nusp: supplyItems.nusp, uom: uoms.name, wh: warehouses.name, status: stockDocs.status, note: stockDocs.note })
      .from(stockMovements)
      .innerJoin(stockDocs, eq(stockDocs.id, stockMovements.docId))
      .innerJoin(supplyItems, eq(supplyItems.id, stockMovements.itemId))
      .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
      .where(and(eq(stockMovements.kind, "RUSAK_USANG"), eq(stockDocs.status, "DIPOSTING")))
      .orderBy(desc(stockMovements.date), desc(stockMovements.id))
      .limit(500),
  );
  const total = rows.reduce((a, r) => a + parseDec(r.m.value), 0n);
  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle title="Daftar persediaan rusak berat/usang" desc="Persediaan yang dikeluarkan dari stok karena rusak berat/usang (Permendagri 47/2021 Ps. 38), dari stock opname atau Berita Acara Perubahan Fisik." back={{ href: "/audit", label: "Audit" }} />
      {hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) && <Link href="/persediaan/dokumen/baru?jenis=RUSAK_USANG" className="inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">+ Berita acara perubahan fisik</Link>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Dokumen</th><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 font-medium">Gudang</th><th className="px-3 py-2 text-right font-medium">Jumlah</th><th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Belum ada persediaan rusak/usang.</td></tr>}
            {rows.map(({ m, name, nusp, uom, wh }) => (
              <tr key={m.id}>
                <td className="px-3 py-2">{fmtDate(m.date)}</td>
                <td className="px-3 py-2"><Link href={`/persediaan/dokumen/${m.docId}`} className="text-teal-700 hover:underline">{m.docNumber}</Link></td>
                <td className="px-3 py-2">{name}<span className="block font-mono text-xs text-slate-500">{nusp}</span></td>
                <td className="px-3 py-2">{wh}</td>
                <td className="px-3 py-2 text-right">{fmtNum(m.qtyOut)} {uom}</td>
                <td className="px-3 py-2 text-right">{fmtRp(m.value)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && <tfoot className="bg-slate-50 font-medium"><tr><td colSpan={5} className="px-3 py-2 text-right">Jumlah</td><td className="px-3 py-2 text-right">{fmtRp(total)}</td></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
