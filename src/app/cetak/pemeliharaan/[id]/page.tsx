import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assets, fundingComponents, fundingSources, maintenances, rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadPrintContext } from "@/lib/server/print";
import { todayWita } from "@/lib/server/ledger";
import { CONDITION_LABEL, registerCode } from "@/lib/assets-shared";
import { fmtRp, parseDec } from "@/lib/decimal";
import { tanggalPanjang } from "@/lib/terbilang";
import { Halaman, Identitas, Judul, Kop, KodeLokasi, kepsekCol, pengurusCol, Tabel, Ttd } from "@/components/cetak/print";

export const metadata: Metadata = { title: "Cetak Kartu Pemeliharaan" };
const fmtD = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "-");
const KIND = { RUTIN: "Rutin", PERBAIKAN: "Perbaikan", PENINGKATAN: "Peningkatan" } as const;

/** Kartu pemeliharaan per aset (Permendagri 47/2021 Pasal 40). [id] = id aset */
export default async function CetakPemeliharaan({ params }: PageProps<"/cetak/pemeliharaan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [a] = await tx.select({ a: assets, room: rooms.name }).from(assets).leftJoin(rooms, eq(rooms.id, assets.roomId)).where(eq(assets.id, id));
    if (!a) return null;
    const list = await tx.select({ m: maintenances, fs: fundingSources.name, fc: fundingComponents.name }).from(maintenances).leftJoin(fundingSources, eq(fundingSources.id, maintenances.fundingSourceId)).leftJoin(fundingComponents, eq(fundingComponents.id, maintenances.fundingComponentId)).where(eq(maintenances.assetId, id)).orderBy(asc(maintenances.startDate));
    return { ...a, list, c: await loadPrintContext(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { a, c, list } = data;
  const reg = registerCode(c.parts, a);
  return (
    <Halaman judul="Kartu Pemeliharaan" ket="Permendagri 47/2021 Pasal 40" rapat>
      <Kop c={c} />
      <Judul title="Kartu Pemeliharaan Barang" />
      <Identitas rows={[["Kode Lokasi", <KodeLokasi key="k" c={c} />], ["Kode Register", <span key="r" style={{ fontFamily: "monospace" }}>{reg.top} / {reg.bottom}</span>], ["Nama / Merk", `${a.name}${a.brand ? ` · ${a.brand}` : ""}`], ["Tahun Perolehan", a.acqDate.slice(0, 4)], ["Lokasi", data.room ?? "-"]]} />
      <Tabel cols={9} head={<tr><th>No</th><th>Tanggal</th><th>Jenis</th><th>Uraian Pemeliharaan</th><th>Pelaksana</th><th>Kondisi Sebelum → Sesudah</th><th>Biaya (Rp)</th><th>Sumber Dana</th><th>Paraf</th></tr>}
        foot={<tr className="jumlah"><td colSpan={6} className="angka">JUMLAH</td><td className="angka">{fmtRp(list.reduce((s2, x) => s2 + parseDec(x.m.cost), 0n))}</td><td colSpan={2} /></tr>}>
        {list.map(({ m, fs, fc }, i) => (
          <tr key={m.id}><td className="tengah">{i + 1}</td><td className="tengah">{fmtD(m.startDate)}{m.endDate && m.endDate !== m.startDate ? ` s/d ${fmtD(m.endDate)}` : ""}</td><td className="tengah">{KIND[m.kind]}</td><td>{m.description}</td><td>{m.executor ?? "-"}</td>
            <td className="tengah">{CONDITION_LABEL[m.conditionBefore]} → {m.conditionAfter ? CONDITION_LABEL[m.conditionAfter] : "(berjalan)"}</td><td className="angka">{fmtRp(m.cost)}</td><td>{fs ?? "-"}{fc ? ` — ${fc}` : ""}</td><td /></tr>
        ))}
        {list.length === 0 && <tr className="kosong"><td colSpan={9} className="tengah">Belum ada pemeliharaan</td></tr>}
      </Tabel>
      <Ttd c={c} tanggal={tanggalPanjang(todayWita())} cols={[kepsekCol(c), pengurusCol(c)]} />
    </Halaman>
  );
}
