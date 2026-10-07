import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assets, disposalLines, disposals, rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { DISPOSAL_REASON_LABEL } from "@/lib/server/disposal";
import { CONDITION_LABEL, KIB_LABEL, kodeBarang, registerCode } from "@/lib/assets-shared";
import { fmtRp, parseDec } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, Tabel, Ttd } from "@/components/cetak/print";
import { TRANSFER_FORM_LABEL } from "@/lib/utilization-shared";

export const metadata: Metadata = { title: "Cetak Usulan Penghapusan" };

/** Surat usulan + daftar barang usulan penghapusan (Permendagri 19/2016 jo. 7/2024) */
export default async function CetakPenghapusan({ params, searchParams }: PageProps<"/cetak/penghapusan/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [d] = await tx.select().from(disposals).where(eq(disposals.id, id));
    if (!d || !d.number) return null;
    const lines = await tx.select({ l: disposalLines, a: assets, room: rooms.name }).from(disposalLines).innerJoin(assets, eq(assets.id, disposalLines.assetId)).leftJoin(rooms, eq(rooms.id, assets.roomId)).where(eq(disposalLines.disposalId, id)).orderBy(asc(assets.bmdCode), asc(assets.regNo));
    return { d, lines, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { d, c, lines } = data;
  const total = lines.reduce((a, x) => a + parseDec(x.a.acqPrice), 0n);
  const tgl = tanggalPanjang(d.letterDate ?? d.date);
  const kepada = c.parts.ownershipCode === "11" ? `Gubernur ${c.provinsi}` : `Bupati/Wali Kota ${c.kota}`;
  const reasons = [...new Set(lines.map((x) => DISPOSAL_REASON_LABEL[x.l.reason].toLowerCase()))].join(", ");

  if (sp.format === "rkbmd" || sp.format === "rkbmd-pemindahtanganan") {
    // Permendagri 7/2024 Lampiran A.5 (Penghapusan) / A.3 (Pemindahtanganan) — RKBMD oleh Kuasa Pengguna Barang
    const pt = sp.format === "rkbmd-pemindahtanganan";
    const ta = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? sp.tahun : String(Number(d.date.slice(0, 4)) + 1);
    const sel = lines.filter((x) => (x.l.followUp === "PEMINDAHTANGANAN") === pt);
    const selTotal = sel.reduce((a, x) => a + parseDec(x.a.acqPrice), 0n);
    // Baris digabung per kode barang + nama + spesifikasi + alasan (+ bentuk) (kolom "Jumlah Barang")
    const groups = new Map<string, typeof lines>();
    for (const x of sel) {
      const k = [x.a.bmdCode, x.a.name, x.a.brand ?? "", x.l.reason, x.l.transferForm ?? ""].join("|");
      groups.set(k, [...(groups.get(k) ?? []), x]);
    }
    const rows = [...groups.values()];
    const spec = (x: (typeof lines)[number]) => [x.a.brand, x.a.attrs.ukuran, x.a.attrs.bahan].filter(Boolean).join(", ") || "-";
    return (
      <Halaman judul={pt ? "RKBMD Rencana Pemindahtanganan" : "RKBMD Rencana Penghapusan"} ket={`Permendagri 7/2024 — Format RKBMD untuk ${pt ? "Pemindahtanganan" : "Penghapusan"} oleh Kuasa Pengguna Barang`} orientasi="lanskap" rapat>
        <div className="judul" style={{ marginBottom: "3mm" }}>
          <div className="sub">Rencana Kebutuhan Barang Milik Daerah</div>
          <div className="sub">({pt ? "Rencana Pemindahtanganan" : "Rencana Penghapusan"})</div>
          <div className="sub">Kuasa Pengguna Barang {c.school.name}</div>
          <div className="sub">Tahun Anggaran {ta}</div>
        </div>
        <Identitas rows={[["Pengguna Barang", c.dinasName], ["Kab/Kota", c.parts.ownershipCode === "12" ? c.kota : "-"], ["Provinsi", c.provinsi]]} />
        {pt ? (
          <Tabel cols={11} head={<tr><th>No</th><th>Kode Barang</th><th>Nama Barang</th><th>Spesifikasi Nama Barang</th><th>NIBAR</th><th>Jumlah Barang</th><th>Lokasi</th><th>Nilai Perolehan (Rp)</th><th>Bentuk Pemindahtanganan</th><th>Alasan Rencana Pemindahtanganan</th><th>Ket.</th></tr>}
            foot={<tr className="jumlah"><td colSpan={7} className="angka">JUMLAH</td><td className="angka">{fmtRp(selTotal)}</td><td colSpan={3} /></tr>}>
            {rows.map((g, i) => {
              const x = g[0];
              return (
                <tr key={x.l.id}>
                  <td className="tengah">{i + 1}</td><td className="kode">{kodeBarang(x.a.bmdCode)}</td><td>{x.a.name}</td><td>{spec(x)}</td><td className="kode">-</td>
                  <td className="tengah">{g.length} unit</td><td>{[...new Set(g.map((y) => y.room ?? c.school.name))].join(", ")}</td>
                  <td className="angka">{fmtRp(g.reduce((a2, y) => a2 + parseDec(y.a.acqPrice), 0n))}</td>
                  <td>{x.l.transferForm ? TRANSFER_FORM_LABEL[x.l.transferForm] : "Penjualan"}</td><td>{DISPOSAL_REASON_LABEL[x.l.reason]}</td>
                  <td>No. register {g.map((y) => String(y.a.regNo).padStart(6, "0")).join(", ")}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr className="kosong"><td colSpan={11} className="tengah">Tidak ada barang yang diusulkan pemindahtanganan</td></tr>}
          </Tabel>
        ) : (
          <Tabel cols={9} head={<tr><th>No</th><th>Kode Barang</th><th>Nama Barang</th><th>Spesifikasi Nama Barang</th><th>NIBAR</th><th>Jumlah Barang</th><th>Nilai Perolehan (Rp)</th><th>Alasan Rencana Penghapusan</th><th>Ket.</th></tr>}
            foot={<tr className="jumlah"><td colSpan={6} className="angka">JUMLAH</td><td className="angka">{fmtRp(selTotal)}</td><td colSpan={2} /></tr>}>
            {rows.map((g, i) => {
              const x = g[0];
              const regs = g.map((y) => String(y.a.regNo).padStart(6, "0")).join(", ");
              return (
                <tr key={x.l.id}>
                  <td className="tengah">{i + 1}</td><td className="kode">{kodeBarang(x.a.bmdCode)}</td><td>{x.a.name}</td>
                  <td>{spec(x)}</td>
                  <td className="kode" style={{ whiteSpace: "normal" }}>-</td>
                  <td className="tengah">{g.length} unit</td><td className="angka">{fmtRp(g.reduce((a2, y) => a2 + parseDec(y.a.acqPrice), 0n))}</td>
                  <td>{DISPOSAL_REASON_LABEL[x.l.reason]}</td><td>No. register {regs}{x.l.policeLetter ? `; surat polisi ${x.l.policeLetter}` : ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr className="kosong"><td colSpan={9} className="tengah">Tidak ada barang</td></tr>}
          </Tabel>
        )}
        <p className="catatan">NIBAR (nomor induk barang) diisi oleh Pengelola/Pengguna Barang bila sudah ditetapkan; kolom keterangan memuat nomor register sekolah.{pt ? "" : " Barang yang diusulkan pemindahtanganan dicantumkan pada RKBMD Pemindahtanganan."}</p>
        <Ttd c={c} tanggal={tgl} cols={[{ jabatan: <>Kuasa Pengguna Barang<br />Kepala {c.school.name}</>, signer: c.kepsek }]} />
      </Halaman>
    );
  }

  return (
    <>
      <Halaman judul="Surat Usulan Penghapusan" ket="Permendagri 19/2016 jo. 7/2024 — permohonan penghapusan BMD">
        <Kop c={c} />
        <Identitas rows={[["Nomor", d.letterNumber ?? "……………………"], ["Lampiran", "1 (satu) berkas"], ["Perihal", <b key="p">Usulan Penghapusan Barang Milik Daerah</b>]]} />
        <p className="paragraf" style={{ marginTop: "4mm" }}>Kepada Yth.<br />{kepada}<br />melalui Kepala {c.dinasName}<br />di tempat</p>
        <p className="paragraf">Dengan hormat, bersama ini kami mengusulkan penghapusan Barang Milik Daerah pada {c.school.name} sebanyak <b>{lines.length} unit</b> dengan nilai perolehan <b>Rp{fmtRp(total)}</b>, karena {reasons}, sebagaimana daftar terlampir (usulan nomor {d.number}).</p>
        <p className="paragraf">Data barang memuat tahun perolehan, kode barang, kode register, nama, jenis, identitas, kondisi, lokasi, dan nilai perolehan.{lines.some((x) => x.l.reason === "KECURIAN") ? " Untuk barang yang hilang karena kecurian dilampirkan surat keterangan dari kepolisian." : ""} Demikian usulan ini kami sampaikan, atas perhatian dan persetujuannya diucapkan terima kasih.</p>
        <Ttd c={c} tanggal={tgl} cols={[{ jabatan: <>Kepala Sekolah<br />selaku Kuasa Pengguna Barang</>, signer: c.kepsek }]} />
      </Halaman>
      <Halaman judul="Daftar Barang Usulan Penghapusan" ket="Lampiran surat usulan" orientasi="lanskap" rapat>
        <Kop c={c} />
        <Judul title="Daftar Barang Usulan Penghapusan" nomor={<>Lampiran surat nomor {d.letterNumber ?? "……"} · Usulan {d.number}</>} />
        <Tabel cols={11} head={<tr><th>No</th><th>Kode Register</th><th>Nama Barang</th><th>Jenis</th><th>Identitas / Merk</th><th>Tahun</th><th>Kondisi</th><th>Lokasi</th><th>Nilai Perolehan (Rp)</th><th>Alasan</th><th>Keterangan</th></tr>}
          foot={<tr className="jumlah"><td colSpan={8} className="angka">JUMLAH ({lines.length} unit)</td><td className="angka">{fmtRp(total)}</td><td colSpan={2} /></tr>}>
          {lines.map(({ l, a, room }, i) => {
            const reg = registerCode(c.parts, a);
            const ident = [a.brand, a.attrs.noPabrik, a.attrs.noRangka, a.attrs.noMesin, a.attrs.noPolisi].filter(Boolean).join(" · ");
            return (
              <tr key={l.id}><td className="tengah">{i + 1}</td><td className="kode">{reg.top}<br />{reg.bottom}</td><td>{a.name}</td><td>{(KIB_LABEL[a.kib] ?? a.kib).split(" — ")[1] ?? a.kib}</td><td>{ident || "-"}</td>
                <td className="tengah">{a.acqDate.slice(0, 4)}</td><td className="tengah">{CONDITION_LABEL[a.condition]}</td><td>{room ?? "-"}</td><td className="angka">{fmtRp(a.acqPrice)}</td>
                <td>{DISPOSAL_REASON_LABEL[l.reason]}</td><td>{[l.policeLetter ? `Surat polisi ${l.policeLetter}` : "", l.note ?? ""].filter(Boolean).join("; ")}</td></tr>
            );
          })}
        </Tabel>
        <Ttd c={c} tanggal={tgl} cols={[{ jabatan: <>Kepala Sekolah<br />selaku Kuasa Pengguna Barang</>, signer: c.kepsek }, { jabatan: "Pengurus Barang Pembantu", signer: c.pengurus }]} />
      </Halaman>
    </>
  );
}
