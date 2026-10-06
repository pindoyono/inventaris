import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { stockBalances, supplyItems, uoms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { fmtNum, fmtRp, parseDec } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Persediaan" };

export default async function PersediaanPage({ searchParams }: PageProps<"/persediaan">) {
  const s = await pageSchoolUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const filter = typeof sp.f === "string" ? sp.f : "";
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);

  const rows = await withSchool(s.schoolId, (tx) => {
    const conds: SQL[] = [];
    if (q) {
      const esc = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      conds.push(or(ilike(supplyItems.name, esc), ilike(supplyItems.nusp, esc), ilike(supplyItems.spec, esc))!);
    }
    if (filter !== "nonaktif") conds.push(eq(supplyItems.isActive, true));
    const totalQty = sql<string>`coalesce(sum(${stockBalances.qty}), 0)`;
    return tx
      .select({
        id: supplyItems.id,
        nusp: supplyItems.nusp,
        name: supplyItems.name,
        spec: supplyItems.spec,
        uom: uoms.name,
        minStock: supplyItems.minStock,
        isActive: supplyItems.isActive,
        qty: totalQty,
        value: sql<string>`coalesce(sum(${stockBalances.value}), 0)`,
      })
      .from(supplyItems)
      .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .leftJoin(stockBalances, eq(stockBalances.itemId, supplyItems.id))
      .where(and(...conds))
      .groupBy(supplyItems.id, uoms.name)
      .having(filter === "menipis" ? sql`coalesce(sum(${stockBalances.qty}), 0) <= ${supplyItems.minStock}` : undefined)
      .orderBy(asc(supplyItems.name))
      .limit(500);
  });
  const totalValue = rows.reduce((a, r) => a + parseDec(r.value), 0n);

  return (
    <div>
      <PageTitle
        title="Barang persediaan"
        desc="Barang habis pakai, dicatat per spesifikasi (NUSP) dengan metode FIFO sesuai Permendagri 47/2021."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Cari nama, NUSP, spesifikasi" className="min-w-56 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="f" defaultValue={filter} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Barang aktif</option>
            <option value="menipis">Stok menipis</option>
            <option value="nonaktif">Termasuk nonaktif</option>
          </select>
          <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">Tampilkan</button>
        </form>
        {canEdit && (
          <>
            <Link href="/persediaan/dokumen/baru?jenis=SALDO_AWAL" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Saldo awal</Link>
            <Link href="/persediaan/barang/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Barang</Link>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">NUSP</th>
              <th className="px-3 py-2 font-medium">Nama / spesifikasi</th>
              <th className="px-3 py-2 text-right font-medium">Stok</th>
              <th className="px-3 py-2 font-medium">Satuan</th>
              <th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  {q || filter ? "Tidak ada barang yang cocok." : "Belum ada barang persediaan. Mulai dengan menambah barang, lalu isi saldo awal."}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const low = Number(r.qty) <= Number(r.minStock) && Number(r.minStock) > 0;
              return (
                <tr key={r.id} className={r.isActive ? "" : "text-slate-400"}>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.nusp}</td>
                  <td className="px-3 py-2">
                    <Link href={`/persediaan/barang/${r.id}`} className="font-medium text-teal-800 hover:underline">{r.name}</Link>
                    {r.spec && <span className="block text-xs text-slate-500">{r.spec}</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {fmtNum(r.qty)}
                    {low && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">menipis</span>}
                  </td>
                  <td className="px-3 py-2">{r.uom}</td>
                  <td className="px-3 py-2 text-right">{fmtRp(r.value)}</td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right">Total nilai persediaan</td>
                <td className="px-3 py-2 text-right">{fmtRp(totalValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
