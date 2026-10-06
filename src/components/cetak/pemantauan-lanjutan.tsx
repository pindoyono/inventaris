import type { ReactNode } from "react";
import type { Tx } from "@/db";
import type { PrintContext } from "@/lib/server/print";
import { atrData, kdpData, lhiData, pemindahtangananData, utilNoApprovalData, utilStageData, type NV, type StageGroup } from "@/lib/server/reports-7-2024";
import { fmtNum, fmtRp } from "@/lib/decimal";
import { Halaman, Tabel } from "@/components/cetak/print";

/** Format pemantauan Permendagri 7/2024 untuk Kuasa Pengguna Barang (selain C.3/C.23) */
export const PEMANTAUAN_LANJUTAN = {
  "penggunaan-sementara": { no: "C.5", title: "Laporan Pemantauan Barang Milik Daerah Penggunaan Sementara" },
  "operasional-pihak-lain": { no: "C.7", title: "Laporan Pemantauan Barang Milik Daerah yang Dioperasionalkan oleh Pihak Lain" },
  pemanfaatan: { no: "C.9", title: "Laporan Pemantauan Pemanfaatan Barang Milik Daerah" },
  "pemanfaatan-tanpa-persetujuan": { no: "C.11", title: "Laporan Pemantauan Pemanfaatan Barang Milik Daerah Tanpa Persetujuan" },
  pemindahtanganan: { no: "C.13", title: "Laporan Pemantauan Pemindahtanganan Barang Milik Daerah" },
  kdp: { no: "C.21", title: "Laporan Pemantauan Pelaksanaan Konstruksi Dalam Pengerjaan (KDP)" },
  atr: { no: "C.25", title: "Laporan Pemantauan Barang Milik Daerah Tindak Lanjut Aset Tetap Renovasi (ATR)" },
  reklasifikasi: { no: "C.27", title: "Laporan Pemantauan Barang Milik Daerah Tindak Lanjut Laporan Hasil Inventarisasi (LHI) melalui Reklasifikasi" },
  koreksi: { no: "C.29", title: "Laporan Pemantauan Barang Milik Daerah Tindak Lanjut Laporan Hasil Inventarisasi (LHI) melalui Koreksi" },
} as const;
export type JenisLanjutan = keyof typeof PEMANTAUAN_LANJUTAN;
export const isJenisLanjutan = (j: unknown): j is JenisLanjutan => typeof j === "string" && j in PEMANTAUAN_LANJUTAN;

const nv = (x: NV) => (
  <>
    <td className="angka">{x.n ? fmtNum(x.n) : "-"}</td>
    <td className="angka">{x.n ? fmtRp(x.v) : "-"}</td>
  </>
);
const pair = (a: string) => <th colSpan={2}>{a}</th>;
const sub = (n: number) => Array.from({ length: n }, (_, i) => <FragmentPair key={i} />);
function FragmentPair() {
  return (
    <>
      <th>Jumlah Barang</th>
      <th>Nilai Perolehan (Rp)</th>
    </>
  );
}
const sumNV = (xs: NV[]) => xs.reduce((a, x) => ({ n: a.n + x.n, v: a.v + x.v }), { n: 0, v: 0n });

/** Tabel tiga tahap (rencana/persetujuan/pelaksanaan), dikelompokkan per bentuk bila ada */
function StageTable({ groups, withForm }: { groups: StageGroup[]; withForm: boolean }) {
  const cols = withForm ? 10 : 9;
  const all = { plan: sumNV(groups.map((g) => g.total.plan)), ok: sumNV(groups.map((g) => g.total.ok)), run: sumNV(groups.map((g) => g.total.run)) };
  let no = 0;
  return (
    <Tabel cols={cols} head={<>
      <tr><th rowSpan={2}>No.</th>{withForm && <th rowSpan={2}>Bentuk</th>}<th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nama Barang</th>{pair("Rencana")}{pair("Persetujuan")}{pair("Pelaksanaan")}</tr>
      <tr>{sub(3)}</tr></>}
      foot={<tr className="jumlah"><td colSpan={withForm ? 4 : 3} className="tengah">{withForm ? "Jumlah Total" : "Jumlah"}</td>{nv(all.plan)}{nv(all.ok)}{nv(all.run)}</tr>}>
      {groups.map((g, gi) => (
        withForm ? (
          <GroupRows key={gi} no={gi + 1} label={g.label} cols={cols}>
            {g.rows.map((r) => <tr key={r.code}><td /><td /><td className="kode">{r.code}</td><td>{r.name}</td>{nv(r.plan)}{nv(r.ok)}{nv(r.run)}</tr>)}
            <tr className="jumlah"><td /><td colSpan={3}>Jumlah {gi + 1}</td>{nv(g.total.plan)}{nv(g.total.ok)}{nv(g.total.run)}</tr>
          </GroupRows>
        ) : (
          g.rows.map((r) => <tr key={r.code}><td className="tengah">{++no}</td><td className="kode">{r.code}</td><td>{r.name}</td>{nv(r.plan)}{nv(r.ok)}{nv(r.run)}</tr>)
        )
      ))}
      {!withForm && groups.every((g) => g.rows.length === 0) && <tr className="kosong"><td colSpan={cols} className="tengah">Tidak ada data</td></tr>}
    </Tabel>
  );
}

function GroupRows({ no, label, cols, children }: { no: number; label: string; cols: number; children: ReactNode }) {
  return (
    <>
      <tr><td className="tengah">{no}</td><td colSpan={cols - 1}><b>{label}</b></td></tr>
      {children}
    </>
  );
}

export async function PemantauanLanjutan({ tx, c, jenis, year, head, ttd }: { tx: Tx; c: PrintContext; jenis: JenisLanjutan; year: number; head: (t: string) => ReactNode; ttd: ReactNode }) {
  const meta = PEMANTAUAN_LANJUTAN[jenis];
  const page = (body: ReactNode, note: string) => (
    <Halaman judul={meta.title.replace("Laporan ", "")} ket={`Permendagri 7/2024 Lampiran ${meta.no}`} orientasi="lanskap">
      {head(meta.title)}
      {body}
      <p className="catatan">{note}</p>
      {ttd}
    </Halaman>
  );
  void c;
  switch (jenis) {
    case "penggunaan-sementara":
    case "operasional-pihak-lain":
    case "pemanfaatan": {
      const kind = jenis === "pemanfaatan" ? "PEMANFAATAN" : jenis === "penggunaan-sementara" ? "PENGGUNAAN_SEMENTARA" : "OPERASIONAL_PIHAK_LAIN";
      const groups = await utilStageData(tx, kind, year);
      return page(<StageTable groups={groups} withForm={jenis === "pemanfaatan"} />,
        `Rencana: barang dalam RKBMD tahun ${year}. Persetujuan: persetujuan Pengelola/Kepala Daerah bertanggal tahun ${year}. Pelaksanaan: berjalan (berdasarkan perjanjian) pada tahun ${year}. Sumber: menu Aset › Pemanfaatan.`);
    }
    case "pemanfaatan-tanpa-persetujuan": {
      const groups = await utilNoApprovalData(tx, year);
      const all = sumNV(groups.map((g) => g.total.run));
      return page(
        <Tabel cols={6} head={<tr><th>No.</th><th>Bentuk Pemanfaatan</th><th>Kode Barang</th><th>Nama Barang</th><th>Jumlah Barang</th><th>Nilai Perolehan (Rp)</th></tr>}
          foot={<tr className="jumlah"><td colSpan={4} className="tengah">Jumlah Total</td>{nv(all)}</tr>}>
          {groups.map((g, gi) => (
            <GroupRows key={gi} no={gi + 1} label={g.label} cols={6}>
              {g.rows.map((r) => <tr key={r.code}><td /><td /><td className="kode">{r.code}</td><td>{r.name}</td>{nv(r.run)}</tr>)}
              <tr className="jumlah"><td /><td colSpan={3}>Jumlah {gi + 1}</td>{nv(g.total.run)}</tr>
            </GroupRows>
          ))}
        </Tabel>,
        `Pemanfaatan yang berjalan pada tahun ${year} tanpa surat persetujuan Pengelola/Kepala Daerah (dicatat “sudah berjalan” tanpa nomor persetujuan).`);
    }
    case "pemindahtanganan": {
      const groups = await pemindahtangananData(tx, year);
      return page(<StageTable groups={groups} withForm />,
        `Rencana: barang dalam usulan penghapusan yang diajukan tahun ${year} dengan tindak lanjut pemindahtanganan. Persetujuan & pelaksanaan: barang yang disetujui SK tahun ${year} dan dihapus dari daftar barang sekolah; pelaksanaan penjualan/hibah/tukar menukar oleh Pengelola Barang.`);
    }
    case "kdp": {
      const rows = await kdpData(tx, year);
      const t = { go: sumNV(rows.map((r) => r.go)), stop: sumNV(rows.map((r) => r.stop)), all: sumNV(rows.map((r) => r.all)) };
      return page(
        <Tabel cols={9} head={<>
          <tr><th rowSpan={2}>No.</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nama Barang</th>{pair("Dilanjutkan Pembangunannya")}{pair("Dihentikan Pembangunannya")}{pair("Jumlah KDP")}</tr>
          <tr>{sub(3)}</tr></>}
          foot={<tr className="jumlah"><td colSpan={3} className="tengah">Jumlah</td>{nv(t.go)}{nv(t.stop)}{nv(t.all)}</tr>}>
          {rows.map((r, i) => <tr key={r.code}><td className="tengah">{i + 1}</td><td className="kode">{r.code}</td><td>{r.name}</td>{nv(r.go)}{nv(r.stop)}{nv(r.all)}</tr>)}
          {rows.length === 0 && <tr className="kosong"><td colSpan={9} className="tengah">Tidak ada KDP</td></tr>}
        </Tabel>,
        `KDP yang belum selesai pada 31 Desember ${year}, menurut jenis aset yang dibangun; nilai = akumulasi pembayaran s.d. akhir tahun. Sumber: menu Aset › KDP & renovasi.`);
    }
    case "atr": {
      const rows = await atrData(tx, year);
      const t = { all: sumNV(rows.map((r) => r.all)), pt: sumNV(rows.map((r) => r.pt)), ps: sumNV(rows.map((r) => r.ps)) };
      return page(
        <Tabel cols={9} head={<>
          <tr><th rowSpan={2}>No.</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nama Barang</th>{pair("Aset Tetap Renovasi")}{pair("Diusulkan Pemindahtanganan")}{pair("Diusulkan Pengalihan Status Penggunaan")}</tr>
          <tr>{sub(3)}</tr></>}
          foot={<tr className="jumlah"><td colSpan={3} className="tengah">Jumlah</td>{nv(t.all)}{nv(t.pt)}{nv(t.ps)}</tr>}>
          {rows.map((r, i) => <tr key={r.code}><td className="tengah">{i + 1}</td><td className="kode">{r.code}</td><td>{r.name}</td>{nv(r.all)}{nv(r.pt)}{nv(r.ps)}</tr>)}
          {rows.length === 0 && <tr className="kosong"><td colSpan={9} className="tengah">Tidak ada aset tetap renovasi</td></tr>}
        </Tabel>,
        "Renovasi atas aset milik Pengguna Barang lain/pihak lain yang dicatat sekolah (kode 1.3.5.07), beserta rencana tindak lanjutnya.");
    }
    case "reklasifikasi":
    case "koreksi": {
      const kind = jenis === "reklasifikasi" ? "REKLASIFIKASI" : "KOREKSI";
      const label = jenis === "reklasifikasi" ? "Reklasifikasi" : "Koreksi";
      const rows = await lhiData(tx, kind, year);
      const t = { lhi: sumNV(rows.map((r) => r.lhi)), done: sumNV(rows.map((r) => r.done)), todo: sumNV(rows.map((r) => r.todo)) };
      return page(
        <Tabel cols={9} head={<>
          <tr><th rowSpan={2}>No.</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nama Barang</th>{pair("LHI")}{pair(`Telah Ditindaklanjuti ${label}`)}{pair(`Rencana Ditindaklanjuti ${label}`)}</tr>
          <tr>{sub(3)}</tr></>}
          foot={<tr className="jumlah"><td colSpan={3} className="tengah">Jumlah</td>{nv(t.lhi)}{nv(t.done)}{nv(t.todo)}</tr>}>
          {rows.map((r, i) => <tr key={r.code}><td className="tengah">{i + 1}</td><td className="kode">{r.code}</td><td>{r.name}</td>{nv(r.lhi)}{nv(r.done)}{nv(r.todo)}</tr>)}
          {rows.length === 0 && <tr className="kosong"><td colSpan={9} className="tengah">Tidak ada temuan</td></tr>}
        </Tabel>,
        `LHI: barang yang ditandai “perlu ${label.toLowerCase()}” pada inventarisasi yang selesai tahun ${year}. Telah ditindaklanjuti: ${label.toLowerCase()} sudah dicatat di halaman aset.`);
    }
  }
}
