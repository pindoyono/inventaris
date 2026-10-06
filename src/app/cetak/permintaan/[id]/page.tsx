import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq } from "drizzle-orm";
import { stockDocs, supplyItems, supplyRequestLines, supplyRequests, units, uoms, users, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { fmtNum } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";
import { requestScope } from "@/app/(sekolah)/permintaan/visibility";

export const metadata: Metadata = { title: "Cetak Permintaan" };
const iso = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(d) : null);

/** ?dok=np (Nota Permintaan, II.I.6) | sp (Surat Permintaan Barang, II.I.7) | sppb (II.I.8) */
export default async function CetakPermintaan({ params, searchParams }: PageProps<"/cetak/permintaan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const dok = (await searchParams).dok === "sppb" ? "sppb" : (await searchParams).dok === "sp" ? "sp" : "np";
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const requester = alias(users, "requester");
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx
      .select({ r: supplyRequests, unit: units.name, by: requester.name, nip: requester.nip })
      .from(supplyRequests).innerJoin(units, eq(units.id, supplyRequests.unitId)).leftJoin(requester, eq(requester.id, supplyRequests.requestedBy))
      .where(and(eq(supplyRequests.id, id), await requestScope(tx, s)));
    if (!h || !h.r.number) return null;
    const lines = await tx
      .select({ l: supplyRequestLines, nusp: supplyItems.nusp, name: supplyItems.name, spec: supplyItems.spec, uom: uoms.name })
      .from(supplyRequestLines).innerJoin(supplyItems, eq(supplyItems.id, supplyRequestLines.itemId)).innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .where(eq(supplyRequestLines.requestId, id)).orderBy(asc(supplyRequestLines.lineNo));
    const [doc] = h.r.issueDocId ? await tx.select({ wh: warehouses.name }).from(stockDocs).innerJoin(warehouses, eq(warehouses.id, stockDocs.warehouseId)).where(eq(stockDocs.id, h.r.issueDocId)) : [];
    return { ...h, lines, wh: doc?.wh, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { r, c, lines } = data;
  if ((dok === "sp" && !r.spNumber) || (dok === "sppb" && !r.sppbNumber)) notFound();
  const requesterSigner = { name: data.by, nip: data.nip };

  if (dok === "np") {
    const tgl = tanggalPanjang(iso(r.submittedAt) ?? r.date);
    return (
      <Halaman judul="Nota Permintaan" ket="Format II.I.6 — diajukan oleh pihak yang membutuhkan">
        <Kop c={c} />
        <Judul title="Nota Permintaan Barang" nomor={<>Nomor: {r.number}</>} />
        <Identitas rows={[["Kepada", "Pengurus Barang Pembantu"], ["Dari (Unit)", data.unit], ["Tanggal", tanggalPanjang(r.date)]]} />
        <p className="paragraf">Mohon disediakan barang persediaan sebagai berikut:</p>
        <Tabel cols={5} head={<tr><th>No</th><th>Nama / Spesifikasi Barang</th><th>Jumlah</th><th>Satuan</th><th>Untuk Keperluan</th></tr>}>
          {lines.map(({ l, name, spec, uom }, i) => (
            <tr key={l.id}><td className="tengah">{i + 1}</td><td>{name}{spec ? ` — ${spec}` : ""}</td><td className="angka">{fmtNum(l.qtyRequested)}</td><td className="tengah">{uom}</td><td>{l.note ?? r.purpose ?? "-"}</td></tr>
          ))}
        </Tabel>
        <Ttd c={c} tanggal={tgl} cols={[{ jabatan: <>Mengetahui,<br />Kepala {data.unit}</>, signer: { name: null, nip: null } }, { jabatan: "Yang Meminta", signer: requesterSigner }]} />
      </Halaman>
    );
  }

  const qty = (l: (typeof lines)[number]["l"]) => fmtNum(l.qtyApproved ?? l.qtyRequested);
  if (dok === "sp") {
    return (
      <Halaman judul="Surat Permintaan Barang" ket="Format II.I.7 — Pengurus Barang kepada Kuasa Pengguna Barang">
        <Kop c={c} />
        <Judul title="Surat Permintaan Barang" nomor={<>Nomor: {r.spNumber}</>} />
        <Identitas rows={[["Kepada", "Kepala Sekolah selaku Kuasa Pengguna Barang"], ["Dari", "Pengurus Barang Pembantu"], ["Perihal", `Permintaan barang persediaan untuk ${data.unit}`]]} />
        <p className="paragraf">Berdasarkan Nota Permintaan Nomor {r.number} tanggal {tanggalPanjang(r.date)} dari {data.unit}, dengan ini kami mohon persetujuan penyaluran barang persediaan sebagai berikut:</p>
        <Tabel cols={6} head={<tr><th>No</th><th>NUSP</th><th>Nama / Spesifikasi Barang</th><th>Diminta</th><th>Diusulkan Disalurkan</th><th>Satuan</th></tr>}>
          {lines.map(({ l, nusp, name, spec, uom }, i) => (
            <tr key={l.id}><td className="tengah">{i + 1}</td><td className="kode">{nusp}</td><td>{name}{spec ? ` — ${spec}` : ""}</td><td className="angka">{fmtNum(l.qtyRequested)}</td><td className="angka">{qty(l)}</td><td className="tengah">{uom}</td></tr>
          ))}
        </Tabel>
        <Ttd c={c} tanggal={tanggalPanjang(iso(r.forwardedAt) ?? r.date)} cols={[pengurusCol(c)]} />
      </Halaman>
    );
  }

  return (
    <Halaman judul="Surat Perintah Penyaluran Barang" ket="Format II.I.8 — persetujuan penyaluran">
      <Kop c={c} />
      <Judul title="Surat Perintah Penyaluran Barang" nomor={<>Nomor: {r.sppbNumber}</>} />
      <p className="paragraf">Berdasarkan {r.spNumber ? <>Surat Permintaan Barang Nomor {r.spNumber}</> : <>Nota Permintaan Nomor {r.number}</>}, dengan ini memerintahkan Pengurus Barang Pembantu untuk menyalurkan barang persediaan{data.wh ? <> dari <b>{data.wh}</b></> : null} sebagai berikut:</p>
      <Tabel cols={6} head={<tr><th>No</th><th>NUSP</th><th>Nama / Spesifikasi Barang</th><th>Jumlah</th><th>Satuan</th><th>Diserahkan Kepada</th></tr>}>
        {lines.map(({ l, nusp, name, spec, uom }, i) => (
          <tr key={l.id}><td className="tengah">{i + 1}</td><td className="kode">{nusp}</td><td>{name}{spec ? ` — ${spec}` : ""}</td><td className="angka">{qty(l)}</td><td className="tengah">{uom}</td><td>{data.unit}</td></tr>
        ))}
      </Tabel>
      <p className="paragraf" style={{ marginTop: "3mm" }}>Penyaluran dituangkan dalam Berita Acara Serah Terima.</p>
      <Ttd c={c} tanggal={tanggalPanjang(iso(r.approvedAt) ?? r.date)} cols={[{ jabatan: <>Kepala Sekolah<br />selaku Kuasa Pengguna Barang</>, signer: c.kepsek }]} />
    </Halaman>
  );
}
