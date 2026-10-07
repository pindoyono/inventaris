import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { schoolSettings } from "@/db/schema";
import { mutasiData } from "@/lib/server/reports";
import { codeTitles, depreciationAt, jenisOf, loadTimelines, movements, objekOf, stateAt, type MoveRow, type NV } from "@/lib/server/bmd-ledger";
import { compressRegNos } from "@/lib/assets-shared";
import { usefulLife } from "@/lib/depreciation-shared";
import type { Period } from "@/lib/period";

const sumNV = (xs: NV[]): NV => xs.reduce((a, x) => ({ n: a.n + x.n, v: a.v + x.v }), { n: 0, v: 0n });
export type LapRow = { code: string; name: string; open: NV; add: NV; sub: NV; close: NV };

const toRow = (r: MoveRow, name: string): LapRow => ({ code: r.code, name, open: r.open, add: r.addT, sub: r.subT, close: r.close });

/** IV.L.2.2 / IV.L.3.2 — mutasi tambah & kurang menurut objek, dipisah intra/ekstrakomptabel dan aset tetap/aset lainnya */
export async function laporanAset(tx: Tx, schoolId: string, p: Period) {
  const moves = movements(await loadTimelines(tx, schoolId), p.from, p.to);
  const codes = [...moves.map((m) => m.code), ...moves.map((m) => jenisOf(m.code))];
  const titles = await codeTitles(codes);
  const pick = (intra: boolean, atb: boolean) => moves.filter((m) => m.intra === intra && m.code.startsWith("1.5.") === atb);
  const section = (intra: boolean, atb: boolean) => {
    const rows = pick(intra, atb).map((m) => toRow(m, titles.get(m.code) ?? ""));
    return { rows, total: { open: sumNV(rows.map((r) => r.open)), add: sumNV(rows.map((r) => r.add)), sub: sumNV(rows.map((r) => r.sub)), close: sumNV(rows.map((r) => r.close)) } };
  };
  /** IV.L.2.1 — penjelasan mutasi per sebab */
  const causes = (intra: boolean) => {
    const add: Record<string, NV> = {};
    const sub: Record<string, NV> = {};
    for (const m of moves.filter((x) => x.intra === intra)) {
      for (const [c, v] of Object.entries(m.add)) add[c] = sumNV([add[c] ?? { n: 0, v: 0n }, v]);
      for (const [c, v] of Object.entries(m.sub)) sub[c] = sumNV([sub[c] ?? { n: 0, v: 0n }, v]);
    }
    return { add, sub };
  };
  /** IV.L.2.3 — rekap menurut jenis */
  const byJenis = (intra: boolean) => {
    const g = new Map<string, LapRow>();
    for (const m of moves.filter((x) => x.intra === intra)) {
      const j = jenisOf(m.code);
      const r = g.get(j) ?? { code: j, name: titles.get(j) ?? "", open: { n: 0, v: 0n }, add: { n: 0, v: 0n }, sub: { n: 0, v: 0n }, close: { n: 0, v: 0n } };
      g.set(j, { ...r, open: sumNV([r.open, m.open]), add: sumNV([r.add, m.addT]), sub: sumNV([r.sub, m.subT]), close: sumNV([r.close, m.close]) });
    }
    return [...g.values()].sort((a, b) => a.code.localeCompare(b.code));
  };
  return {
    asetTetap: { intra: section(true, false), ekstra: section(false, false) },
    asetLainnya: { intra: section(true, true), ekstra: section(false, true) },
    causes: { intra: causes(true), ekstra: causes(false) },
    jenis: { intra: byJenis(true), ekstra: byJenis(false) },
  };
}

/** IV.L.1.1 — persediaan mutasi tambah & kurang menurut objek (nilai) */
export async function laporanPersediaan(tx: Tx, p: Period) {
  const { rows } = await mutasiData(tx, p.from, p.to, null);
  const g = new Map<string, { code: string; open: bigint; add: bigint; sub: bigint; close: bigint; items: number }>();
  for (const r of rows) {
    const o = objekOf(r.nusp);
    const x = g.get(o) ?? { code: o, open: 0n, add: 0n, sub: 0n, close: 0n, items: 0 };
    g.set(o, { code: o, open: x.open + r.openV, add: x.add + r.inV, sub: x.sub + r.outV, close: x.close + r.closeV, items: x.items + 1 });
  }
  const list = [...g.values()].sort((a, b) => a.code.localeCompare(b.code));
  const titles = await codeTitles(list.map((x) => x.code));
  return list.map((x) => ({ ...x, name: titles.get(x.code) ?? "Persediaan" }));
}

/** IV.L.4.2 — Laporan BMD gabungan: persediaan, aset tetap per jenis, aset lainnya (nilai) */
export async function laporanBmd(tx: Tx, schoolId: string, p: Period) {
  const [aset, pers] = await Promise.all([laporanAset(tx, schoolId, p), laporanPersediaan(tx, p)]);
  const v = (x: NV) => x.v;
  const persRow = { code: "1.1.7", name: "Persediaan", intra: { open: 0n, add: 0n, sub: 0n, close: 0n }, ekstra: null as null | Record<string, bigint> };
  for (const r of pers) {
    persRow.intra.open += r.open; persRow.intra.add += r.add; persRow.intra.sub += r.sub; persRow.intra.close += r.close;
  }
  const jenisRow = (code: string, name: string, i?: { open: NV; add: NV; sub: NV; close: NV }, e?: { open: NV; add: NV; sub: NV; close: NV }) => ({
    code, name,
    intra: { open: i ? v(i.open) : 0n, add: i ? v(i.add) : 0n, sub: i ? v(i.sub) : 0n, close: i ? v(i.close) : 0n },
    ekstra: { open: e ? v(e.open) : 0n, add: e ? v(e.add) : 0n, sub: e ? v(e.sub) : 0n, close: e ? v(e.close) : 0n },
  });
  const codes = [...new Set([...aset.jenis.intra, ...aset.jenis.ekstra].map((r) => r.code))].sort();
  const titles = await codeTitles(codes);
  const rows = [
    { ...persRow, ekstra: { open: 0n, add: 0n, sub: 0n, close: 0n } },
    ...codes.map((c) => jenisRow(c, titles.get(c) ?? "", aset.jenis.intra.find((r) => r.code === c), aset.jenis.ekstra.find((r) => r.code === c))),
  ];
  return rows;
}

/** IV.H — akumulasi penyusutan/amortisasi per objek (dan rincian per aset) pada akhir semester/tahun */
export async function laporanPenyusutan(tx: Tx, schoolId: string, p: Period) {
  if (p.semX === null || p.prevSemX === null) throw new Error("Penyusutan dihitung per semester/tahun");
  const [st] = await tx.select({ life: schoolSettings.usefulLife }).from(schoolSettings);
  const life = st?.life ?? {};
  const tl = await loadTimelines(tx, schoolId);
  const meta = new Map(
    ([...(await tx.execute(sql`select id, name, brand, reg_no from assets`))] as unknown as { id: string; name: string; brand: string | null; reg_no: number }[]).map((a) => [a.id, a]),
  );
  const detail: { id: string; code: string; name: string; regNo: number; acqDate: string; life: number; value: bigint; accPrev: bigint; expense: bigint; acc: bigint; book: bigint }[] = [];
  for (const t of tl) {
    const now = depreciationAt(t, p.semX, life);
    if (!now) continue;
    const s = stateAt(t, p.to);
    if (!s.intra) continue;
    const prev = depreciationAt(t, p.prevSemX, life);
    const accPrev = prev && prev.depreciable ? prev.acc : 0n;
    const m = meta.get(t.id)!;
    detail.push({ id: t.id, code: s.code, name: m.name, regNo: m.reg_no, acqDate: s.acqDate, life: usefulLife(s.code, life), value: now.value, accPrev, expense: now.acc - accPrev, acc: now.acc, book: now.value - now.acc });
  }
  detail.sort((a, b) => a.code.localeCompare(b.code) || a.regNo - b.regNo);
  const agg = (key: (c: string) => string) => {
    const g = new Map<string, { code: string; n: number; value: bigint; accPrev: bigint; expense: bigint; acc: bigint; book: bigint }>();
    for (const d of detail) {
      const k = key(d.code);
      const x = g.get(k) ?? { code: k, n: 0, value: 0n, accPrev: 0n, expense: 0n, acc: 0n, book: 0n };
      g.set(k, { code: k, n: x.n + 1, value: x.value + d.value, accPrev: x.accPrev + d.accPrev, expense: x.expense + d.expense, acc: x.acc + d.acc, book: x.book + d.book });
    }
    return [...g.values()].sort((a, b) => a.code.localeCompare(b.code));
  };
  const objek = agg(objekOf);
  const jenis = agg(jenisOf);
  const titles = await codeTitles([...objek.map((o) => o.code), ...jenis.map((j) => j.code)]);
  const named = <T extends { code: string }>(xs: T[]) => xs.map((x) => ({ ...x, name: titles.get(x.code) ?? "", life: x.code.split(".").length === 4 ? usefulLife(x.code, life) : null }));
  return { detail, objek: named(objek), jenis: named(jenis), overrides: life };
}

/** Daftar Barang Kuasa Pengguna pada tanggal tertentu: semua BMD (aset tetap & aset lainnya) per golongan */
export async function daftarBarang(tx: Tx, schoolId: string, asOf: string) {
  const tl = await loadTimelines(tx, schoolId);
  const meta = new Map(
    ([...(await tx.execute(sql`select a.id, a.name, a.brand, a.reg_no, a.condition, r.name as room from assets a left join rooms r on r.id = a.room_id`))] as unknown as {
      id: string; name: string; brand: string | null; reg_no: number; condition: string; room: string | null;
    }[]).map((a) => [a.id, a]),
  );
  const groups = new Map<string, { code: string; name: string; brand: string | null; year: string; intra: boolean; regs: number[]; value: bigint; rooms: Set<string> }>();
  for (const t of tl) {
    const s = stateAt(t, asOf);
    if (!s.exists) continue;
    const m = meta.get(t.id)!;
    const k = [s.code, m.name, m.brand ?? "", s.acqDate.slice(0, 4), s.intra].join("|");
    const g = groups.get(k) ?? { code: s.code, name: m.name, brand: m.brand, year: s.acqDate.slice(0, 4), intra: s.intra, regs: [], value: 0n, rooms: new Set<string>() };
    g.regs.push(m.reg_no);
    g.value += s.value;
    if (m.room) g.rooms.add(m.room);
    groups.set(k, g);
  }
  const rows = [...groups.values()]
    .sort((a, b) => a.code.localeCompare(b.code) || a.year.localeCompare(b.year))
    .map((g) => ({ code: g.code, name: g.name, brand: g.brand, year: g.year, intra: g.intra, qty: g.regs.length, regNos: compressRegNos(g.regs), value: g.value, rooms: [...g.rooms].join(", ") }));
  const titles = await codeTitles([...new Set(rows.map((r) => jenisOf(r.code)))]);
  const byJenis = [...new Set(rows.map((r) => jenisOf(r.code)))].sort().map((j) => {
    const rs = rows.filter((r) => jenisOf(r.code) === j);
    return { code: j, name: titles.get(j) ?? "", rows: rs, qty: rs.reduce((a, r) => a + r.qty, 0), intra: rs.filter((r) => r.intra).reduce((a, r) => a + r.value, 0n), ekstra: rs.filter((r) => !r.intra).reduce((a, r) => a + r.value, 0n) };
  });
  return byJenis;
}
