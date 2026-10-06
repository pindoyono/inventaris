import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { fundingSources, stockDocLines, stockDocs, stockMovements, supplyItems, supplyRequests, units, uoms, users, vendors, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext, type Signer } from "@/lib/server/print";
import { fmtNum, fmtRp, mulDec, parseDec } from "@/lib/decimal";
import { tanggalBA, tanggalPanjang } from "@/lib/terbilang";
import { ACQUISITION_LABEL } from "@/lib/assets-shared";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak Dokumen" };
const fmtD = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "-");

export default async function CetakDokumen({ params }: PageProps<"/cetak/dokumen/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const toWh = alias(warehouses, "to_wh");
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx
      .select({ d: stockDocs, wh: warehouses.name, toWh: toWh.name, unit: units.name, vendor: vendors.name, fs: fundingSources.name })
      .from(stockDocs)
      .innerJoin(warehouses, eq(warehouses.id, stockDocs.warehouseId))
      .leftJoin(toWh, eq(toWh.id, stockDocs.toWarehouseId))
      .leftJoin(units, eq(units.id, stockDocs.unitId))
      .leftJoin(vendors, eq(vendors.id, stockDocs.vendorId))
      .leftJoin(fundingSources, eq(fundingSources.id, stockDocs.fundingSourceId))
      .where(eq(stockDocs.id, id));
    if (!h || h.d.status === "DRAF") return null;
    const lines = await tx
      .select({ l: stockDocLines, nusp: supplyItems.nusp, name: supplyItems.name, spec: supplyItems.spec, uom: uoms.name })
      .from(stockDocLines).innerJoin(supplyItems, eq(supplyItems.id, stockDocLines.itemId)).innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .where(eq(stockDocLines.docId, id)).orderBy(asc(stockDocLines.lineNo));
    const moves = await tx.select().from(stockMovements).where(eq(stockMovements.docId, id)).orderBy(asc(stockMovements.id));
    let receiver: Signer & { jabatan: string } = { name: h.unit, nip: null, jabatan: h.unit ? `Wakil ${h.unit}` : "Penerima" };
    let sppb: string | null = null;
    if (h.d.requestId) {
      const [r] = await tx.select({ sppb: supplyRequests.sppbNumber, by: users.name, nip: users.nip }).from(supplyRequests).leftJoin(users, eq(users.id, supplyRequests.requestedBy)).where(eq(supplyRequests.id, h.d.requestId));
      if (r) { receiver = { name: r.by, nip: r.nip, jabatan: h.unit ?? "Penerima" }; sppb = r.sppb; }
    }
    return { ...h, lines, moves, receiver, sppb, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { d, c, lines, moves } = data;
  const tgl = tanggalPanjang(d.date);
  // nilai keluar per barang dari buku besar (FIFO, bukan pembalik)
  const outOf = (itemId: string) => moves.filter((m) => m.itemId === itemId && m.kind !== "PEMBALIK" && m.kind !== "MUTASI_MASUK" && Number(m.qtyOut) > 0);
  const cancelled = d.status === "DIBATALKAN" ? <p className="catatan sementara">DOKUMEN INI TELAH DIBATALKAN pada {d.cancelledAt?.toLocaleDateString("id-ID")}: {d.cancelReason}</p> : null;

  if (d.kind === "PENERIMAAN" || d.kind === "SALDO_AWAL") {

    return (
      <Halaman judul="Kartu Penerimaan" ket="Format II.I.3 — penerimaan persediaan" orientasi="lanskap">
        <Kop c={c} />
        <Judul title={d.kind === "SALDO_AWAL" ? "Kartu Penerimaan Barang Persediaan (Saldo Awal)" : "Kartu Penerimaan Barang Persediaan"} nomor={<>(Buku Penerimaan Persediaan) · Nomor: {d.number}</>} />
        <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Tanggal", tgl], ["Cara Perolehan", d.kind === "SALDO_AWAL" ? "Saldo awal" : (ACQUISITION_LABEL[d.acquisition ?? ""] ?? d.acquisition ?? "-")]]} />
        <Tabel cols={13} head={<>
          <tr><th rowSpan={2}>No</th><th rowSpan={2}>Tanggal<br />Terima</th><th rowSpan={2}>Dari / Penyedia</th><th colSpan={2}>Dokumen Sumber</th><th rowSpan={2}>NUSP</th><th rowSpan={2}>Nama / Spesifikasi Barang</th>
            <th rowSpan={2}>Jumlah</th><th rowSpan={2}>Satuan</th><th rowSpan={2}>Harga Satuan<br />(Rp)</th><th rowSpan={2}>Jumlah Harga<br />(Rp)</th><th rowSpan={2}>Sumber Dana</th><th rowSpan={2}>Gudang</th></tr>
          <tr><th>Nomor</th><th>Tanggal</th></tr></>}
          foot={<tr className="jumlah"><td colSpan={10} className="angka">JUMLAH</td><td className="angka">{fmtRp(lines.reduce((a, { l }) => a + mulDec(parseDec(l.qty), parseDec(l.unitPrice ?? "0")), 0n))}</td><td colSpan={2} /></tr>}>
          {lines.map(({ l, nusp, name, spec, uom }, i) => {
            const v = mulDec(parseDec(l.qty), parseDec(l.unitPrice ?? "0"));

            return (
              <tr key={l.id}>
                <td className="tengah">{i + 1}</td><td className="tengah">{fmtD(d.date)}</td><td className="unit">{data.vendor ?? (d.kind === "SALDO_AWAL" ? "Saldo awal" : "-")}</td>
                <td className="tengah">{d.refNumber ?? "-"}</td><td className="tengah">{fmtD(d.refDate)}</td><td className="kode">{nusp}</td>
                <td className="nama">{name}{spec ? ` — ${spec}` : ""}</td><td className="angka">{fmtNum(l.qty)}</td><td className="tengah">{uom}</td>
                <td className="angka">{fmtRp(l.unitPrice ?? "0")}</td><td className="angka">{fmtRp(v)}</td><td className="tengah">{data.fs ?? "-"}</td><td className="tengah">{data.wh}</td>
              </tr>
            );
          })}
        </Tabel>
        {cancelled}
        <Ttd c={c} tanggal={tgl} cols={[kepsekCol(c), pengurusCol(c)]} />
      </Halaman>
    );
  }

  if (d.kind === "PENYALURAN") {
    const b = tanggalBA(d.date);
    return (
      <Halaman judul="Berita Acara Serah Terima" ket="Format II.I.9 — penyaluran persediaan">
        <Kop c={c} />
        <Judul title="Berita Acara Serah Terima" nomor={<>Nomor: {d.number}</>} />
        <p className="paragraf">Pada hari ini <b>{b.hari}</b> tanggal <b>{b.tanggal}</b> bulan <b>{b.bulan}</b> tahun <b>{b.tahun}</b>, yang bertanda tangan di bawah ini:</p>
        <Identitas rows={[
          ["1. Nama", <>{c.pengurus.name ?? "-"}{c.pengurus.nip ? ` (NIP. ${c.pengurus.nip})` : ""}</>],
          ["    Jabatan", <>Pengurus Barang Pembantu — selanjutnya disebut <b>PIHAK PERTAMA</b></>],
          ["2. Nama", <>{data.receiver.name ?? "-"}{data.receiver.nip ? ` (NIP. ${data.receiver.nip})` : ""}</>],
          ["    Jabatan", <>{data.receiver.jabatan} — selanjutnya disebut <b>PIHAK KEDUA</b></>],
        ]} />
        <p className="paragraf">{data.sppb ? <>Berdasarkan Surat Perintah Penyaluran Barang Nomor {data.sppb}, </> : null}PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA{data.unit ? ` (${data.unit})` : ""} barang persediaan dari {data.wh} sebagai berikut:</p>
        <Tabel cols={7} head={<tr><th>No</th><th>NUSP</th><th>Nama / Spesifikasi Barang</th><th>Jumlah</th><th>Satuan</th><th>Nilai (Rp, FIFO)</th><th>Keterangan</th></tr>}>
          {lines.map(({ l, nusp, name, spec, uom }, i) => (
            <tr key={l.id}><td className="tengah">{i + 1}</td><td className="kode">{nusp}</td><td>{name}{spec ? ` — ${spec}` : ""}</td><td className="angka">{fmtNum(l.qty)}</td><td className="tengah">{uom}</td>
              <td className="angka">{fmtRp(outOf(l.itemId).reduce((a, m) => a + parseDec(m.value), 0n))}</td><td>{l.note ?? "Baik"}</td></tr>
          ))}
        </Tabel>
        <p className="paragraf" style={{ marginTop: "3mm" }}>Barang tersebut telah diterima PIHAK KEDUA dalam keadaan baik dan lengkap untuk dipergunakan sebagaimana mestinya.</p>
        {cancelled}
        <Ttd c={c} tanggal={b.panjang} cols={[{ jabatan: <>PIHAK KEDUA<br />Yang Menerima</>, signer: data.receiver }, { jabatan: <>PIHAK PERTAMA<br />Yang Menyerahkan</>, signer: c.pengurus }]} />
        <Ttd c={c} tanggal={b.panjang} kotaDi={null} cols={[kepsekCol(c)]} />
      </Halaman>
    );
  }

  // Mutasi, penyesuaian, rusak/usang: berita acara umum
  const titles: Record<string, [string, string]> = {
    MUTASI: ["Berita Acara Mutasi Barang Persediaan", `dari ${data.wh} ke ${data.toWh ?? "-"}`],
    PENYESUAIAN_TAMBAH: ["Berita Acara Penyesuaian Persediaan (Tambah)", "hasil inventarisasi fisik / stock opname"],
    PENYESUAIAN_KURANG: ["Berita Acara Penyesuaian Persediaan (Kurang)", "hasil inventarisasi fisik / stock opname"],
    RUSAK_USANG: ["Berita Acara Perubahan Fisik Barang Persediaan", "persediaan rusak berat/usang (Permendagri 47/2021 Pasal 38)"],
  };
  const [title, sub] = titles[d.kind];
  const b = tanggalBA(d.date);
  return (
    <Halaman judul={title} ket={sub}>
      <Kop c={c} />
      <Judul title={title} nomor={<>Nomor: {d.number}</>} />
      <p className="paragraf">Pada hari ini <b>{b.hari}</b> tanggal <b>{b.tanggal}</b> bulan <b>{b.bulan}</b> tahun <b>{b.tahun}</b>, telah dilakukan {d.kind === "MUTASI" ? `pemindahan barang persediaan ${sub}` : d.kind === "RUSAK_USANG" ? `pemeriksaan fisik dan barang persediaan di ${data.wh} berikut dinyatakan rusak berat/usang sehingga dikeluarkan dari persediaan` : `penyesuaian saldo persediaan ${data.wh} ${sub}`} dengan rincian:</p>
      <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Gudang", d.kind === "MUTASI" ? `${data.wh} → ${data.toWh}` : data.wh], ...(d.note ? [["Keterangan", d.note] as [string, string]] : [])]} />
      <Tabel cols={7} head={<tr><th>No</th><th>NUSP</th><th>Nama / Spesifikasi Barang</th><th>Jumlah</th><th>Satuan</th><th>Harga (Rp)</th><th>Nilai (Rp)</th></tr>}
        foot={<tr className="jumlah"><td colSpan={6} className="angka">JUMLAH</td><td className="angka">{fmtRp(moves.filter((m) => m.kind !== "PEMBALIK" && m.kind !== "MUTASI_MASUK").reduce((a, m) => a + parseDec(m.value), 0n))}</td></tr>}>
        {lines.map(({ l, nusp, name, spec, uom }, i) => {
          const ms = moves.filter((m) => m.itemId === l.itemId && m.kind !== "PEMBALIK" && m.kind !== "MUTASI_MASUK");
          return (
            <tr key={l.id}><td className="tengah">{i + 1}</td><td className="kode">{nusp}</td><td>{name}{spec ? ` — ${spec}` : ""}</td><td className="angka">{fmtNum(l.qty)}</td><td className="tengah">{uom}</td>
              <td className="angka">{ms.length > 1 ? ms.map((m) => `${fmtNum(Number(m.qtyIn) || Number(m.qtyOut))}×${fmtRp(m.unitPrice)}`).join(" ") : fmtRp(ms[0]?.unitPrice ?? "0")}</td>
              <td className="angka">{fmtRp(ms.reduce((a, m) => a + parseDec(m.value), 0n))}</td></tr>
          );
        })}
      </Tabel>
      {cancelled}
      <Ttd c={c} tanggal={b.panjang} cols={[kepsekCol(c), pengurusCol(c)]} />
    </Halaman>
  );
}
