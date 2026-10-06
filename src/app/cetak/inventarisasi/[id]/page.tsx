import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assetInventories, assetInventoryLines, assets, rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { fmtRp } from "@/lib/decimal";
import { tanggalBA } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak Hasil Inventarisasi" };

export default async function CetakInventarisasi({ params }: PageProps<"/cetak/inventarisasi/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx.select({ v: assetInventories, room: rooms.name, pic: rooms.picName, picNip: rooms.picNip }).from(assetInventories).innerJoin(rooms, eq(rooms.id, assetInventories.roomId)).where(eq(assetInventories.id, id));
    if (!h) return null;
    const lines = await tx.select({ l: assetInventoryLines, a: assets }).from(assetInventoryLines).leftJoin(assets, eq(assets.id, assetInventoryLines.assetId)).where(eq(assetInventoryLines.inventoryId, id)).orderBy(asc(assets.bmdCode), asc(assets.regNo));
    return { ...h, lines, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { v, c, lines } = data;
  const b = tanggalBA(v.date);
  const reg = lines.filter((x) => x.a);
  const extra = lines.filter((x) => !x.a);
  const hasil = (x: (typeof reg)[number]) =>
    x.l.found === null ? "Belum diperiksa" : !x.l.found ? "Tidak ditemukan" : x.l.conditionFound && x.l.conditionFound !== x.l.conditionRecorded ? "Perubahan kondisi" : "Sesuai";
  const rekap = { sesuai: reg.filter((x) => hasil(x) === "Sesuai").length, kondisi: reg.filter((x) => hasil(x) === "Perubahan kondisi").length, hilang: reg.filter((x) => hasil(x) === "Tidak ditemukan").length };
  return (
    <Halaman judul="Laporan Hasil Inventarisasi Aset" ket="Permendagri 47/2021 — lembar kerja & hasil inventarisasi per ruangan" orientasi="lanskap" rapat>
      <Kop c={c} />
      <Judul title="Laporan Hasil Inventarisasi Barang" nomor={<>Nomor: {v.number}{v.status !== "SELESAI" ? " (BELUM SELESAI)" : ""}</>} />
      <p className="paragraf">Pada hari ini <b>{b.hari}</b> tanggal <b>{b.tanggal}</b> bulan <b>{b.bulan}</b> tahun <b>{b.tahun}</b> telah dilakukan inventarisasi fisik barang di ruangan berikut, dengan hasil: {rekap.sesuai} sesuai catatan, {rekap.kondisi} berubah kondisi, {rekap.hilang} tidak ditemukan, dan {extra.length} jenis barang belum tercatat.</p>
      <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Ruangan", data.room], ["Penanggung Jawab Ruangan", data.pic ?? "-"]]} />
      <Tabel cols={10} head={<>
        <tr><th rowSpan={2}>No</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>No. Register</th><th rowSpan={2}>Nama / Merk</th><th rowSpan={2}>Tahun</th><th rowSpan={2}>Harga (Rp)</th><th colSpan={2}>Kondisi</th><th rowSpan={2}>Hasil</th><th rowSpan={2}>Keterangan</th></tr>
        <tr><th>Catatan</th><th>Fisik</th></tr></>}>
        {reg.map((x, i) => (
          <tr key={x.l.id}><td className="tengah">{i + 1}</td><td className="kode">{x.a!.bmdCode}</td><td className="kode">{String(x.a!.regNo).padStart(6, "0")}</td><td>{x.a!.name}{x.a!.brand ? ` · ${x.a!.brand}` : ""}</td>
            <td className="tengah">{x.a!.acqDate.slice(0, 4)}</td><td className="angka">{fmtRp(x.a!.acqPrice)}</td>
            <td className="tengah">{x.l.conditionRecorded ? CONDITION_LABEL[x.l.conditionRecorded] : "-"}</td><td className="tengah">{x.l.found && x.l.conditionFound ? CONDITION_LABEL[x.l.conditionFound] : "-"}</td>
            <td className="tengah">{hasil(x)}</td><td>{x.l.note ?? ""}</td></tr>
        ))}
        {extra.map((x, i) => (
          <tr key={x.l.id}><td className="tengah">{reg.length + i + 1}</td><td className="kode">-</td><td className="kode">-</td><td>{x.l.extraName} ({x.l.extraQty} unit)</td><td /><td /><td /><td /><td className="tengah">Belum tercatat</td><td>{x.l.note ?? ""}</td></tr>
        ))}
      </Tabel>
      <Ttd c={c} tanggal={b.panjang} cols={[kepsekCol(c), { jabatan: "Penanggung Jawab Ruangan", signer: { name: data.pic, nip: data.picNip } }, pengurusCol(c)]} />
    </Halaman>
  );
}
