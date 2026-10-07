import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { bmdCodes } from "@/db/schema";
import { parseDec } from "@/lib/decimal";
import { jenisOf, objekOf, semEnd, semIndex, usefulLife } from "@/lib/depreciation-shared";

/**
 * Buku aset tetap yang direkonstruksi dari riwayat tiap aset: perolehan (masuk pembukuan), perubahan nilai,
 * reklasifikasi, penghapusan/pengeluaran internal, dan pembatalannya. Dipakai laporan barang (mutasi tambah/kurang)
 * dan penyusutan, sehingga keduanya selalu konsisten: saldo awal + tambah − kurang = saldo akhir.
 */

export type NV = { n: number; v: bigint };
const nv = (): NV => ({ n: 0, v: 0n });
const plus = (a: NV, n: number, v: bigint) => { a.n += n; a.v += v; };

export const CAUSE = {
  PEMBELIAN: "Pengadaan/pembelian",
  HIBAH: "Hibah/sumbangan",
  PRODUKSI: "Produksi/pembuatan sendiri",
  INVENTARISASI: "Hasil inventarisasi",
  PENERIMAAN_INTERNAL: "Penerimaan internal Pengguna Barang",
  LAINNYA: "Perolehan lain yang sah",
  PEMBAYARAN_KDP: "Pembayaran konstruksi dalam pengerjaan",
  KAPITALISASI: "Penambahan masa manfaat/kapasitas (kapitalisasi)",
  KOREKSI_TAMBAH: "Koreksi nilai (tambah)",
  KOREKSI_KURANG: "Koreksi nilai (kurang)",
  RECLASS_IN: "Reklasifikasi masuk",
  RECLASS_OUT: "Reklasifikasi keluar",
  HAPUS: "Penghapusan",
  KELUAR_INTERNAL: "Pengeluaran internal Pengguna Barang",
  BATAL_HAPUS: "Pembatalan penghapusan",
} as const;

type State = { exists: boolean; code: string; intra: boolean; acqDate: string; value: bigint };
type Ev =
  | { date: string; ord: 0; id: number; t: "ACQ" }
  | { date: string; ord: 1; id: number; t: "VAL"; kind: string; amount: bigint }
  | { date: string; ord: 2; id: number; t: "RECLASS"; code: string; intra: boolean; acqDate: string }
  | { date: string; ord: 3; id: number; t: "DEL" | "UNDEL"; internal?: boolean };

export type AssetTimeline = { id: string; origin: State; acquisition: string; events: Ev[] };

/** Awalan catatan riwayat untuk penyerahan ke Kuasa Pengguna Barang lain (lihat transfers.ts) */
export const INTERNAL_OUT_NOTE = "Pengeluaran internal";

/** Muat riwayat semua aset sekolah (dalam withSchool) */
export async function loadTimelines(tx: Tx, schoolId: string, onlyAssetId?: string): Promise<AssetTimeline[]> {
  void schoolId;
  const one = (col: string) => (onlyAssetId ? sql`and ${sql.raw(col)} = ${onlyAssetId}` : sql``);
  const [assetRows, vals, changes, evs] = await Promise.all([
    tx.execute(sql`select id, bmd_code, is_intra, acq_date::text, acq_price::text, acquisition from assets where true ${one("id")}`),
    tx.execute(sql`select id, asset_id, date::text, kind, amount::text from asset_value_changes where true ${one("asset_id")} order by id`),
    tx.execute(sql`select id, asset_id, date::text, before, after from asset_changes where kind = 'REKLASIFIKASI' ${one("asset_id")} order by id`),
    tx.execute(sql`select id, asset_id, date::text, kind, from_status, to_status, note from asset_events
      where (kind = 'DICATAT' or (kind = 'STATUS' and (from_status = 'DIHAPUS' or to_status = 'DIHAPUS'))) ${one("asset_id")} order by id`),
  ]);
  type A = { id: string; bmd_code: string; is_intra: boolean; acq_date: string; acq_price: string; acquisition: string };
  type V = { id: number; asset_id: string; date: string; kind: string; amount: string };
  type C = { id: number; asset_id: string; date: string; before: Record<string, unknown>; after: Record<string, unknown> };
  type E = { id: number; asset_id: string; date: string; kind: string; from_status: string | null; to_status: string | null; note: string | null };
  const group = <T extends { asset_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.asset_id, [...(m.get(r.asset_id) ?? []), r]);
    return m;
  };
  const vBy = group([...vals] as unknown as V[]);
  const cBy = group([...changes] as unknown as C[]);
  const eBy = group([...evs] as unknown as E[]);

  return ([...assetRows] as unknown as A[]).map((a) => {
    const vs = vBy.get(a.id) ?? [];
    const cs = cBy.get(a.id) ?? [];
    const es = eBy.get(a.id) ?? [];
    // Keadaan awal = keadaan kini dibalik melalui semua reklasifikasi
    let code = a.bmd_code, intra = a.is_intra, acqDate = a.acq_date;
    for (const c of [...cs].reverse()) {
      code = String(c.before.bmdCode ?? code);
      intra = Boolean(c.before.isIntra ?? intra);
      acqDate = String(c.before.acqDate ?? acqDate);
    }
    const value = parseDec(a.acq_price) - vs.reduce((s, v) => s + parseDec(v.amount), 0n);
    const dicatat = es.find((e) => e.kind === "DICATAT")?.date;
    // Masuk pembukuan: tanggal perolehan, kecuali penerimaan internal (tanggal BAST penerimaan)
    const entry = a.acquisition === "PENERIMAAN_INTERNAL" && dicatat ? dicatat : acqDate;
    const events: Ev[] = [
      { date: entry, ord: 0, id: 0, t: "ACQ" } as Ev,
      ...vs.map((v): Ev => ({ date: v.date, ord: 1, id: v.id, t: "VAL", kind: v.kind, amount: parseDec(v.amount) })),
      ...cs.map((c): Ev => ({ date: c.date, ord: 2, id: c.id, t: "RECLASS", code: String(c.after.bmdCode), intra: Boolean(c.after.isIntra), acqDate: String(c.after.acqDate) })),
      ...es.filter((e) => e.kind === "STATUS").map((e): Ev => ({ date: e.date, ord: 3, id: e.id, t: e.to_status === "DIHAPUS" ? "DEL" : "UNDEL", internal: !!e.note?.startsWith(INTERNAL_OUT_NOTE) })),
    ].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.ord - y.ord || x.id - y.id));
    return { id: a.id, origin: { exists: false, code, intra, acqDate, value }, acquisition: a.acquisition, events };
  });
}

/** Keadaan aset pada akhir tanggal `date` */
export function stateAt(t: AssetTimeline, date: string): State {
  const s = { ...t.origin };
  for (const e of t.events) {
    if (e.date > date) break;
    apply(s, e);
  }
  return s;
}

function apply(s: State, e: Ev) {
  if (e.t === "ACQ") s.exists = true;
  else if (e.t === "VAL") s.value += e.amount;
  else if (e.t === "RECLASS") Object.assign(s, { code: e.code, intra: e.intra, acqDate: e.acqDate });
  else if (e.t === "DEL") s.exists = false;
  else s.exists = true;
}

export type MoveRow = { code: string; intra: boolean; open: NV; add: Record<string, NV>; sub: Record<string, NV>; addT: NV; subT: NV; close: NV };

/** Mutasi per objek × intra/ekstra pada periode [from, to] */
export function movements(timelines: AssetTimeline[], from: string, to: string) {
  const rows = new Map<string, MoveRow>();
  const row = (code: string, intra: boolean) => {
    const k = `${objekOf(code)}|${intra ? 1 : 0}`;
    let r = rows.get(k);
    if (!r) rows.set(k, (r = { code: objekOf(code), intra, open: nv(), add: {}, sub: {}, addT: nv(), subT: nv(), close: nv() }));
    return r;
  };
  const add = (code: string, intra: boolean, cause: string, n: number, v: bigint) => { const r = row(code, intra); plus((r.add[cause] ??= nv()), n, v); plus(r.addT, n, v); };
  const sub = (code: string, intra: boolean, cause: string, n: number, v: bigint) => { const r = row(code, intra); plus((r.sub[cause] ??= nv()), n, v); plus(r.subT, n, v); };

  for (const t of timelines) {
    const s = { ...t.origin };
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      if (s.exists) plus(row(s.code, s.intra).open, 1, s.value);
    };
    for (const e of t.events) {
      if (e.date > to) break;
      const inP = e.date >= from;
      if (inP) open();
      const was = { ...s };
      apply(s, e);
      if (!inP) continue;
      if (e.t === "ACQ" && !was.exists) add(s.code, s.intra, CAUSE[t.acquisition as keyof typeof CAUSE] ?? CAUSE.LAINNYA, 1, s.value);
      else if (e.t === "VAL" && s.exists && e.amount !== 0n) {
        const cause = e.kind === "KOREKSI" ? (e.amount > 0n ? CAUSE.KOREKSI_TAMBAH : CAUSE.KOREKSI_KURANG) : CAUSE[e.kind as "KAPITALISASI"] ?? e.kind;
        if (e.amount > 0n) add(s.code, s.intra, cause, 0, e.amount);
        else sub(s.code, s.intra, cause, 0, -e.amount);
      } else if (e.t === "RECLASS" && s.exists && (objekOf(was.code) !== objekOf(s.code) || was.intra !== s.intra)) {
        sub(was.code, was.intra, CAUSE.RECLASS_OUT, 1, was.value);
        add(s.code, s.intra, CAUSE.RECLASS_IN, 1, s.value);
      } else if (e.t === "DEL" && was.exists) sub(was.code, was.intra, e.internal ? CAUSE.KELUAR_INTERNAL : CAUSE.HAPUS, 1, was.value);
      else if (e.t === "UNDEL" && !was.exists) add(s.code, s.intra, CAUSE.BATAL_HAPUS, 1, s.value);
    }
    open();
    if (s.exists) plus(row(s.code, s.intra).close, 1, s.value);
  }
  return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code) || Number(b.intra) - Number(a.intra));
}

/** Nama kode (objek/jenis) dari referensi Permendagri 108 */
export async function codeTitles(codes: string[]) {
  const uniq = [...new Set(codes)];
  if (!uniq.length) return new Map<string, string>();
  const r = await db.select({ code: bmdCodes.code, name: bmdCodes.name }).from(bmdCodes).where(inArray(bmdCodes.code, uniq));
  return new Map(r.map((x) => [x.code, x.name.charAt(0) + x.name.slice(1).toLowerCase()]));
}

export const groupOf = (code: string) => (code.startsWith("1.5.") ? "ATB" : "AT");
export { jenisOf, objekOf };

// ───────── penyusutan

export type Depreciation = { value: bigint; acc: bigint; life: number; depreciable: boolean };

/**
 * Penyusutan garis lurus per semester (semester perolehan dihitung penuh, nilai sisa 0) s.d. akhir semester `x`.
 * Hanya aset intrakomptabel dengan masa manfaat > 0. Koreksi nilai berlaku surut; kapitalisasi sesudah mulai
 * disusutkan selama sisa masa manfaat (prospektif).
 */
export function depreciationAt(t: AssetTimeline, x: number, lifeOverrides: Record<string, number>): Depreciation | null {
  const end = semEnd(x);
  const s = stateAt(t, end);
  if (!s.exists) return null;
  const years = s.intra ? usefulLife(s.code, lifeOverrides) : 0;
  if (!years) return { value: s.value, acc: 0n, life: years, depreciable: false };
  const L = years * 2;
  const s0 = semIndex(s.acqDate);
  if (x < s0) return { value: s.value, acc: 0n, life: years, depreciable: true };
  const later = t.events.filter((e): e is Extract<Ev, { t: "VAL" }> => e.t === "VAL" && e.kind !== "KOREKSI" && e.date > s.acqDate && e.date <= end);
  const base = s.value - later.reduce((a, e) => a + e.amount, 0n);
  const portion = (amount: bigint, start: number, len: number) => {
    const n = Math.min(len, x - start + 1);
    return n <= 0 ? 0n : (amount * BigInt(n)) / BigInt(len);
  };
  let acc = portion(base, s0, L);
  for (const e of later) {
    const sk = semIndex(e.date);
    acc += portion(e.amount, sk, Math.max(1, L - (sk - s0)));
  }
  if (acc > s.value) acc = s.value;
  return { value: s.value, acc, life: years, depreciable: true };
}
