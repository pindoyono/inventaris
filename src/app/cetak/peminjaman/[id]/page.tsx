import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { assets, loanLines, loans, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, Tabel, Ttd } from "@/components/cetak/print";
import { loanScope } from "@/app/(sekolah)/peminjaman/scope";

export const metadata: Metadata = { title: "Cetak Kartu Peminjaman" };
const wita = (d: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Makassar" }).format(d);
const isoW = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(d);
const fmtD = (d: Date) => { const s = isoW(d); return `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}`; };

export default async function CetakPeminjaman({ params }: PageProps<"/cetak/peminjaman/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR", "PEMINJAM"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [l] = await tx.select().from(loans).where(and(eq(loans.id, id), loanScope(s)));
    if (!l || !l.loanedAt) return null;
    const lines = await tx.select({ x: loanLines, a: assets }).from(loanLines).innerJoin(assets, eq(assets.id, loanLines.assetId)).where(eq(loanLines.loanId, id)).orderBy(asc(assets.bmdCode), asc(assets.regNo));
    const [b] = l.borrowerUserId ? await tx.select({ nip: users.nip }).from(users).where(eq(users.id, l.borrowerUserId)) : [];
    const [h] = l.handedBy ? await tx.select({ name: users.name, nip: users.nip }).from(users).where(eq(users.id, l.handedBy)) : [];
    return { l, lines, borrowerNip: b?.nip ?? null, handed: h, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { l, c, lines } = data;
  const notes = lines.map((x, i) => (x.x.returnNote ? `no. ${i + 1}: ${x.x.returnNote}` : null)).filter(Boolean);
  return (
    <Halaman judul="Kartu Peminjaman" ket="Dokumen internal sekolah — peminjaman alat">
      <Kop c={c} />
      <Judul title="Kartu Peminjaman Barang" nomor={<>Nomor: {l.number}</>} />
      <Identitas rows={[
        ["Nama Peminjam", l.borrowerName], [data.borrowerNip ? "NIP" : "Kelas / NIS", data.borrowerNip ?? l.borrowerInfo ?? "-"], ["Keperluan", l.purpose ?? "-"],
        ["Tanggal Pinjam", wita(l.loanedAt!)], ["Batas Pengembalian", wita(l.dueAt)],
      ]} />
      <Tabel cols={7} head={<>
        <tr><th rowSpan={2}>No</th><th rowSpan={2}>Kode Barang / No. Register</th><th rowSpan={2}>Nama / Merk / Tipe</th><th colSpan={2}>Kondisi</th><th rowSpan={2}>Tgl<br />Kembali</th><th rowSpan={2}>Paraf<br />Petugas</th></tr>
        <tr><th>Pinjam</th><th>Kembali</th></tr></>}>
        {lines.map(({ x, a }, i) => (
          <tr key={x.id}>
            <td className="tengah">{i + 1}</td><td className="kode">{a.bmdCode}<br />{String(a.regNo).padStart(6, "0")}</td><td>{a.name}{a.brand ? ` · ${a.brand}` : ""}</td>
            <td className="tengah">{x.conditionOut ? CONDITION_LABEL[x.conditionOut] : "-"}</td><td className="tengah">{x.conditionIn ? CONDITION_LABEL[x.conditionIn] : ""}</td>
            <td className="tengah">{x.returnedAt ? fmtD(x.returnedAt) : ""}</td><td />
          </tr>
        ))}
      </Tabel>
      <p className="catatan">Peminjam bertanggung jawab atas kerusakan atau kehilangan barang selama masa peminjaman.{notes.length ? ` Catatan pengembalian ${notes.join("; ")}.` : ""}</p>
      <Ttd c={c} tanggal={tanggalPanjang(isoW(l.loanedAt!))} cols={[{ jabatan: "Peminjam", signer: { name: l.borrowerName, nip: data.borrowerNip }, nipLabel: data.borrowerNip ? "NIP." : "NIS/NIP." }, { jabatan: "Petugas Barang", signer: data.handed ?? c.pengurus }]} />
    </Halaman>
  );
}
