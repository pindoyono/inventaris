import type { ReactNode } from "react";
import type { PrintContext, Signer } from "@/lib/server/print";
import { fmtNip } from "@/lib/server/print";
import { PrintBar } from "./print-bar";

/** Satu halaman A4 + bilah petunjuk di layar */
export function Halaman({ judul, ket, orientasi = "potret", rapat, bilah = true, children }: { judul: string; ket?: string; orientasi?: "potret" | "lanskap"; rapat?: boolean; bilah?: boolean; children: ReactNode }) {
  return (
    <>
      {bilah && <PrintBar judul={judul} ket={ket} />}
      <div className={`halaman a4-${orientasi}${rapat ? " rapat" : ""}`}>{children}</div>
    </>
  );
}

export function Kop({ c }: { c: PrintContext }) {
  const logo = (f: string | null, label: string) =>
    // eslint-disable-next-line @next/next/no-img-element
    f ? <img src={`/berkas/${f}`} alt="" /> : <div className="logo">LOGO<br />{label}</div>;
  return (
    <div className="kop">
      {logo(c.logoPemda, "PEMDA")}
      <div>
        <div className="pemda">{c.pemda || "PEMERINTAH DAERAH"}</div>
        <div className="dinas">{c.dinas}</div>
        <div className="sekolah">{c.school.name.toUpperCase()}</div>
        <div className="alamat">{c.alamat}{c.alamat ? " · " : ""}NPSN {c.school.npsn}</div>
      </div>
      {logo(c.logoSchool, "SEKOLAH")}
    </div>
  );
}

export function Judul({ title, nomor, sub }: { title: string; nomor?: ReactNode; sub?: string }) {
  return (
    <div className="judul">
      <h1>{title}</h1>
      {sub && <div className="sub">{sub}</div>}
      {nomor && <div className="nomor">{nomor}</div>}
    </div>
  );
}

export function Identitas({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="identitas">
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i}><td>{a}</td><td>:</td><td>{b}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function KodeLokasi({ c }: { c: PrintContext }) {
  return (
    <>
      {c.kodeLokasi}
      {c.provisional && <span className="sementara"> (SEMENTARA — kode bidang/unit/sub unit belum diisi)</span>}
    </>
  );
}

export type TtdCol = { jabatan: ReactNode; signer: Signer; nipLabel?: string };

/** Tanda tangan sejajar; tempat & tanggal tampil di kolom `kotaDi` (indeks, -1 = terakhir, null = tidak ada) */
export function Ttd({ c, cols, tanggal, kotaDi = -1 }: { c: PrintContext; cols: TtdCol[]; tanggal: string; kotaDi?: number | null }) {
  const kelas = ({ 1: "satu", 2: "dua", 3: "tiga" } as Record<number, string>)[cols.length] ?? "dua";
  const show = kotaDi === null ? -99 : (kotaDi + cols.length) % cols.length;
  return (
    <div className={`ttd ${kelas}`}>
      {cols.map((col, i) => (
        <div key={i}>
          <div className={`tempat ${i === show ? "tampil" : ""}`}>{c.kota}, {tanggal}</div>
          <div>{col.jabatan}</div>
          <div className="ruang" />
          <div className="nama">{col.signer.name || "………………………………"}</div>
          <div>{col.nipLabel ?? "NIP."} {fmtNip(col.signer.nip)}</div>
        </div>
      ))}
    </div>
  );
}

export const kepsekCol = (c: PrintContext, mengetahui = true): TtdCol => ({
  jabatan: <>{mengetahui && <>Mengetahui,<br /></>}Kepala Sekolah<br />selaku Kuasa Pengguna Barang</>,
  signer: c.kepsek,
});
export const pengurusCol = (c: PrintContext): TtdCol => ({ jabatan: "Pengurus Barang Pembantu", signer: c.pengurus });

/** Tabel data dengan baris nomor kolom (1, 2, 3, …) seperti format Permendagri */
export function Tabel({ head, cols, children, foot }: { head: ReactNode; cols: number; children: ReactNode; foot?: ReactNode }) {
  return (
    <table className="data">
      <thead>
        {head}
        <tr className="nomor-kolom">{Array.from({ length: cols }, (_, i) => <th key={i}>{i + 1}</th>)}</tr>
      </thead>
      <tbody>{children}{foot}</tbody>
    </table>
  );
}
