import type { Metadata } from "next";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { fundingSources, stockDocLines, stockDocs, stockMovements, supplyItems, supplyRequests, units, uoms, vendors, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { fmtNum, fmtRp, mulDec, parseDec } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";
import { endOrToday, printPeriod } from "../params";

export const metadata: Metadata = { title: "Cetak Buku Penerimaan/Pengeluaran" };
const fmtD = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "-");

/** ?jenis=penerimaan|pengeluaran — Kartu Penerimaan (II.I.3) / Kartu Pengeluaran (II.I.4 & II.I.10) per periode */
export default async function CetakBuku({ searchParams }: PageProps<"/cetak/buku">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const today = todayWita();
  const per = printPeriod(sp, today);
  const keluar = sp.jenis === "pengeluaran";
  const whFilter = typeof sp.gudang === "string" && /^[0-9a-f-]{36}$/.test(sp.gudang) ? sp.gudang : null;
  const data = await withSchool(s.schoolId, async (tx) => {
    const kinds = keluar ? (["PENYALURAN"] as const) : (["SALDO_AWAL", "PENERIMAAN"] as const);
    const unit = alias(units, "unit");
    const rows = await tx
      .select({ d: stockDocs, l: stockDocLines, nusp: supplyItems.nusp, name: supplyItems.name, spec: supplyItems.spec, uom: uoms.name, wh: warehouses.name, vendor: vendors.name, fs: fundingSources.name, unit: unit.name, sppb: supplyRequests.sppbNumber, purpose: supplyRequests.purpose })
      .from(stockDocLines)
      .innerJoin(stockDocs, eq(stockDocs.id, stockDocLines.docId))
      .innerJoin(supplyItems, eq(supplyItems.id, stockDocLines.itemId))
      .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .innerJoin(warehouses, eq(warehouses.id, stockDocs.warehouseId))
      .leftJoin(vendors, eq(vendors.id, stockDocs.vendorId))
      .leftJoin(fundingSources, eq(fundingSources.id, stockDocs.fundingSourceId))
      .leftJoin(unit, eq(unit.id, stockDocs.unitId))
      .leftJoin(supplyRequests, eq(supplyRequests.id, stockDocs.requestId))
      .where(and(inArray(stockDocs.kind, [...kinds]), eq(stockDocs.status, "DIPOSTING"), gte(stockDocs.date, per.from), lte(stockDocs.date, per.to), whFilter ? eq(stockDocs.warehouseId, whFilter) : undefined))
      .orderBy(asc(stockDocs.date), asc(stockDocs.number), asc(stockDocLines.lineNo));
    const docIds = [...new Set(rows.map((r) => r.d.id))];
    const moves = keluar && docIds.length ? await tx.select().from(stockMovements).where(inArray(stockMovements.docId, docIds)) : [];
    const [wh] = whFilter ? await tx.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.id, whFilter)) : [];
    return { rows, moves, whName: wh?.name ?? "Semua gudang", c: await loadPrintContext(tx, s.schoolId) };
  });
  const { c, rows, moves } = data;
  const outMoves = (docId: string, itemId: string) => moves.filter((m) => m.docId === docId && m.itemId === itemId && m.kind === "PENYALURAN");
  const lines = rows.map((r) => {
    if (!keluar) return { r, v: mulDec(parseDec(r.l.qty), parseDec(r.l.unitPrice ?? "0")), harga: fmtRp(r.l.unitPrice ?? "0") };
    const ms = outMoves(r.d.id, r.l.itemId);
    return { r, v: ms.reduce((a, m) => a + parseDec(m.value), 0n), harga: ms.length > 1 ? ms.map((m) => `${fmtNum(m.qtyOut)}×${fmtRp(m.unitPrice)}`).join(" ") : fmtRp(ms[0]?.unitPrice ?? "0") };
  });
  const total = lines.reduce((a, x) => a + x.v, 0n);
  const tgl = tanggalPanjang(endOrToday(per.to, today));
  return (
    <Halaman judul={keluar ? "Kartu Pengeluaran" : "Kartu Penerimaan"} ket={keluar ? "Format II.I.4 & II.I.10 — nilai keluar FIFO" : "Format II.I.3 — rekap penerimaan persediaan"} orientasi="lanskap" rapat>
      <Kop c={c} />
      <Judul title={keluar ? "Kartu Pengeluaran Barang Persediaan" : "Kartu Penerimaan Barang Persediaan"} nomor={keluar ? "(Buku Pengeluaran / Penyaluran Persediaan)" : "(Buku Penerimaan Persediaan)"} />
      <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Gudang", data.whName], ["Periode", per.label]]} />
      {keluar ? (
        <Tabel cols={12} head={<>
          <tr><th rowSpan={2}>No</th><th rowSpan={2}>Tanggal<br />Keluar</th><th colSpan={2}>Dokumen</th><th rowSpan={2}>Unit / Penerima</th><th rowSpan={2}>NUSP</th><th rowSpan={2}>Nama / Spesifikasi Barang</th>
            <th rowSpan={2}>Jumlah</th><th rowSpan={2}>Satuan</th><th rowSpan={2}>Harga Satuan<br />(Rp, FIFO)</th><th rowSpan={2}>Jumlah Harga<br />(Rp)</th><th rowSpan={2}>Untuk Keperluan</th></tr>
          <tr><th>No. SPPB</th><th>No. BAST</th></tr></>}
          foot={<tr className="jumlah"><td colSpan={10} className="angka">JUMLAH</td><td className="angka">{fmtRp(total)}</td><td /></tr>}>
          {lines.map(({ r, v, harga }, i) => (
            <tr key={r.l.id}><td className="tengah">{i + 1}</td><td className="tengah">{fmtD(r.d.date)}</td><td className="tengah">{r.sppb ?? "-"}</td><td className="tengah">{r.d.number}</td>
              <td className="unit">{r.unit ?? "-"}</td><td className="kode">{r.nusp}</td><td className="nama">{r.name}{r.spec ? ` — ${r.spec}` : ""}</td><td className="angka">{fmtNum(r.l.qty)}</td><td className="tengah">{r.uom}</td>
              <td className="angka">{harga}</td><td className="angka">{fmtRp(v)}</td><td className="unit">{r.purpose ?? r.d.note ?? "-"}</td></tr>
          ))}
          {lines.length === 0 && <tr className="kosong"><td colSpan={12} className="tengah">Tidak ada pengeluaran pada periode ini</td></tr>}
        </Tabel>
      ) : (
        <Tabel cols={13} head={<>
          <tr><th rowSpan={2}>No</th><th rowSpan={2}>Tanggal<br />Terima</th><th rowSpan={2}>Dari / Penyedia</th><th colSpan={2}>Dokumen Sumber</th><th rowSpan={2}>NUSP</th><th rowSpan={2}>Nama / Spesifikasi Barang</th>
            <th rowSpan={2}>Jumlah</th><th rowSpan={2}>Satuan</th><th rowSpan={2}>Harga Satuan<br />(Rp)</th><th rowSpan={2}>Jumlah Harga<br />(Rp)</th><th rowSpan={2}>Sumber Dana</th><th rowSpan={2}>Gudang</th></tr>
          <tr><th>Nomor</th><th>Tanggal</th></tr></>}
          foot={<tr className="jumlah"><td colSpan={10} className="angka">JUMLAH</td><td className="angka">{fmtRp(total)}</td><td colSpan={2} /></tr>}>
          {lines.map(({ r, v, harga }, i) => (
            <tr key={r.l.id}><td className="tengah">{i + 1}</td><td className="tengah">{fmtD(r.d.date)}</td><td className="unit">{r.vendor ?? (r.d.kind === "SALDO_AWAL" ? "Saldo awal" : "-")}</td>
              <td className="tengah">{r.d.refNumber ?? r.d.number}</td><td className="tengah">{fmtD(r.d.refDate ?? r.d.date)}</td><td className="kode">{r.nusp}</td><td className="nama">{r.name}{r.spec ? ` — ${r.spec}` : ""}</td>
              <td className="angka">{fmtNum(r.l.qty)}</td><td className="tengah">{r.uom}</td><td className="angka">{harga}</td><td className="angka">{fmtRp(v)}</td><td className="tengah">{r.fs ?? "-"}</td><td className="tengah">{r.wh}</td></tr>
          ))}
          {lines.length === 0 && <tr className="kosong"><td colSpan={13} className="tengah">Tidak ada penerimaan pada periode ini</td></tr>}
        </Tabel>
      )}
      <Ttd c={c} tanggal={tgl} cols={[kepsekCol(c), pengurusCol(c)]} />
    </Halaman>
  );
}
