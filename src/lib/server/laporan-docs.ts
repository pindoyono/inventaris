import "server-only";
import type { Tx } from "@/db";
import { daftarBarang, laporanAset, laporanBmd, laporanPersediaan, laporanPenyusutan, type LapRow } from "@/lib/server/laporan-barang";
import { CAUSE, type NV } from "@/lib/server/bmd-ledger";
import type { Period } from "@/lib/period";
import { kodeBarang } from "@/lib/assets-shared";

export type Cell = string | number | bigint | null;
export type Col = { label: string; group?: string; kind?: "text" | "num" | "money" | "code" };
export type DocTable = { caption?: string; cols: Col[]; rows: Cell[][]; foot?: Cell[]; bold?: number[] };
export type Doc = { format: string; title: string; ket: string; landscape: boolean; tables: DocTable[]; note?: string; asOf?: boolean };

/** Format laporan barang Kuasa Pengguna (Permendagri 47/2021 Lampiran IV) yang tersedia */
export const FORMATS = {
  "IV.L.4.2": { title: "Laporan Barang Milik Daerah", desc: "Gabungan persediaan, aset tetap per jenis, dan aset lainnya — intra & ekstrakomptabel", ie: false },
  "IV.L.2.2": { title: "Laporan Aset Tetap Mutasi Tambah dan Mutasi Kurang menurut Objek", desc: "Saldo awal, tambah, kurang, saldo akhir per objek kode barang", ie: true },
  "IV.L.2.1": { title: "Rekapitulasi Penjelasan Laporan Aset Tetap Mutasi Tambah dan Mutasi Kurang", desc: "Rincian sebab mutasi: pengadaan, hibah, reklasifikasi, koreksi, penghapusan, pengeluaran internal, dll.", ie: true },
  "IV.L.2.3": { title: "Rekapitulasi Aset Tetap menurut Jenis", desc: "Per golongan KIB A–F", ie: true },
  "IV.L.3.2": { title: "Laporan Aset Lainnya Mutasi Tambah dan Mutasi Kurang menurut Objek", desc: "Aset tak berwujud", ie: true },
  "IV.L.1.1": { title: "Laporan Persediaan Mutasi Tambah dan Kurang menurut Objek", desc: "Nilai persediaan (FIFO) per objek", ie: false },
  "IV.H.4": { title: "Laporan Akumulasi Penyusutan atau Amortisasi BMD menurut Objek", desc: "Semesteran/tahunan — garis lurus", ie: false },
  "IV.H.5": { title: "Laporan Akumulasi Penyusutan atau Amortisasi BMD menurut Jenis", desc: "Semesteran/tahunan", ie: false },
  "IV.H.R": { title: "Rincian Penyusutan atau Amortisasi per Barang", desc: "Nilai buku tiap aset intrakomptabel", ie: false },
  DBKP: { title: "Daftar Barang Kuasa Pengguna", desc: "Seluruh BMD aset tetap & aset lainnya per golongan pada akhir periode", ie: false },
} as const;
export type FormatKey = keyof typeof FORMATS;
export const isFormat = (f: unknown): f is FormatKey => typeof f === "string" && f in FORMATS;
export const needsSemester = (f: FormatKey) => f.startsWith("IV.H");

const mut = (r: { open: NV; add: NV; sub: NV; close: NV }): Cell[] => [r.open.n, r.open.v, r.add.n, r.add.v, r.sub.n, r.sub.v, r.close.n, r.close.v];
const MUT_COLS: Col[] = [
  { label: "Jumlah", group: "Saldo Awal", kind: "num" }, { label: "Nilai (Rp)", group: "Saldo Awal", kind: "money" },
  { label: "Jumlah", group: "Mutasi Tambah", kind: "num" }, { label: "Nilai (Rp)", group: "Mutasi Tambah", kind: "money" },
  { label: "Jumlah", group: "Mutasi Kurang", kind: "num" }, { label: "Nilai (Rp)", group: "Mutasi Kurang", kind: "money" },
  { label: "Jumlah", group: "Saldo Akhir", kind: "num" }, { label: "Nilai (Rp)", group: "Saldo Akhir", kind: "money" },
];
const mutTable = (rows: LapRow[], total: { open: NV; add: NV; sub: NV; close: NV }): DocTable => ({
  cols: [{ label: "No", kind: "num" }, { label: "Kode Barang", kind: "code" }, { label: "Uraian" }, ...MUT_COLS],
  rows: rows.map((r, i) => [i + 1, r.code, r.name, ...mut(r)]),
  foot: ["", "", "Jumlah", ...mut(total)],
});

export async function buildDoc(tx: Tx, schoolId: string, p: Period, format: FormatKey, ekstra: boolean): Promise<Doc> {
  const f = FORMATS[format];
  const ie = f.ie ? (ekstra ? " Ekstrakomptabel" : " Intrakomptabel") : "";
  const base = { format, title: f.title + ie, ket: `Permendagri 47/2021 Format ${format === "IV.H.R" || format === "DBKP" ? format.replace("IV.H.R", "IV.H (rincian)") : format}`, landscape: true };
  const k = ekstra ? "ekstra" : "intra";

  if (format === "IV.L.2.2" || format === "IV.L.3.2") {
    const a = await laporanAset(tx, schoolId, p);
    const s = format === "IV.L.2.2" ? a.asetTetap[k] : a.asetLainnya[k];
    return { ...base, tables: [mutTable(s.rows, s.total)], note: "Jumlah = unit barang; perubahan nilai tanpa perubahan jumlah (kapitalisasi, pembayaran KDP, koreksi) dicatat pada kolom nilai." };
  }
  if (format === "IV.L.2.3") {
    const a = await laporanAset(tx, schoolId, p);
    const rows = a.jenis[k].filter((r) => !r.code.startsWith("1.5."));
    const t = { open: sum(rows.map((r) => r.open)), add: sum(rows.map((r) => r.add)), sub: sum(rows.map((r) => r.sub)), close: sum(rows.map((r) => r.close)) };
    return { ...base, tables: [mutTable(rows, t)] };
  }
  if (format === "IV.L.2.1") {
    const a = await laporanAset(tx, schoolId, p);
    const c = a.causes[k];
    const side = (label: string, m: Record<string, NV>, order: string[]): DocTable => {
      const keys = [...order.filter((x) => m[x]), ...Object.keys(m).filter((x) => !order.includes(x))];
      const t = sum(keys.map((x) => m[x]));
      return { caption: label, cols: [{ label: "No", kind: "num" }, { label: "Uraian" }, { label: "Jumlah Barang", kind: "num" }, { label: "Nilai (Rp)", kind: "money" }], rows: keys.map((x, i) => [i + 1, x, m[x].n, m[x].v]), foot: ["", "Jumlah", t.n, t.v] };
    };
    const ADD = [CAUSE.PEMBELIAN, CAUSE.HIBAH, CAUSE.PRODUKSI, CAUSE.INVENTARISASI, CAUSE.PENERIMAAN_INTERNAL, CAUSE.LAINNYA, CAUSE.PEMBAYARAN_KDP, CAUSE.KAPITALISASI, CAUSE.RECLASS_IN, CAUSE.KOREKSI_TAMBAH, CAUSE.BATAL_HAPUS];
    const SUB = [CAUSE.HAPUS, CAUSE.KELUAR_INTERNAL, CAUSE.RECLASS_OUT, CAUSE.KOREKSI_KURANG];
    return { ...base, landscape: false, tables: [side("A. Mutasi Tambah", c.add, ADD), side("B. Mutasi Kurang", c.sub, SUB)] };
  }
  if (format === "IV.L.1.1") {
    const rows = await laporanPersediaan(tx, p);
    const t = rows.reduce((a, r) => ({ open: a.open + r.open, add: a.add + r.add, sub: a.sub + r.sub, close: a.close + r.close }), { open: 0n, add: 0n, sub: 0n, close: 0n });
    return {
      ...base, landscape: false,
      tables: [{ cols: [{ label: "No", kind: "num" }, { label: "Kode Barang", kind: "code" }, { label: "Uraian" }, { label: "Saldo Awal (Rp)", kind: "money" }, { label: "Mutasi Tambah (Rp)", kind: "money" }, { label: "Mutasi Kurang (Rp)", kind: "money" }, { label: "Saldo Akhir (Rp)", kind: "money" }],
        rows: rows.map((r, i) => [i + 1, r.code, r.name, r.open, r.add, r.sub, r.close]), foot: ["", "", "Jumlah", t.open, t.add, t.sub, t.close] }],
      note: "Rincian per barang ada di Laporan Mutasi Persediaan (per NUSP).",
    };
  }
  if (format === "IV.L.4.2") {
    const rows = await laporanBmd(tx, schoolId, p);
    const cols: Col[] = [{ label: "No", kind: "num" }, { label: "Kode", kind: "code" }, { label: "Uraian" },
      ...["Saldo Awal", "Mutasi Tambah", "Mutasi Kurang", "Saldo Akhir"].map((g) => ({ label: g, group: "Intrakomptabel (Rp)", kind: "money" as const })),
      ...["Saldo Awal", "Mutasi Tambah", "Mutasi Kurang", "Saldo Akhir"].map((g) => ({ label: g, group: "Ekstrakomptabel (Rp)", kind: "money" as const }))];
    const v = (r: (typeof rows)[number]) => [r.intra.open, r.intra.add, r.intra.sub, r.intra.close, r.ekstra.open, r.ekstra.add, r.ekstra.sub, r.ekstra.close];
    const tot = rows.reduce((a, r) => v(r).map((x, i) => a[i] + x), [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
    return { ...base, tables: [{ cols, rows: rows.map((r, i) => [i + 1, r.code, r.name, ...v(r)]), foot: ["", "", "Jumlah", ...tot] }], note: "Persediaan dinilai FIFO. Aset tetap & aset lainnya menurut nilai perolehan (termasuk kapitalisasi), sebelum penyusutan." };
  }
  if (format === "IV.H.4" || format === "IV.H.5" || format === "IV.H.R") {
    const d = await laporanPenyusutan(tx, schoolId, p);
    const money = (label: string): Col => ({ label, kind: "money" });
    if (format === "IV.H.R") {
      const t = d.detail.reduce((a, r) => ({ value: a.value + r.value, accPrev: a.accPrev + r.accPrev, expense: a.expense + r.expense, acc: a.acc + r.acc, book: a.book + r.book }), { value: 0n, accPrev: 0n, expense: 0n, acc: 0n, book: 0n });
      return {
        ...base, title: f.title,
        tables: [{ cols: [{ label: "No", kind: "num" }, { label: "Kode Barang", kind: "code" }, { label: "Reg.", kind: "code" }, { label: "Nama Barang" }, { label: "Tgl Perolehan", kind: "code" }, { label: "Masa Manfaat (th)", kind: "num" }, money("Nilai Perolehan"), money("Akumulasi s.d. Periode Lalu"), money("Beban Periode Ini"), money("Akumulasi s.d. Akhir Periode"), money("Nilai Buku")],
          rows: d.detail.map((r, i) => [i + 1, kodeBarang(r.code), String(r.regNo).padStart(6, "0"), r.name, r.acqDate, r.life || "—", r.value, r.accPrev, r.expense, r.acc, r.book]),
          foot: ["", "", "", "Jumlah", "", "", t.value, t.accPrev, t.expense, t.acc, t.book] }],
        note: penyusutanNote,
      };
    }
    const list = format === "IV.H.4" ? d.objek : d.jenis;
    const t = list.reduce((a, r) => ({ n: a.n + r.n, value: a.value + r.value, accPrev: a.accPrev + r.accPrev, expense: a.expense + r.expense, acc: a.acc + r.acc, book: a.book + r.book }), { n: 0, value: 0n, accPrev: 0n, expense: 0n, acc: 0n, book: 0n });
    const withLife = format === "IV.H.4";
    return {
      ...base, title: f.title + " Intrakomptabel",
      tables: [{ cols: [{ label: "No", kind: "num" }, { label: "Kode Barang", kind: "code" }, { label: "Uraian" }, ...(withLife ? [{ label: "Masa Manfaat (th)", kind: "num" as const }] : []), { label: "Jumlah Barang", kind: "num" }, money("Nilai Perolehan"), money("Akumulasi s.d. Periode Lalu"), money("Beban Periode Ini"), money("Akumulasi s.d. Akhir Periode"), money("Nilai Buku")],
        rows: list.map((r, i) => [i + 1, r.code, r.name, ...(withLife ? [r.life || "—"] : []), r.n, r.value, r.accPrev, r.expense, r.acc, r.book]),
        foot: ["", "", "Jumlah", ...(withLife ? [""] : []), t.n, t.value, t.accPrev, t.expense, t.acc, t.book] }],
      note: penyusutanNote,
    };
  }
  // DBKP
  const groups = await daftarBarang(tx, schoolId, p.to);
  return {
    ...base, asOf: true,
    tables: [
      ...groups.map((g) => ({
        caption: `${g.code} — ${g.name}`,
        cols: [{ label: "No", kind: "num" as const }, { label: "Kode Barang", kind: "code" as const }, { label: "Nama Barang" }, { label: "Merk/Tipe" }, { label: "Nomor Register", kind: "code" as const }, { label: "Tahun", kind: "code" as const }, { label: "Jumlah", kind: "num" as const }, { label: "Nilai Perolehan (Rp)", kind: "money" as const }, { label: "Intra/Ekstra" }, { label: "Lokasi" }],
        rows: g.rows.map((r, i) => [i + 1, kodeBarang(r.code), r.name, r.brand ?? "-", r.regNos, r.year, r.qty, r.value, r.intra ? "Intra" : "Ekstra", r.rooms || "-"]),
        foot: ["", "", "Jumlah", "", "", "", g.qty, g.intra + g.ekstra, "", ""],
      })),
      {
        caption: "Rekapitulasi",
        cols: [{ label: "No", kind: "num" }, { label: "Kode", kind: "code" }, { label: "Jenis" }, { label: "Jumlah Barang", kind: "num" }, { label: "Intrakomptabel (Rp)", kind: "money" }, { label: "Ekstrakomptabel (Rp)", kind: "money" }, { label: "Jumlah (Rp)", kind: "money" }],
        rows: groups.map((g, i) => [i + 1, g.code, g.name, g.qty, g.intra, g.ekstra, g.intra + g.ekstra]),
        foot: ["", "", "Jumlah", groups.reduce((a, g) => a + g.qty, 0), groups.reduce((a, g) => a + g.intra, 0n), groups.reduce((a, g) => a + g.ekstra, 0n), groups.reduce((a, g) => a + g.intra + g.ekstra, 0n)],
      },
    ],
  };
}

const penyusutanNote = "Metode garis lurus per semester; semester perolehan dihitung penuh; nilai sisa nol. Masa manfaat menurut objek (Penyiapan › Kode BMD, sesuaikan dengan Perkada). Aset ekstrakomptabel, tanah, KDP, dan aset tetap lainnya tidak disusutkan.";
const sum = (xs: NV[]): NV => xs.reduce((a, x) => ({ n: a.n + x.n, v: a.v + x.v }), { n: 0, v: 0n });

/** Untuk Excel: header satu baris "Kelompok – Kolom" */
export function docToRows(d: Doc, header: string[]): Cell[][] {
  const out: Cell[][] = [...header.map((h) => [h]), []];
  for (const t of d.tables) {
    if (t.caption) out.push([t.caption]);
    out.push(t.cols.map((c) => (c.group ? `${c.group} – ${c.label}` : c.label)));
    out.push(...t.rows);
    if (t.foot) out.push(t.foot);
    out.push([]);
  }
  if (d.note) out.push([d.note]);
  return out;
}
