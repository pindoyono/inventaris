import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { dokumenKepemilikanData } from "@/lib/server/reports";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak Daftar Dokumen Kepemilikan" };
const fmtD = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : d || "-");

/** Permendagri 7/2024 Lampiran B.1 (?jenis=tanah) & B.2 (selain sertifikat tanah) */
export default async function CetakDokumenKepemilikan({ searchParams }: PageProps<"/cetak/dokumen-kepemilikan">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const jenis = sp.jenis === "tanah" ? "tanah" : "lain";
  const today = todayWita();
  const data = await withSchool(s.schoolId, async (tx) => ({ rows: await dokumenKepemilikanData(tx, jenis), c: await loadPrintContext(tx, s.schoolId) }));
  const { c, rows } = data;
  return (
    <Halaman judul="Daftar Dokumen Kepemilikan BMD" ket={`Permendagri 7/2024 Lampiran B.${jenis === "tanah" ? 1 : 2} — bahan untuk Pejabat Penatausahaan Barang`} orientasi="lanskap" rapat>
      <div className="judul" style={{ marginBottom: "3mm" }}>
        <h1 style={{ textDecoration: "none" }}>Daftar Dokumen Bukti Kepemilikan Barang Milik Daerah Berupa {jenis === "tanah" ? "Sertipikat Tanah" : "Selain Sertifikat Tanah"}</h1>
        <div className="sub">{c.parts.ownershipCode === "11" ? `Provinsi ${c.provinsi}` : `Kabupaten/Kota ${c.kota}`} · Tahun {today.slice(0, 4)}</div>
      </div>
      <Tabel cols={14} head={<>
        <tr><th rowSpan={2}>No.</th><th rowSpan={2}>Nomor Induk Barang (NIBAR)</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nama Barang</th><th rowSpan={2}>Spesifikasi Nama Barang</th><th rowSpan={2}>Luas</th><th rowSpan={2}>Satuan</th><th rowSpan={2}>Lokasi/Alamat</th>
          <th colSpan={4}>Dokumen Kepemilikan</th><th rowSpan={2}>Kuasa Pengguna Barang/ Pengguna Barang/ Pengelola Barang</th><th rowSpan={2}>Keterangan</th></tr>
        <tr><th>Jenis Dokumen Kepemilikan</th><th>Nama Dokumen Kepemilikan</th><th>Nomor</th><th>Tanggal</th></tr></>}>
        {rows.map((r, i) => (
          <tr key={i}><td className="tengah">{i + 1}</td><td className="tengah">-</td><td className="kode">{r.code}</td><td>{r.codeName}</td><td>{r.spec}</td><td className="angka">{r.luas || "-"}</td><td className="tengah">{r.satuan || "-"}</td><td>{r.lokasi || "-"}</td>
            <td>{r.doc.jenis}</td><td>{c.pemda ? c.pemda.replace(/^PEMERINTAH /, "Pemerintah ").toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()) : "-"}</td><td>{r.doc.nomor}</td><td className="tengah">{fmtD(r.doc.tanggal)}</td>
            <td>{c.school.name}</td><td>No. register {String(r.reg).padStart(6, "0")}</td></tr>
        ))}
        {rows.length === 0 && <tr className="kosong"><td colSpan={14} className="tengah">Belum ada aset dengan nomor dokumen kepemilikan ({jenis === "tanah" ? "isi nomor sertifikat pada aset KIB A" : "isi nomor BPKB (KIB B) atau dokumen gedung (KIB C) pada data aset"})</td></tr>}
      </Tabel>
      <p className="catatan">NIBAR diisi oleh Pengelola Barang bila sudah ditetapkan. Daftar ini disiapkan sekolah sebagai bahan bagi Pejabat Penatausahaan Barang.</p>
      <Ttd c={c} tanggal={tanggalPanjang(today)} cols={[{ jabatan: <>Kuasa Pengguna Barang<br />Kepala {c.school.name}</>, signer: c.kepsek }, { jabatan: "Pejabat Penatausahaan Barang", signer: { name: null, nip: null } }]} />
    </Halaman>
  );
}
