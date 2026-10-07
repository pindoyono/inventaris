import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { schools, transfers } from "@/db/schema";
import { db } from "@/db";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { fmtRp, parseDec } from "@/lib/decimal";
import { tanggalPanjang, terbilang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak BAST Pengeluaran Internal" };

/** Berita acara serah terima pengeluaran internal Pengguna Barang */
export default async function CetakPengalihan({ params }: PageProps<"/cetak/pengalihan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [t] = await tx.select().from(transfers).where(eq(transfers.id, id));
    // BAST memakai kop & penandatangan sekolah pengirim
    return t && t.bastNo && t.fromSchoolId === s.schoolId ? { t, c: await loadPrintContext(tx, s.schoolId) } : null;
  });
  if (!data) notFound();
  const { t, c } = data;
  const [from] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, t.fromSchoolId));
  const total = t.items.reduce((a, i) => a + parseDec(i.acqPrice), 0n);
  return (
    <Halaman judul="BAST Pengeluaran Internal" ket="Permendagri 47/2021 — pengeluaran/penerimaan internal Pengguna Barang">
      <Kop c={c} />
      <Judul title="Berita Acara Serah Terima Barang Milik Daerah" nomor={`Nomor: ${t.bastNo}`} sub="(Pengeluaran Internal Pengguna Barang)" />
      <p style={{ textAlign: "justify" }}>Pada {tanggalPanjang(t.bastDate!)}, berdasarkan surat persetujuan Pengguna Barang nomor {t.approvalNo}{t.approvalDate ? ` tanggal ${tanggalPanjang(t.approvalDate)}` : ""}, Kuasa Pengguna Barang <b>{from?.name}</b> (PIHAK PERTAMA) menyerahkan kepada <b>{t.toName}</b> (PIHAK KEDUA) Barang Milik Daerah sebagai berikut:</p>
      <Identitas rows={[["Nomor dokumen", t.number ?? "-"], ["Alasan", t.reason]]} />
      <Tabel cols={8} head={<tr><th>No</th><th>Kode Barang</th><th>Nomor Register</th><th>Nama Barang</th><th>Merk/Tipe</th><th>Tahun Perolehan</th><th>Kondisi</th><th>Nilai Perolehan (Rp)</th></tr>}
        foot={<tr className="jumlah"><td colSpan={7} className="angka">JUMLAH</td><td className="angka">{fmtRp(total)}</td></tr>}>
        {t.items.map((i, n) => <tr key={i.assetId}><td className="tengah">{n + 1}</td><td className="kode">{i.bmdCode}</td><td className="kode">{String(i.regNo).padStart(6, "0")}</td><td>{i.name}</td><td>{i.brand ?? "-"}</td><td className="tengah">{i.acqDate.slice(0, 4)}</td><td className="tengah">{CONDITION_LABEL[i.condition]}</td><td className="angka">{fmtRp(i.acqPrice)}</td></tr>)}
      </Tabel>
      <p>Terbilang: <i>{terbilang(Number(total / 100n))} rupiah</i>. Sejak penandatanganan berita acara ini, pengurusan barang tersebut menjadi tanggung jawab PIHAK KEDUA.</p>
      <Ttd c={c} tanggal={tanggalPanjang(t.bastDate!)} cols={[{ jabatan: <>PIHAK KEDUA<br />Yang Menerima</>, signer: { name: null, nip: null } }, { jabatan: <>PIHAK PERTAMA<br />Kuasa Pengguna Barang {from?.name}</>, signer: c.kepsek }]} />
    </Halaman>
  );
}
