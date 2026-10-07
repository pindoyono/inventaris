import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { buildDoc, isFormat, needsSemester } from "@/lib/server/laporan-docs";
import { parsePeriod } from "@/lib/period";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, KodeLokasi, pengurusCol, Ttd } from "@/components/cetak/print";
import { DocPrintTable } from "@/components/cetak/doc-table";

export const metadata: Metadata = { title: "Cetak Laporan Barang" };

/** Laporan barang Kuasa Pengguna (Permendagri 47/2021 Lampiran IV): IV.L, IV.H, dan Daftar Barang Kuasa Pengguna */
export default async function CetakLaporanBarang({ searchParams }: PageProps<"/cetak/laporan-barang">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  if (!isFormat(sp.format)) notFound();
  const format = sp.format;
  const today = todayWita();
  const p = parsePeriod(sp, today);
  if (needsSemester(format) && p.kind === "bulan") return <p style={{ padding: 24 }}>Laporan penyusutan disusun per semester atau tahun.</p>;
  const ekstra = sp.jenis === "ekstra";
  const { doc, c } = await withSchool(s.schoolId, async (tx) => ({ doc: await buildDoc(tx, s.schoolId, p, format, ekstra), c: await loadPrintContext(tx, s.schoolId) }));
  const tgl = tanggalPanjang(p.to < today ? p.to : today);
  return (
    <Halaman judul={doc.title} ket={doc.ket} orientasi={doc.landscape ? "lanskap" : "potret"} rapat>
      <div className="judul" style={{ marginBottom: "3mm" }}>
        <h1 style={{ textDecoration: "none" }}>{doc.title}</h1>
        <div className="sub">Kuasa Pengguna Barang {c.school.name}</div>
        <div className="sub">{doc.asOf ? `Keadaan per ${tanggalPanjang(p.to)}` : p.label}</div>
      </div>
      <Identitas rows={[["Pengguna Barang", c.dinasName], ["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Kab/Kota / Provinsi", c.parts.ownershipCode === "12" ? `${c.kota} / ${c.provinsi}` : c.provinsi]]} />
      {doc.tables.map((t, i) => <DocPrintTable key={i} t={t} />)}
      {doc.note && <p className="catatan">{doc.note}</p>}
      <Ttd c={c} tanggal={tgl} cols={[{ jabatan: <>Kuasa Pengguna Barang<br />Kepala {c.school.name}</>, signer: c.kepsek }, pengurusCol(c)]} />
    </Halaman>
  );
}
