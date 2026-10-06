import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { rusakBeratData, tidakDigunakanData } from "@/lib/server/reports";
import { fmtNum, fmtRp } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak Laporan Pemantauan" };

/** Permendagri 7/2024 Lampiran C.23 (?jenis=rusak-berat) & C.3 (?jenis=tidak-digunakan) — oleh Kuasa Pengguna Barang */
export default async function CetakPemantauan({ searchParams }: PageProps<"/cetak/pemantauan">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const today = todayWita();
  const year = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? Number(sp.tahun) : Number(today.slice(0, 4));
  const sifat = sp.sifat === "insidentil" ? "Insidentil" : "Periodik";
  const rb = sp.jenis !== "tidak-digunakan";
  const data = await withSchool(s.schoolId, async (tx) => ({
    rb: rb ? await rusakBeratData(tx, year) : [],
    td: rb ? [] : await tidakDigunakanData(tx),
    c: await loadPrintContext(tx, s.schoolId),
  }));
  const { c } = data;
  const tgl = tanggalPanjang(`${year}` < today.slice(0, 4) ? `${year}-12-31` : today);
  const head = (judul: string) => (
    <div className="judul" style={{ marginBottom: "3mm" }}>
      <h1 style={{ textDecoration: "none" }}>{judul}</h1>
      <div className="sub">secara {sifat.toLowerCase()} · Kuasa Pengguna Barang {c.school.name}</div>
      <div className="sub">{c.parts.ownershipCode === "11" ? `Provinsi ${c.provinsi}` : `Kabupaten/Kota ${c.kota}`} · Tahun {year}</div>
    </div>
  );
  const ttd = <Ttd c={c} tanggal={tgl} cols={[{ jabatan: <>Kuasa Pengguna Barang<br />Kepala {c.school.name}</>, signer: c.kepsek }]} />;

  if (rb) {
    const t = data.rb.reduce((a, r) => ({ n: a.n + r.n, v: a.v + r.v, ptN: a.ptN + r.ptN, ptV: a.ptV + r.ptV, pmN: a.pmN + r.pmN, pmV: a.pmV + r.pmV }), { n: 0, v: 0n, ptN: 0, ptV: 0n, pmN: 0, pmV: 0n });
    return (
      <Halaman judul="Pemantauan BMD Rusak Berat/Usang" ket="Permendagri 7/2024 Lampiran C.23" orientasi="lanskap">
        {head("Laporan Pemantauan Barang Milik Daerah Tindak Lanjut Rusak Berat/Usang")}
        <Tabel cols={9} head={<>
          <tr><th rowSpan={2}>No.</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nama Barang</th><th colSpan={2}>Rusak Berat/Usang</th><th colSpan={2}>Diusulkan Pemindahtanganan</th><th colSpan={2}>Diusulkan Pemusnahan</th></tr>
          <tr><th>Jumlah Barang</th><th>Nilai Perolehan (Rp)</th><th>Jumlah Barang</th><th>Nilai Perolehan (Rp)</th><th>Jumlah Barang</th><th>Nilai Perolehan (Rp)</th></tr></>}
          foot={<tr className="jumlah"><td colSpan={3} className="tengah">Jumlah</td><td className="angka">{fmtNum(t.n)}</td><td className="angka">{fmtRp(t.v)}</td><td className="angka">{t.ptN}</td><td className="angka">{fmtRp(t.ptV)}</td><td className="angka">{t.pmN}</td><td className="angka">{fmtRp(t.pmV)}</td></tr>}>
          {data.rb.map((r, i) => (
            <tr key={r.code}><td className="tengah">{i + 1}</td><td className="kode">{r.code}</td><td>{r.name}</td><td className="angka">{fmtNum(r.n)}</td><td className="angka">{fmtRp(r.v)}</td>
              <td className="angka">{r.ptN || "-"}</td><td className="angka">{r.ptN ? fmtRp(r.ptV) : "-"}</td><td className="angka">{r.pmN || "-"}</td><td className="angka">{r.pmN ? fmtRp(r.pmV) : "-"}</td></tr>
          ))}
        </Tabel>
        <p className="catatan">Aset tetap: barang berkondisi rusak berat yang belum dihapus. Persediaan: jumlah & nilai yang dikeluarkan ke daftar persediaan rusak berat/usang selama tahun {year}. Diusulkan: usulan penghapusan tahun {year} dengan alasan rusak berat/usang.</p>
        {ttd}
      </Halaman>
    );
  }
  const t = data.td.reduce((a, r) => ({ n: a.n + r.n, v: a.v + r.v, p1: a.p1 + r.penggunaan, p2: a.p2 + r.pemanfaatan, p3: a.p3 + r.pemindahtanganan }), { n: 0, v: 0n, p1: 0, p2: 0, p3: 0 });
  return (
    <Halaman judul="Pemantauan BMD Tidak Digunakan untuk Tusi" ket="Permendagri 7/2024 Lampiran C.3" orientasi="lanskap">
      {head("Laporan Pemantauan Barang Milik Daerah Tidak Digunakan untuk Penyelenggaraan Tugas dan Fungsi")}
      <Tabel cols={8} head={<>
        <tr><th rowSpan={2}>No.</th><th rowSpan={2}>Kode Barang</th><th rowSpan={2}>Nama Barang</th><th colSpan={2}>Tidak Digunakan</th><th rowSpan={2}>Rencana Penggunaan</th><th rowSpan={2}>Rencana Pemanfaatan</th><th rowSpan={2}>Rencana Pemindahtanganan</th></tr>
        <tr><th>Jumlah Barang</th><th>Nilai Perolehan (Rp)</th></tr></>}
        foot={<tr className="jumlah"><td colSpan={3} className="tengah">Jumlah</td><td className="angka">{t.n}</td><td className="angka">{fmtRp(t.v)}</td><td className="angka">{t.p1}</td><td className="angka">{t.p2}</td><td className="angka">{t.p3}</td></tr>}>
        {data.td.map((r, i) => (
          <tr key={r.code}><td className="tengah">{i + 1}</td><td className="kode">{r.code}</td><td>{r.name}</td><td className="angka">{r.n || "-"}</td><td className="angka">{r.n ? fmtRp(r.v) : "-"}</td>
            <td className="angka">{r.penggunaan || "-"}</td><td className="angka">{r.pemanfaatan || "-"}</td><td className="angka">{r.pemindahtanganan || "-"}</td></tr>
        ))}
      </Tabel>
      <p className="catatan">Berdasarkan aset yang ditandai “tidak digunakan untuk tugas & fungsi” beserta rencananya pada halaman aset.</p>
      {ttd}
    </Halaman>
  );
}
