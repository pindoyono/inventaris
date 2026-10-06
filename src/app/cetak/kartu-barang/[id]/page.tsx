import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { stockMovements, supplyItems, uoms, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { fmtNum, fmtRp, parseDec } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";
import { endOrToday, printPeriod } from "../../params";
import { bmdName } from "@/app/(sekolah)/persediaan/barang/load";

export const metadata: Metadata = { title: "Cetak Kartu Barang Persediaan" };
const fmtD = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function CetakKartuBarang({ params, searchParams }: PageProps<"/cetak/kartu-barang/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const today = todayWita();
  const per = printPeriod(sp, today);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [it] = await tx.select({ i: supplyItems, uom: uoms.name }).from(supplyItems).innerJoin(uoms, eq(uoms.id, supplyItems.uomId)).where(eq(supplyItems.id, id));
    const whId = typeof sp.gudang === "string" ? sp.gudang : "";
    const [wh] = await tx.select().from(warehouses).where(eq(warehouses.id, whId));
    if (!it || !wh) return null;
    const where = and(eq(stockMovements.itemId, id), eq(stockMovements.warehouseId, wh.id));
    const [opening] = await tx.select().from(stockMovements).where(and(where, lt(stockMovements.date, per.from))).orderBy(desc(stockMovements.date), desc(stockMovements.id)).limit(1);
    const moves = await tx.select().from(stockMovements).where(and(where, gte(stockMovements.date, per.from), lte(stockMovements.date, per.to))).orderBy(asc(stockMovements.id));
    return { ...it, wh, opening, moves, codeName: await bmdName(tx, it.i.bmdCode), c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { i, c, moves } = data;
  type Row = { docId: string; date: string; number: string; desc: string; isIn: boolean; q: bigint; v: bigint; parts: string[]; bq: string; bv: string };
  const rows: Row[] = [];
  for (const m of moves) {
    const isIn = Number(m.qtyIn) > 0;
    const last = rows.at(-1);
    const r = last && last.docId === m.docId && last.isIn === isIn && last.desc === (m.description ?? "") ? last
      : (rows.push({ docId: m.docId, date: m.date, number: m.docNumber, desc: m.description ?? "", isIn, q: 0n, v: 0n, parts: [], bq: "", bv: "" }), rows.at(-1)!);
    const q = parseDec(isIn ? m.qtyIn : m.qtyOut);
    r.q += q; r.v += parseDec(m.value); r.parts.push(`${fmtNum(q)}×${fmtRp(m.unitPrice)}`); r.bq = m.balanceQty; r.bv = m.balanceValue;
  }
  const harga = (r: Row) => (r.parts.length === 1 ? r.parts[0].split("×")[1] : r.parts.map((p, k) => <span key={k}>{k > 0 && <br />}{p}</span>));
  return (
    <Halaman judul="Kartu Barang Persediaan" ket="Format II.I.5 — per NUSP per gudang, FIFO" rapat>
      <Kop c={c} />
      <Judul title="Kartu Barang Persediaan" nomor="(Kartu Stok)" />
      <Identitas rows={[
        ["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Gudang", data.wh.name], ["NUSP", <span key="n" style={{ fontFamily: "monospace" }}>{i.nusp}</span>],
        ["Kode Barang", `${i.bmdCode} — ${data.codeName}`], ["Nama / Spesifikasi", `${i.name}${i.spec ? ` — ${i.spec}` : ""}`], ["Satuan", data.uom],
        ["Metode Penilaian", "FIFO (masuk pertama keluar pertama)"], ["Periode", per.label],
      ]} />
      <Tabel cols={12} head={<>
        <tr><th rowSpan={2}>No</th><th rowSpan={2}>Tanggal</th><th rowSpan={2}>No. Dokumen</th><th rowSpan={2}>Uraian</th><th colSpan={3}>Masuk</th><th colSpan={3}>Keluar</th><th colSpan={2}>Saldo</th></tr>
        <tr><th>Jml</th><th>Harga</th><th>Jumlah (Rp)</th><th>Jml</th><th>Harga</th><th>Jumlah (Rp)</th><th>Jml</th><th>Jumlah (Rp)</th></tr></>}>
        <tr><td className="tengah">-</td><td className="tengah">{fmtD(per.from)}</td><td /><td><i>Saldo sebelumnya</i></td><td /><td /><td /><td /><td /><td />
          <td className="angka">{fmtNum(data.opening?.balanceQty ?? "0")}</td><td className="angka">{fmtRp(data.opening?.balanceValue ?? "0")}</td></tr>
        {rows.map((r, k) => (
          <tr key={k}>
            <td className="tengah">{k + 1}</td><td className="tengah">{fmtD(r.date)}</td><td className="tengah">{r.number}</td><td>{r.desc}</td>
            {r.isIn ? <><td className="angka">{fmtNum(r.q)}</td><td className="angka">{harga(r)}</td><td className="angka">{fmtRp(r.v)}</td><td /><td /><td /></>
              : <><td /><td /><td /><td className="angka">{fmtNum(r.q)}</td><td className="angka">{harga(r)}</td><td className="angka">{fmtRp(r.v)}</td></>}
            <td className="angka">{fmtNum(r.bq)}</td><td className="angka">{fmtRp(r.bv)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr className="kosong"><td colSpan={12} className="tengah">Tidak ada mutasi pada periode ini</td></tr>}
      </Tabel>
      <Ttd c={c} tanggal={tanggalPanjang(endOrToday(per.to, today))} cols={[kepsekCol(c), pengurusCol(c)]} />
    </Halaman>
  );
}
