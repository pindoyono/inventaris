import "server-only";
import { sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { bmdCodes } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { parseDec } from "@/lib/decimal";
import { JENIS_BMD } from "@/lib/server/reports";
import { TRANSFER_FORM_LABEL, UTIL_FORM_LABEL } from "@/lib/utilization-shared";

/** Jumlah & nilai untuk satu tahap */
export type NV = { n: number; v: bigint };
const zero = (): NV => ({ n: 0, v: 0n });
const add = (a: NV, v: string) => { a.n += 1; a.v += parseDec(v); };
export type StageRow = { code: string; name: string; plan: NV; ok: NV; run: NV };
export type StageGroup = { label: string; rows: StageRow[]; total: Omit<StageRow, "code" | "name"> };

const jenisOf = (kib: string) => JENIS_BMD.find((j) => j.kib === kib) ?? { kib, code: "1.3.6", name: "Konstruksi Dalam Pengerjaan" };

function totals(rows: StageRow[]) {
  const t = { plan: zero(), ok: zero(), run: zero() };
  for (const r of rows) for (const k of ["plan", "ok", "run"] as const) { t[k].n += r[k].n; t[k].v += r[k].v; }
  return t;
}

/** Baris jenis (A–E, ATB) yang punya data, urut sesuai petunjuk pengisian */
function byJenis(items: { kib: string; stage: "plan" | "ok" | "run"; v: string }[]): StageRow[] {
  const m = new Map<string, StageRow>();
  for (const it of items) {
    const j = jenisOf(it.kib);
    const r = m.get(j.code) ?? { code: j.code, name: j.name, plan: zero(), ok: zero(), run: zero() };
    add(r[it.stage], it.v);
    m.set(j.code, r);
  }
  return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
}

type UtilLine = { kind: string; form: string | null; plan_year: number; status: string; without_approval: boolean; approval_date: string | null; start_date: string | null; ended_date: string | null; kib: string; v: string };

async function utilLines(tx: Tx): Promise<UtilLine[]> {
  const r = await tx.execute(sql`
    select u.kind, u.form, u.plan_year, u.status, u.without_approval, u.approval_date::text, u.start_date::text, u.ended_date::text, a.kib, a.acq_price::text v
    from utilization_lines l join utilizations u on u.id = l.utilization_id join assets a on a.id = l.asset_id`);
  return [...r] as unknown as UtilLine[];
}

const activeIn = (l: { status: string; start_date: string | null; ended_date: string | null }, y: number) =>
  (l.status === "BERJALAN" || l.status === "SELESAI") && !!l.start_date && l.start_date <= `${y}-12-31` && (!l.ended_date || l.ended_date >= `${y}-01-01`);

/**
 * C.5 (penggunaan sementara), C.7 (dioperasikan pihak lain), C.9 (pemanfaatan, per bentuk):
 * Rencana = tercantum di RKBMD tahun tsb; Persetujuan = persetujuan bertanggal tahun tsb; Pelaksanaan = berjalan pada tahun tsb.
 */
export async function utilStageData(tx: Tx, kind: "PEMANFAATAN" | "PENGGUNAAN_SEMENTARA" | "OPERASIONAL_PIHAK_LAIN", year: number): Promise<StageGroup[]> {
  const lines = (await utilLines(tx)).filter((l) => l.kind === kind && !l.without_approval);
  const stageItems = (ls: UtilLine[]) =>
    ls.flatMap((l) => [
      ...(l.plan_year === year && l.status !== "DIBATALKAN" ? [{ kib: l.kib, stage: "plan" as const, v: l.v }] : []),
      ...(l.approval_date?.startsWith(String(year)) ? [{ kib: l.kib, stage: "ok" as const, v: l.v }] : []),
      ...(activeIn(l, year) ? [{ kib: l.kib, stage: "run" as const, v: l.v }] : []),
    ]);
  const groups = kind === "PEMANFAATAN" ? (Object.keys(UTIL_FORM_LABEL) as (keyof typeof UTIL_FORM_LABEL)[]) : [null];
  return groups.map((g) => {
    const rows = byJenis(stageItems(lines.filter((l) => g === null || l.form === g)));
    return { label: g ? UTIL_FORM_LABEL[g] : "", rows, total: totals(rows) };
  });
}

/** C.11 — pemanfaatan yang berjalan tanpa persetujuan pada tahun tsb, per bentuk */
export async function utilNoApprovalData(tx: Tx, year: number) {
  const lines = (await utilLines(tx)).filter((l) => l.kind === "PEMANFAATAN" && l.without_approval && activeIn(l, year));
  return (Object.keys(UTIL_FORM_LABEL) as (keyof typeof UTIL_FORM_LABEL)[]).map((f) => {
    const rows = byJenis(lines.filter((l) => l.form === f).map((l) => ({ kib: l.kib, stage: "run" as const, v: l.v })));
    return { label: UTIL_FORM_LABEL[f], rows, total: totals(rows) };
  });
}

/** A.1 — RKBMD Pemanfaatan: rencana per barang untuk tahun anggaran */
export async function rkbmdPemanfaatanData(tx: Tx, year: number) {
  const r = await tx.execute(sql`
    select u.id, u.form, u.purpose, u.term, u.note, a.bmd_code, a.name, a.brand, a.reg_no, a.attrs, l.portion, rm.name as room
    from utilizations u join utilization_lines l on l.utilization_id = u.id join assets a on a.id = l.asset_id left join rooms rm on rm.id = a.room_id
    where u.kind = 'PEMANFAATAN' and u.plan_year = ${year} and u.status not in ('DIBATALKAN')
    order by a.bmd_code, a.reg_no`);
  const rows = [...r] as unknown as { id: string; form: keyof typeof UTIL_FORM_LABEL; purpose: string; term: string | null; note: string | null; bmd_code: string; name: string; brand: string | null; reg_no: number; attrs: Record<string, string>; portion: string | null; room: string | null }[];
  const names = await codeNames(rows.map((x) => x.bmd_code));
  return rows.map((x) => ({ ...x, codeName: names.get(x.bmd_code) ?? "", formLabel: UTIL_FORM_LABEL[x.form] }));
}

/**
 * C.13 — Pemindahtanganan per bentuk: Rencana = barang di usulan (diajukan) tahun tsb dengan tindak lanjut pemindahtanganan;
 * Persetujuan & Pelaksanaan = disetujui SK tahun tsb dan dihapus dari daftar barang sekolah.
 */
export async function pemindahtangananData(tx: Tx, year: number): Promise<StageGroup[]> {
  const r = await tx.execute(sql`
    select coalesce(l.transfer_form::text, 'PENJUALAN') form, a.kib, a.acq_price::text v, d.status, a.status asset_status, d.sk_date::text sk_date,
      extract(year from coalesce(d.submitted_at, d.created_at) at time zone 'Asia/Makassar')::int sub_year
    from disposal_lines l join disposals d on d.id = l.disposal_id join assets a on a.id = l.asset_id
    where l.follow_up = 'PEMINDAHTANGANAN' and d.status in ('DIAJUKAN','DIKIRIM','SELESAI','DITOLAK')`);
  const lines = [...r] as unknown as { form: keyof typeof TRANSFER_FORM_LABEL; kib: string; v: string; status: string; asset_status: string; sk_date: string | null; sub_year: number }[];
  return (Object.keys(TRANSFER_FORM_LABEL) as (keyof typeof TRANSFER_FORM_LABEL)[]).map((f) => {
    const items = lines
      .filter((l) => l.form === f)
      .flatMap((l) => {
        const approved = l.status === "SELESAI" && l.asset_status === "DIHAPUS" && !!l.sk_date?.startsWith(String(year));
        return [
          ...(l.sub_year === year ? [{ kib: l.kib, stage: "plan" as const, v: l.v }] : []),
          ...(approved ? [{ kib: l.kib, stage: "ok" as const, v: l.v }, { kib: l.kib, stage: "run" as const, v: l.v }] : []),
        ];
      });
    const rows = byJenis(items);
    return { label: `${TRANSFER_FORM_LABEL[f]} Barang Milik Daerah`, rows, total: totals(rows) };
  });
}

/** Nilai aset pada akhir tahun: nilai kini dikurangi perubahan nilai sesudahnya */
const valueAt = (end: string) => sql`(a.acq_price - coalesce((select sum(v.amount) from asset_value_changes v where v.asset_id = a.id and v.date > ${end}::date), 0))::text`;

/** C.21 — KDP pada akhir tahun: dilanjutkan (berjalan) vs dihentikan, menurut jenis aset yang dibangun */
export async function kdpData(tx: Tx, year: number) {
  const end = `${year}-12-31`;
  const r = await tx.execute(sql`
    select c.status, ac.before->>'bmdCode' as before_code, a.bmd_code, ${valueAt(end)} v
    from constructions c join assets a on a.id = c.asset_id
    left join lateral (select x.before from asset_changes x where x.asset_id = a.id and x.kind = 'REKLASIFIKASI' order by x.id limit 1) ac on true
    where c.kind = 'KDP' and c.start_date <= ${end}::date and (c.status <> 'SELESAI' or c.finished_date > ${end}::date)`);
  const rows = [...r] as unknown as { status: string; before_code: string | null; bmd_code: string; v: string }[];
  const KIB_BY_SUFFIX: Record<string, string> = { "001": "A", "002": "B", "003": "C", "004": "D", "005": "E" };
  const m = new Map<string, { code: string; name: string; go: NV; stop: NV; all: NV }>();
  for (const x of rows) {
    const kdpCode = x.before_code ?? x.bmd_code;
    const j = jenisOf(KIB_BY_SUFFIX[kdpCode.slice(-3)] ?? "C");
    const g = m.get(j.code) ?? { code: j.code, name: j.name, go: zero(), stop: zero(), all: zero() };
    add(x.status === "DIHENTIKAN" ? g.stop : g.go, x.v);
    add(g.all, x.v);
    m.set(j.code, g);
  }
  return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** C.25 — Aset tetap renovasi dan tindak lanjutnya, menurut kode barang */
export async function atrData(tx: Tx, year: number) {
  const end = `${year}-12-31`;
  const r = await tx.execute(sql`
    select a.bmd_code, c.atr_follow_up, ${valueAt(end)} v
    from constructions c join assets a on a.id = c.asset_id
    where c.kind = 'ATR' and c.start_date <= ${end}::date and a.status <> 'DIHAPUS'`);
  const rows = [...r] as unknown as { bmd_code: string; atr_follow_up: string | null; v: string }[];
  const names = await codeNames(rows.map((x) => x.bmd_code));
  const m = new Map<string, { code: string; name: string; all: NV; pt: NV; ps: NV }>();
  for (const x of rows) {
    const g = m.get(x.bmd_code) ?? { code: x.bmd_code, name: names.get(x.bmd_code) ?? "", all: zero(), pt: zero(), ps: zero() };
    add(g.all, x.v);
    if (x.atr_follow_up === "PEMINDAHTANGANAN") add(g.pt, x.v);
    if (x.atr_follow_up === "PENGALIHAN_STATUS") add(g.ps, x.v);
    m.set(x.bmd_code, g);
  }
  return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** C.27 (reklasifikasi) / C.29 (koreksi) — temuan LHI tahun tsb & tindak lanjutnya, menurut jenis */
export async function lhiData(tx: Tx, kind: "REKLASIFIKASI" | "KOREKSI", year: number) {
  const r = await tx.execute(sql`
    select a.kib, a.acq_price::text v, l.follow_up_done_at is not null as done
    from asset_inventory_lines l join asset_inventories i on i.id = l.inventory_id join assets a on a.id = l.asset_id
    where l.follow_up = ${kind} and i.status = 'SELESAI' and extract(year from i.date) = ${year}`);
  const rows = [...r] as unknown as { kib: string; v: string; done: boolean }[];
  const m = new Map<string, { code: string; name: string; lhi: NV; done: NV; todo: NV }>();
  for (const x of rows) {
    const j = jenisOf(x.kib);
    const g = m.get(j.code) ?? { code: j.code, name: j.name, lhi: zero(), done: zero(), todo: zero() };
    add(g.lhi, x.v);
    add(x.done ? g.done : g.todo, x.v);
    m.set(j.code, g);
  }
  return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
}

async function codeNames(codes: string[]) {
  const uniq = [...new Set(codes)];
  if (!uniq.length) return new Map<string, string>();
  const off = await db.select({ code: bmdCodes.code, name: bmdCodes.name }).from(bmdCodes).where(inArray(bmdCodes.code, uniq));
  return new Map(off.map((r) => [r.code, r.name]));
}
