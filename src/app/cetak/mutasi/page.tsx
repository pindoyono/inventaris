import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { mutasiData } from "@/lib/server/reports";
import { fmtNum, fmtRp } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";
import { endOrToday, printPeriod } from "../params";

export const metadata: Metadata = { title: "Cetak Laporan Mutasi Persediaan" };

export default async function CetakMutasi({ searchParams }: PageProps<"/cetak/mutasi">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const today = todayWita();
  const per = printPeriod(sp, today);
  const wh = typeof sp.gudang === "string" && /^[0-9a-f-]{36}$/.test(sp.gudang) ? sp.gudang : null;
  const data = await withSchool(s.schoolId, async (tx) => ({
    m: await mutasiData(tx, per.from, per.to, wh),
    whName: wh ? (await tx.select({ n: warehouses.name }).from(warehouses).where(eq(warehouses.id, wh)))[0]?.n : "Semua gudang",
    c: await loadPrintContext(tx, s.schoolId),
  }));
  const { m, c } = data;
  return (
    <Halaman judul="Laporan Mutasi Persediaan" ket="Pelaporan semesteran — FIFO" orientasi="lanskap" rapat>
      <Kop c={c} />
      <Judul title="Laporan Mutasi Barang Persediaan" nomor={per.label} />
      <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Gudang", data.whName ?? "-"], ["Metode Penilaian", "FIFO"]]} />
      <Tabel cols={12} head={<>
        <tr><th rowSpan={2}>No</th><th rowSpan={2}>NUSP</th><th rowSpan={2}>Nama Barang</th><th rowSpan={2}>Satuan</th><th colSpan={2}>Saldo Awal</th><th colSpan={2}>Masuk</th><th colSpan={2}>Keluar</th><th colSpan={2}>Saldo Akhir</th></tr>
        <tr><th>Jml</th><th>Rp</th><th>Jml</th><th>Rp</th><th>Jml</th><th>Rp</th><th>Jml</th><th>Rp</th></tr></>}
        foot={<tr className="jumlah"><td colSpan={4} className="angka">JUMLAH</td><td /><td className="angka">{fmtRp(m.totals.openV)}</td><td /><td className="angka">{fmtRp(m.totals.inV)}</td><td /><td className="angka">{fmtRp(m.totals.outV)}</td><td /><td className="angka">{fmtRp(m.totals.closeV)}</td></tr>}>
        {m.rows.map((r, i) => (
          <tr key={r.itemId}><td className="tengah">{i + 1}</td><td className="kode">{r.nusp}</td><td className="nama">{r.name}</td><td className="tengah">{r.uom}</td>
            <td className="angka">{fmtNum(r.openQ)}</td><td className="angka">{fmtRp(r.openV)}</td><td className="angka">{fmtNum(r.inQ)}</td><td className="angka">{fmtRp(r.inV)}</td>
            <td className="angka">{fmtNum(r.outQ)}</td><td className="angka">{fmtRp(r.outV)}</td><td className="angka">{fmtNum(r.closeQ)}</td><td className="angka">{fmtRp(r.closeV)}</td></tr>
        ))}
      </Tabel>
      <Ttd c={c} tanggal={tanggalPanjang(endOrToday(per.to, today))} cols={[kepsekCol(c), pengurusCol(c)]} />
    </Halaman>
  );
}
