import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { kirData } from "@/lib/server/reports";
import { fmtRp } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { kodeBarang } from "@/lib/assets-shared";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";
import { printPeriod } from "../params";

export const metadata: Metadata = { title: "Cetak KIR" };

export default async function CetakKir({ searchParams }: PageProps<"/cetak/kir">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const today = todayWita();
  const per = printPeriod(sp, today);
  const asOf = per.to < today ? per.to : today;
  const all = sp.ruang === "semua";
  const roomId = typeof sp.ruang === "string" && /^[0-9a-f-]{36}$/.test(sp.ruang) ? sp.ruang : null;
  if (!roomId && !all) notFound();
  const data = await withSchool(s.schoolId, async (tx) => {
    const ids = all ? (await tx.select({ id: rooms.id }).from(rooms).orderBy(asc(rooms.name))).map((r) => r.id) : [roomId!];
    const ks = [];
    for (const id of ids) {
      const k = await kirData(tx, id, asOf);
      if (k && (!all || k.rows.length)) ks.push(k);
    }
    return { ks, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data.ks.length) {
    if (!all) notFound();
    return <p style={{ padding: 24 }}>Tidak ada ruangan yang berisi barang.</p>;
  }
  return <>{data.ks.map((k, i) => <KirPage key={k.room.id} k={k} c={data.c} label={per.label} asOf={asOf} first={i === 0} />)}</>;
}

function KirPage({ k, c, label, asOf, first }: { k: NonNullable<Awaited<ReturnType<typeof kirData>>>; c: Awaited<ReturnType<typeof loadPrintContext>>; label: string; asOf: string; first: boolean }) {
  const per = { label };
  const lokasi = `${k.room.name}${k.room.building ? ` (${k.room.building}${k.room.floor ? `, Lantai ${k.room.floor}` : ""})` : ""}`;
  return (
    <Halaman judul="KIR" ket="Format II.K.2 — Kartu Inventaris Ruangan" orientasi="lanskap" bilah={first}>
      <Kop c={c} />
      <Judul title="Kartu Inventaris Ruangan (KIR)" nomor={per.label} />
      <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Ruangan", lokasi], ["Penanggung Jawab Ruangan", k.room.picName ?? "-"]]} />
      <Tabel cols={12} head={<>
        <tr><th rowSpan={2}>No</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nomor<br />Register</th><th rowSpan={2}>Nama Barang</th><th rowSpan={2}>Merk / Tipe</th><th rowSpan={2}>Tahun<br />Perolehan</th>
          <th rowSpan={2}>Jumlah</th><th rowSpan={2}>Harga Perolehan<br />(Rp)</th><th colSpan={3}>Kondisi</th><th rowSpan={2}>Keterangan</th></tr>
        <tr><th>B</th><th>RR</th><th>RB</th></tr></>}
        foot={<tr className="jumlah"><td colSpan={6} className="angka">JUMLAH</td><td className="angka">{k.units}</td><td className="angka">{fmtRp(k.total)}</td>
          <td className="tengah">{k.rows.reduce((a, r) => a + r.baik, 0) || ""}</td><td className="tengah">{k.rows.reduce((a, r) => a + r.rr, 0) || ""}</td><td className="tengah">{k.rows.reduce((a, r) => a + r.rb, 0) || ""}</td><td /></tr>}>
        {k.rows.map((r, i) => (
          <tr key={i}><td className="tengah">{i + 1}</td><td className="kode">{kodeBarang(r.bmdCode)}</td><td className="kode" style={{ whiteSpace: r.regNos.includes(",") ? "normal" : "nowrap" }}>{r.regNos}</td><td>{r.name}</td><td>{r.brand ?? "-"}</td><td className="tengah">{r.year}</td>
            <td className="angka">{r.qty}</td><td className="angka">{fmtRp(r.total)}</td><td className="tengah">{r.baik || ""}</td><td className="tengah">{r.rr || ""}</td><td className="tengah">{r.rb || ""}</td>
            <td>{r.ekstra ? (r.ekstra === r.qty ? "Ekstrakomptabel" : `${r.ekstra} ekstrakomptabel`) : ""}</td></tr>
        ))}
        {k.rows.length === 0 && <tr className="kosong"><td colSpan={12} className="tengah">Tidak ada barang</td></tr>}
      </Tabel>
      <p className="catatan">B = Baik, RR = Rusak Ringan, RB = Rusak Berat. KIR dibuat rangkap 2 (ditempel di ruangan dan arsip), diperbarui setiap semester dan setiap ada perpindahan/penambahan barang atau pergantian penanggung jawab ruangan.</p>
      <Ttd c={c} tanggal={tanggalPanjang(asOf)} cols={[kepsekCol(c), { jabatan: "Penanggung Jawab Ruangan", signer: { name: k.room.picName, nip: k.room.picNip } }, pengurusCol(c)]} />
    </Halaman>
  );
}
