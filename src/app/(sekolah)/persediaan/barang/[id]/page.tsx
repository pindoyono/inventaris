import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { stockBalances, stockLots, stockMovements, supplyItems, uoms, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { fmtNum, fmtRp, parseDec } from "@/lib/decimal";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { bmdName } from "../load";

export const metadata: Metadata = { title: "Barang Persediaan" };

const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

/** Periode kartu: semester (Permendagri 47/2021: opname tiap semester) atau setahun */
function period(year: number, sem: string) {
  if (sem === "1") return { from: `${year}-01-01`, to: `${year}-06-30`, label: `Semester I Tahun ${year}` };
  if (sem === "2") return { from: `${year}-07-01`, to: `${year}-12-31`, label: `Semester II Tahun ${year}` };
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Tahun ${year}` };
}

export default async function BarangPage({ params, searchParams }: PageProps<"/persediaan/barang/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const s = await pageSchoolUser();
  const today = todayWita();
  const year = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? Number(sp.tahun) : Number(today.slice(0, 4));
  const sem = typeof sp.semester === "string" && ["1", "2", "0"].includes(sp.semester) ? sp.semester : Number(today.slice(5, 7)) <= 6 ? "1" : "2";
  const per = period(year, sem);

  const data = await withSchool(s.schoolId, async (tx) => {
    const [row] = await tx.select({ item: supplyItems, uom: uoms.name }).from(supplyItems).innerJoin(uoms, eq(uoms.id, supplyItems.uomId)).where(eq(supplyItems.id, id));
    if (!row) return null;
    const whs = await tx.select({ id: warehouses.id, name: warehouses.name, isDefault: warehouses.isDefault }).from(warehouses).orderBy(asc(warehouses.name));
    const bals = await tx.select().from(stockBalances).where(eq(stockBalances.itemId, id));
    const pick = typeof sp.gudang === "string" && whs.some((w) => w.id === sp.gudang) ? sp.gudang : (bals.find((b) => Number(b.qty) > 0)?.warehouseId ?? whs.find((w) => w.isDefault)?.id ?? whs[0]?.id);
    const where = and(eq(stockMovements.itemId, id), eq(stockMovements.warehouseId, pick!));
    const [opening] = await tx.select().from(stockMovements).where(and(where, lt(stockMovements.date, per.from))).orderBy(desc(stockMovements.date), desc(stockMovements.id)).limit(1);
    const moves = await tx
      .select()
      .from(stockMovements)
      .where(and(where, gte(stockMovements.date, per.from), lte(stockMovements.date, per.to)))
      .orderBy(asc(stockMovements.id));
    const lots = await tx
      .select()
      .from(stockLots)
      .where(and(eq(stockLots.itemId, id), eq(stockLots.warehouseId, pick!)))
      .orderBy(asc(stockLots.receivedDate), asc(stockLots.createdAt));
    return { ...row, bmdName: await bmdName(tx, row.item.bmdCode), whs, bals, pick, opening, moves, lots: lots.filter((l) => Number(l.qtyLeft) > 0) };
  });
  if (!data) notFound();
  const { item, uom, whs, bals, pick, opening, moves, lots } = data;

  // Kelompokkan baris buku besar per dokumen (satu dokumen keluar bisa mengambil beberapa lot FIFO)
  type Row = { docId: string; date: string; number: string; desc: string; inQ: bigint; outQ: bigint; inV: bigint; outV: bigint; prices: string[]; balQ: string; balV: string };
  const rows: Row[] = [];
  for (const m of moves) {
    const last = rows.at(-1);
    const isIn = Number(m.qtyIn) > 0;
    const r: Row =
      last && last.docId === m.docId && last.desc === (m.description ?? "") && (isIn ? last.outQ === 0n : last.inQ === 0n)
        ? last
        : (rows.push({ docId: m.docId, date: m.date, number: m.docNumber, desc: m.description ?? "", inQ: 0n, outQ: 0n, inV: 0n, outV: 0n, prices: [], balQ: "", balV: "" }), rows.at(-1)!);
    const q = parseDec(isIn ? m.qtyIn : m.qtyOut);
    if (isIn) { r.inQ += q; r.inV += parseDec(m.value); } else { r.outQ += q; r.outV += parseDec(m.value); }
    r.prices.push(`${fmtNum(q)}×${fmtRp(m.unitPrice)}`);
    r.balQ = m.balanceQty;
    r.balV = m.balanceValue;
  }
  const priceCell = (r: Row) => (r.prices.length === 1 ? fmtRp(moves.find((m) => m.docId === r.docId)!.unitPrice) : r.prices.join(" "));
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const totalQty = bals.reduce((a, b) => a + parseDec(b.qty), 0n);
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ gudang: pick ?? "", tahun: String(year), semester: sem, ...o })}`;

  return (
    <div className="space-y-6">
      <PageTitle title={item.name} desc={item.spec ?? undefined} back={{ href: "/persediaan", label: "Persediaan" }} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm md:col-span-2">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1">
            <dt className="text-slate-500">NUSP</dt><dd className="font-mono">{item.nusp}</dd>
            <dt className="text-slate-500">Kode barang</dt><dd><span className="font-mono">{item.bmdCode}</span> — {data.bmdName}</dd>
            <dt className="text-slate-500">Satuan</dt><dd>{uom}</dd>
            <dt className="text-slate-500">Stok minimum</dt><dd>{fmtNum(item.minStock)}</dd>
            <dt className="text-slate-500">Status</dt><dd>{item.isActive ? "Aktif" : "Nonaktif"}</dd>
          </dl>
          {canEdit && <Link href={`/persediaan/barang/${item.id}/ubah`} className="mt-3 inline-block text-teal-700 hover:underline">Ubah data barang</Link>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="text-2xl font-semibold">{fmtNum(totalQty)} <span className="text-base font-normal text-slate-500">{uom}</span></div>
          <ul className="mt-2 space-y-0.5 text-slate-600">
            {bals.filter((b) => Number(b.qty) > 0).map((b) => (
              <li key={b.warehouseId} className="flex justify-between"><span>{whs.find((w) => w.id === b.warehouseId)?.name}</span><span>{fmtNum(b.qty)} · Rp{fmtRp(b.value)}</span></li>
            ))}
            {totalQty === 0n && <li>Belum ada stok.</li>}
          </ul>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="font-semibold">Kartu Barang Persediaan</h2>
            <p className="text-sm text-slate-600">{whs.find((w) => w.id === pick)?.name} · {per.label} · FIFO</p>
          </div>
          <form className="flex flex-wrap gap-2 text-sm">
            <select name="gudang" defaultValue={pick} className="rounded-md border border-slate-300 px-2 py-1.5">
              {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select name="semester" defaultValue={sem} className="rounded-md border border-slate-300 px-2 py-1.5">
              <option value="1">Semester I</option>
              <option value="2">Semester II</option>
              <option value="0">Setahun</option>
            </select>
            <input name="tahun" defaultValue={year} className="w-20 rounded-md border border-slate-300 px-2 py-1.5" inputMode="numeric" />
            <button className="rounded-md border border-slate-300 px-3 py-1.5">Tampilkan</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th rowSpan={2} className="px-2 py-1 text-left font-medium">Tanggal</th>
                <th rowSpan={2} className="px-2 py-1 text-left font-medium">No. dokumen</th>
                <th rowSpan={2} className="px-2 py-1 text-left font-medium">Uraian</th>
                <th colSpan={3} className="border-l border-slate-200 px-2 py-1 font-medium">Masuk</th>
                <th colSpan={3} className="border-l border-slate-200 px-2 py-1 font-medium">Keluar</th>
                <th colSpan={2} className="border-l border-slate-200 px-2 py-1 font-medium">Saldo</th>
              </tr>
              <tr className="text-xs">
                <th className="border-l border-slate-200 px-2 py-1 text-right font-medium">Jml</th><th className="px-2 py-1 text-right font-medium">Harga</th><th className="px-2 py-1 text-right font-medium">Jumlah</th>
                <th className="border-l border-slate-200 px-2 py-1 text-right font-medium">Jml</th><th className="px-2 py-1 text-right font-medium">Harga</th><th className="px-2 py-1 text-right font-medium">Jumlah</th>
                <th className="border-l border-slate-200 px-2 py-1 text-right font-medium">Jml</th><th className="px-2 py-1 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="text-slate-500">
                <td className="px-2 py-1">{fmtDate(per.from)}</td><td /><td className="px-2 py-1 italic">Saldo sebelumnya</td>
                <td colSpan={6} />
                <td className="border-l border-slate-200 px-2 py-1 text-right">{fmtNum(opening?.balanceQty ?? "0")}</td>
                <td className="px-2 py-1 text-right">{fmtRp(opening?.balanceValue ?? "0")}</td>
              </tr>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-2 py-1 whitespace-nowrap"><Link href={`/persediaan/dokumen/${r.docId}`} className="text-teal-700 hover:underline">{r.number}</Link></td>
                  <td className="px-2 py-1">{r.desc}</td>
                  <td className="border-l border-slate-200 px-2 py-1 text-right">{r.inQ ? fmtNum(r.inQ) : ""}</td>
                  <td className="px-2 py-1 text-right text-xs">{r.inQ ? priceCell(r) : ""}</td>
                  <td className="px-2 py-1 text-right">{r.inQ ? fmtRp(r.inV) : ""}</td>
                  <td className="border-l border-slate-200 px-2 py-1 text-right">{r.outQ ? fmtNum(r.outQ) : ""}</td>
                  <td className="px-2 py-1 text-right text-xs">{r.outQ ? priceCell(r) : ""}</td>
                  <td className="px-2 py-1 text-right">{r.outQ ? fmtRp(r.outV) : ""}</td>
                  <td className="border-l border-slate-200 px-2 py-1 text-right">{fmtNum(r.balQ)}</td>
                  <td className="px-2 py-1 text-right">{fmtRp(r.balV)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={11} className="px-2 py-4 text-center text-slate-500">Tidak ada transaksi pada periode ini.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-slate-200 p-4 text-sm">
          <Link href={qs({ tahun: String(year - 1) })} className="text-teal-700 hover:underline">← {year - 1}</Link>
          <Link href={qs({ tahun: String(year + 1) })} className="text-teal-700 hover:underline">{year + 1} →</Link>
          <span className="text-slate-500">Versi cetak menyusul setelah format 03 disetujui.</span>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Batch FIFO tersisa di gudang ini</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="px-3 py-2 font-medium">Tanggal masuk</th><th className="px-3 py-2 text-right font-medium">Masuk</th><th className="px-3 py-2 text-right font-medium">Sisa</th><th className="px-3 py-2 text-right font-medium">Harga satuan</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-slate-500">Tidak ada.</td></tr>}
              {lots.map((l, i) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">{fmtDate(l.receivedDate)}{i === 0 && <span className="ml-2 rounded bg-teal-100 px-1.5 text-xs text-teal-800">keluar berikutnya</span>}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(l.qtyIn)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(l.qtyLeft)}</td>
                  <td className="px-3 py-2 text-right">{fmtRp(l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
