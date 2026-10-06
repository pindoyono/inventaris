import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { stockOpnameLines, stockOpnames, supplyItems, uoms, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { opnameDiff } from "@/lib/server/opname";
import { fmtNum } from "@/lib/decimal";
import { tanggalBA } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak BA Stock Opname" };

export default async function CetakOpname({ params }: PageProps<"/cetak/opname/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx.select({ o: stockOpnames, wh: warehouses.name }).from(stockOpnames).innerJoin(warehouses, eq(warehouses.id, stockOpnames.warehouseId)).where(eq(stockOpnames.id, id));
    if (!h) return null;
    const lines = await tx
      .select({ l: stockOpnameLines, nusp: supplyItems.nusp, name: supplyItems.name, uom: uoms.name })
      .from(stockOpnameLines).innerJoin(supplyItems, eq(supplyItems.id, stockOpnameLines.itemId)).innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .where(eq(stockOpnameLines.opnameId, id)).orderBy(asc(supplyItems.nusp));
    return { ...h, lines, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { o, c, lines } = data;
  const b = tanggalBA(o.date);
  return (
    <Halaman judul="Berita Acara Inventarisasi Fisik Persediaan" ket="Permendagri 47/2021 Pasal 39 — stock opname semesteran" rapat>
      <Kop c={c} />
      <Judul title="Berita Acara Inventarisasi Fisik Persediaan" nomor={<>Nomor: {o.number}{o.status !== "DISETUJUI" ? ` (${o.status === "DIBATALKAN" ? "DIBATALKAN" : "BELUM DISETUJUI"})` : ""}</>} />
      <p className="paragraf">Pada hari ini <b>{b.hari}</b> tanggal <b>{b.tanggal}</b> bulan <b>{b.bulan}</b> tahun <b>{b.tahun}</b>, telah dilaksanakan inventarisasi fisik (stock opname) barang persediaan dengan hasil sebagai berikut:</p>
      <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Gudang", data.wh], ...(o.note ? [["Keterangan", o.note] as [string, string]] : [])]} />
      <Tabel cols={9} head={<>
        <tr><th rowSpan={2}>No</th><th rowSpan={2}>NUSP</th><th rowSpan={2}>Nama Barang</th><th rowSpan={2}>Satuan</th><th rowSpan={2}>Menurut<br />Catatan</th><th colSpan={2}>Hasil Fisik</th><th rowSpan={2}>Selisih</th><th rowSpan={2}>Keterangan</th></tr>
        <tr><th>Baik</th><th>Rusak/Usang</th></tr></>}>
        {lines.map(({ l, nusp, name, uom }, i) => {
          const d = opnameDiff(l);
          return (
            <tr key={l.id}><td className="tengah">{i + 1}</td><td className="kode">{nusp}</td><td>{name}</td><td className="tengah">{uom}</td><td className="angka">{fmtNum(l.systemQty)}</td>
              <td className="angka">{l.physicalQty === null ? "" : fmtNum(l.physicalQty)}</td><td className="angka">{Number(l.damagedQty) ? fmtNum(l.damagedQty) : ""}</td>
              <td className="angka">{d === null ? "" : d === 0n ? "-" : `${d > 0n ? "+" : ""}${fmtNum(d)}`}</td><td>{l.note ?? ""}</td></tr>
          );
        })}
      </Tabel>
      <p className="paragraf" style={{ marginTop: "3mm" }}>Selisih kelebihan/kekurangan dibukukan sebagai penyesuaian persediaan, dan barang rusak berat/usang dicatat dalam Daftar Persediaan Rusak Berat/Usang. Berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>
      <Ttd c={c} tanggal={b.panjang} cols={[kepsekCol(c), pengurusCol(c)]} />
    </Halaman>
  );
}
