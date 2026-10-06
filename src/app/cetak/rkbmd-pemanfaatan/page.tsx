import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { rkbmdPemanfaatanData } from "@/lib/server/reports-7-2024";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak RKBMD Pemanfaatan" };

/** Permendagri 7/2024 Lampiran A.1 — Format RKBMD untuk Pemanfaatan oleh Kuasa Pengguna Barang */
export default async function CetakRkbmdPemanfaatan({ searchParams }: PageProps<"/cetak/rkbmd-pemanfaatan">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const today = todayWita();
  const ta = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? Number(sp.tahun) : Number(today.slice(0, 4)) + 1;
  const { rows, c } = await withSchool(s.schoolId, async (tx) => ({ rows: await rkbmdPemanfaatanData(tx, ta), c: await loadPrintContext(tx, s.schoolId) }));
  return (
    <Halaman judul="RKBMD Rencana Pemanfaatan" ket="Permendagri 7/2024 Lampiran A.1 — Format RKBMD untuk Pemanfaatan oleh Kuasa Pengguna Barang" orientasi="lanskap" rapat>
      <div className="judul" style={{ marginBottom: "3mm" }}>
        <div className="sub">Rencana Kebutuhan Barang Milik Daerah</div>
        <div className="sub">(Rencana Pemanfaatan)</div>
        <div className="sub">Kuasa Pengguna Barang {c.school.name}</div>
        <div className="sub">Tahun Anggaran {ta}</div>
      </div>
      <Identitas rows={[["Pengguna Barang", c.dinasName], ["Kab/Kota", c.parts.ownershipCode === "12" ? c.kota : "-"], ["Provinsi", c.provinsi]]} />
      <Tabel cols={11} head={<tr><th>No</th><th>Kode Barang</th><th>Nama Barang</th><th>Spesifikasi Nama Barang</th><th>NIBAR</th><th>Jumlah Barang</th><th>Lokasi</th><th>Peruntukan</th><th>Bentuk Pemanfaatan</th><th>Jangka Waktu</th><th>Ket.</th></tr>}>
        {rows.map((r, i) => (
          <tr key={`${r.id}-${r.reg_no}-${r.bmd_code}`}>
            <td className="tengah">{i + 1}</td><td className="kode">{r.bmd_code}</td><td>{r.codeName || r.name}</td>
            <td>{[r.name !== r.codeName ? r.name : null, r.brand].filter(Boolean).join(", ") || "-"}</td><td className="kode">-</td>
            <td className="tengah">{r.portion || r.attrs.luas ? `${r.portion ?? `${r.attrs.luas} m²`}` : "1 unit"}</td>
            <td>{[r.room, r.attrs.alamat ?? r.attrs.letak].filter(Boolean).join(", ") || c.school.name}</td>
            <td>{r.purpose}</td><td>{r.formLabel}</td><td>{r.term ?? "-"}</td><td>No. register {String(r.reg_no).padStart(6, "0")}{r.note ? `; ${r.note}` : ""}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr className="kosong"><td colSpan={11} className="tengah">Tidak ada rencana pemanfaatan untuk tahun anggaran {ta}</td></tr>}
      </Tabel>
      <p className="catatan">Sumber: menu Aset › Pemanfaatan (rencana dengan tahun RKBMD {ta}). NIBAR diisi bila sudah ditetapkan Pengelola/Pengguna Barang.</p>
      <Ttd c={c} tanggal={tanggalPanjang(today)} cols={[{ jabatan: <>Kuasa Pengguna Barang<br />Kepala {c.school.name}</>, signer: c.kepsek }]} />
    </Halaman>
  );
}
