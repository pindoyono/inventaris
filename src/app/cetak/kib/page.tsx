import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadPrintContext } from "@/lib/server/print";
import { kibData } from "@/lib/server/reports";
import { ACQUISITION_LABEL, KIB_ATTRS, KIB_LABEL } from "@/lib/assets-shared";
import { fmtRp } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak KIB" };

/** KIB A–F. KIB B: kolom "Nomor" (pabrik, rangka, mesin, polisi, BPKB) dikelompokkan seperti format Pemda. */
export default async function CetakKib({ searchParams }: PageProps<"/cetak/kib">) {
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const gol = typeof sp.gol === "string" && sp.gol in KIB_LABEL ? sp.gol : "B";
  const ekstra = sp.ekstra === "1";
  const data = await withSchool(s.schoolId, async (tx) => ({ kib: await kibData(tx, gol, ekstra), c: await loadPrintContext(tx, s.schoolId) }));
  const { kib, c } = data;
  const attrs = KIB_ATTRS[gol] ?? [];
  const nomorKeys = ["noPabrik", "noRangka", "noMesin", "noPolisi", "noBpkb"];
  const plain = gol === "B" ? attrs.filter((a) => !nomorKeys.includes(a.key)) : attrs;
  const nomor = gol === "B" ? attrs.filter((a) => nomorKeys.includes(a.key)) : [];
  const nCols = 8 + (gol === "B" ? 1 : 0) + plain.length + nomor.length; // No, kode, nama, register, tahun, asal, harga, ket (+ merk KIB B)
  const nama = KIB_LABEL[gol].includes(" — ") ? KIB_LABEL[gol].split(" — ")[1] : KIB_LABEL[gol];
  return (
    <Halaman judul={`KIB ${gol} ${nama}`} ket={ekstra ? "Termasuk barang ekstrakomptabel" : "Intrakomptabel"} orientasi="lanskap" rapat>
      <Kop c={c} />
      <Judul title={gol === "ATB" ? "Kartu Inventaris Barang Aset Tak Berwujud" : `Kartu Inventaris Barang (KIB) ${gol}`} sub={nama} />
      <Identitas rows={[["Provinsi", c.provinsi], ["Pengguna Barang", c.dinasName], ["Kuasa Pengguna Barang", c.school.name.toUpperCase()], ["No. Kode Lokasi", <KodeLokasi key="k" c={c} />]]} />
      <Tabel cols={nCols} head={<>
        <tr>
          <th rowSpan={nomor.length ? 2 : 1}>No</th><th rowSpan={nomor.length ? 2 : 1}>Kode Barang</th><th rowSpan={nomor.length ? 2 : 1}>Jenis Barang /<br />Nama Barang</th><th rowSpan={nomor.length ? 2 : 1}>Nomor<br />Register</th>
          {gol === "B" && <th rowSpan={2}>Merk / Type</th>}
          {plain.map((a) => <th key={a.key} rowSpan={nomor.length ? 2 : 1}>{a.label}</th>)}
          <th rowSpan={nomor.length ? 2 : 1}>Tahun<br />{gol === "B" ? "Pembelian" : "Perolehan"}</th>
          {nomor.length > 0 && <th colSpan={nomor.length}>Nomor</th>}
          <th rowSpan={nomor.length ? 2 : 1}>Asal-usul</th><th rowSpan={nomor.length ? 2 : 1}>Harga<br />(Rp)</th><th rowSpan={nomor.length ? 2 : 1}>Keterangan</th>
        </tr>
        {nomor.length > 0 && <tr>{nomor.map((a) => <th key={a.key}>{a.label.replace(/^Nomor\s*/i, "").replace("pabrik/seri", "Pabrik").replace(/^./, (x) => x.toUpperCase())}</th>)}</tr>}</>}
        foot={<tr className="jumlah"><td colSpan={nCols - 2} className="angka">JUMLAH ({kib.units} unit)</td><td className="angka">{fmtRp(kib.total)}</td><td /></tr>}>
        {kib.rows.map((r, i) => (
          <tr key={i}>
            <td className="tengah">{i + 1}</td><td className="kode">{r.bmdCode}</td><td>{r.codeName}{r.name.toLowerCase() !== r.codeName.toLowerCase() ? ` (${r.name})` : ""}</td>
            <td className="kode" style={{ whiteSpace: r.regNos.includes(",") ? "normal" : "nowrap" }}>{r.regNos}</td>
            {gol === "B" && <td>{r.brand ?? "-"}</td>}
            {plain.map((a) => <td key={a.key} className="tengah">{r.attrs[a.key] ?? "-"}</td>)}
            <td className="tengah">{r.year}</td>
            {nomor.map((a) => <td key={a.key}>{r.attrs[a.key] ?? "-"}</td>)}
            <td>{ACQUISITION_LABEL[r.acquisition] ?? r.acquisition}</td><td className="angka">{fmtRp(r.total)}</td>
            <td>{[r.qty > 1 ? `${r.qty} unit` : "", r.ekstra ? "Ekstrakomptabel" : "", r.note ?? ""].filter(Boolean).join("; ")}</td>
          </tr>
        ))}
        {kib.rows.length === 0 && <tr className="kosong"><td colSpan={nCols} className="tengah">Tidak ada barang</td></tr>}
      </Tabel>
      <Ttd c={c} tanggal={tanggalPanjang(todayWita())} cols={[kepsekCol(c), pengurusCol(c)]} />
    </Halaman>
  );
}
