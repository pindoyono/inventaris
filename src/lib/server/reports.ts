import "server-only";
import { and, asc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { assets, bmdCodes, buildings, localBmdCodes, rooms, stockDocs, stockMovements, supplyItems, uoms, warehouses } from "@/db/schema";
import { compressRegNos, KIB_ATTRS } from "@/lib/assets-shared";
import { parseDec } from "@/lib/decimal";

type Cond = "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT";

async function codeNames(tx: Tx, codes: string[]) {
  const uniq = [...new Set(codes)];
  if (!uniq.length) return new Map<string, string>();
  const off = await db.select({ code: bmdCodes.code, name: bmdCodes.name }).from(bmdCodes).where(inArray(bmdCodes.code, uniq));
  const loc = await tx.select({ code: localBmdCodes.code, name: localBmdCodes.name }).from(localBmdCodes).where(inArray(localBmdCodes.code, uniq));
  return new Map([...off, ...loc].map((r) => [r.code, r.name]));
}

/**
 * Posisi aset pada tanggal `asOf` direkonstruksi dari riwayat: ruangan & kondisi = kejadian terakhir
 * yang bertanggal ≤ asOf. Hanya aset yang sudah diperoleh ≤ asOf dan belum dihapus.
 */
type AsOfRow = {
  id: string; bmd_code: string; reg_no: number; name: string; brand: string | null; kib: string; acq_date: string; acq_price: string;
  is_intra: boolean; acquisition: string; attrs: Record<string, string>; note: string | null; room_id: string | null; condition: Cond;
};

async function assetsAsOf(tx: Tx, asOf: string): Promise<AsOfRow[]> {
  const rows = await tx.execute(sql`
    select a.id, a.bmd_code, a.reg_no, a.name, a.brand, a.kib, a.acq_date::text,
      (a.acq_price - coalesce((select sum(v.amount) from asset_value_changes v where v.asset_id = a.id and v.date > ${asOf}::date), 0))::text as acq_price, a.is_intra, a.acquisition, a.attrs, a.note,
      (select e.to_room_id from asset_events e where e.asset_id = a.id and e.kind in ('DICATAT','PINDAH') and e.date <= ${asOf}::date order by e.date desc, e.id desc limit 1) as room_id,
      coalesce((select e.to_condition from asset_events e where e.asset_id = a.id and e.to_condition is not null and e.date <= ${asOf}::date order by e.date desc, e.id desc limit 1), a.condition) as condition
    from assets a
    where a.acq_date <= ${asOf}::date and a.status <> 'DIHAPUS'
  `);
  return [...rows] as unknown as AsOfRow[];
}

export type KirRow = {
  bmdCode: string; codeName: string; regNos: string; name: string; brand: string | null; year: string; qty: number; total: bigint;
  baik: number; rr: number; rb: number; ekstra: number;
};

/** KIR satu ruangan pada tanggal tertentu, baris digabung per kode+nama+merk+tahun+harga satuan */
export async function kirData(tx: Tx, roomId: string, asOf: string) {
  const [room] = await tx
    .select({ id: rooms.id, name: rooms.name, floor: rooms.floor, picName: rooms.picName, picNip: rooms.picNip, building: buildings.name })
    .from(rooms)
    .leftJoin(buildings, eq(buildings.id, rooms.buildingId))
    .where(eq(rooms.id, roomId));
  if (!room) return null;
  const all = (await assetsAsOf(tx, asOf)).filter((a) => a.room_id === roomId);
  const names = await codeNames(tx, all.map((a) => a.bmd_code));
  const groups = new Map<string, typeof all>();
  for (const a of all) {
    const k = [a.bmd_code, a.name, a.brand ?? "", a.acq_date.slice(0, 4), a.acq_price].join("|");
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const rows: KirRow[] = [...groups.values()]
    .map((g) => ({
      bmdCode: g[0].bmd_code,
      codeName: names.get(g[0].bmd_code) ?? "",
      regNos: compressRegNos(g.map((a) => a.reg_no)),
      name: g[0].name,
      brand: g[0].brand,
      year: g[0].acq_date.slice(0, 4),
      qty: g.length,
      total: g.reduce((s, a) => s + parseDec(a.acq_price), 0n),
      baik: g.filter((a) => a.condition === "BAIK").length,
      rr: g.filter((a) => a.condition === "RUSAK_RINGAN").length,
      rb: g.filter((a) => a.condition === "RUSAK_BERAT").length,
      ekstra: g.filter((a) => !a.is_intra).length,
    }))
    .sort((a, b) => a.bmdCode.localeCompare(b.bmdCode) || a.name.localeCompare(b.name) || a.year.localeCompare(b.year));
  return { room, rows, total: rows.reduce((s, r) => s + r.total, 0n), units: all.length };
}

export type KibRow = {
  bmdCode: string; codeName: string; name: string; regNos: string; brand: string | null; attrs: Record<string, string>;
  year: string; acquisition: string; qty: number; total: bigint; note: string | null; ekstra: boolean;
};

/** KIB per golongan (posisi saat ini). Unit dengan atribut berbeda (mis. nomor seri) tidak digabung. */
export async function kibData(tx: Tx, kib: string, includeEkstra: boolean) {
  const list = await tx
    .select()
    .from(assets)
    .where(and(eq(assets.kib, kib), ne(assets.status, "DIHAPUS"), includeEkstra ? undefined : eq(assets.isIntra, true)))
    .orderBy(asc(assets.bmdCode), asc(assets.regNo));
  const names = await codeNames(tx, list.map((a) => a.bmdCode));
  const keys = (KIB_ATTRS[kib] ?? []).map((x) => x.key);
  const groups = new Map<string, typeof list>();
  for (const a of list) {
    const k = [a.bmdCode, a.name, a.brand ?? "", a.acqDate.slice(0, 4), a.acquisition, a.acqPrice, a.isIntra, ...keys.map((x) => a.attrs[x] ?? "")].join("|");
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const rows: KibRow[] = [...groups.values()].map((g) => ({
    bmdCode: g[0].bmdCode,
    codeName: names.get(g[0].bmdCode) ?? "",
    name: g[0].name,
    regNos: compressRegNos(g.map((a) => a.regNo)),
    brand: g[0].brand,
    attrs: g[0].attrs,
    year: g[0].acqDate.slice(0, 4),
    acquisition: g[0].acquisition,
    qty: g.length,
    total: g.reduce((s, a) => s + parseDec(a.acqPrice), 0n),
    note: g.length === 1 ? g[0].note : null,
    ekstra: !g[0].isIntra,
  }));
  return { rows, total: rows.reduce((s, r) => s + r.total, 0n), units: list.length };
}

export type MutasiRow = {
  itemId: string; nusp: string; name: string; uom: string;
  openQ: bigint; openV: bigint; inQ: bigint; inV: bigint; outQ: bigint; outV: bigint; closeQ: bigint; closeV: bigint;
};

/**
 * Laporan mutasi persediaan per NUSP untuk periode [from, to].
 * - Pembatalan (PEMBALIK) mengurangi masuk/keluar asalnya, bukan dihitung ganda.
 * - Semua gudang: mutasi antar gudang (dan pembatalannya) diabaikan karena internal.
 */
export async function mutasiData(tx: Tx, from: string, to: string, warehouseId: string | null) {
  const moves = await tx
    .select({
      itemId: stockMovements.itemId, date: stockMovements.date, kind: stockMovements.kind, docKind: stockDocs.kind,
      qtyIn: stockMovements.qtyIn, qtyOut: stockMovements.qtyOut, value: stockMovements.value,
    })
    .from(stockMovements)
    .innerJoin(stockDocs, eq(stockDocs.id, stockMovements.docId))
    .where(and(lte(stockMovements.date, to), warehouseId ? eq(stockMovements.warehouseId, warehouseId) : undefined));
  const items = await tx
    .select({ id: supplyItems.id, nusp: supplyItems.nusp, name: supplyItems.name, uom: uoms.name })
    .from(supplyItems)
    .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
    .orderBy(asc(supplyItems.nusp));
  const map = new Map<string, MutasiRow>(items.map((i) => [i.id, { itemId: i.id, nusp: i.nusp, name: i.name, uom: i.uom, openQ: 0n, openV: 0n, inQ: 0n, inV: 0n, outQ: 0n, outV: 0n, closeQ: 0n, closeV: 0n }]));
  for (const m of moves) {
    const r = map.get(m.itemId);
    if (!r) continue;
    const internal = !warehouseId && m.docKind === "MUTASI";
    const qi = parseDec(m.qtyIn), qo = parseDec(m.qtyOut), v = parseDec(m.value);
    const signedQ = qi - qo, signedV = qi > 0n ? v : -v;
    if (m.date < from) {
      if (!internal) { r.openQ += signedQ; r.openV += signedV; }
      continue;
    }
    if (internal) continue;
    if (m.kind === "PEMBALIK") {
      // pembalik masuk (qtyOut) mengurangi "masuk"; pembalik keluar (qtyIn) mengurangi "keluar"
      if (qo > 0n) { r.inQ -= qo; r.inV -= v; } else { r.outQ -= qi; r.outV -= v; }
    } else if (qi > 0n) { r.inQ += qi; r.inV += v; } else { r.outQ += qo; r.outV += v; }
  }
  const rows = [...map.values()]
    .map((r) => ({ ...r, closeQ: r.openQ + r.inQ - r.outQ, closeV: r.openV + r.inV - r.outV }))
    .filter((r) => r.openQ || r.inQ || r.outQ || r.closeQ || r.openV || r.closeV);
  const sum = (k: keyof MutasiRow) => rows.reduce((s, r) => s + (r[k] as bigint), 0n);
  return { rows, totals: { openV: sum("openV"), inV: sum("inV"), outV: sum("outV"), closeV: sum("closeV") } };
}

export async function warehouseOptions(tx: Tx) {
  return tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).orderBy(asc(warehouses.name));
}

// ───────── Permendagri 7/2024: laporan pemantauan (C.3, C.23) & daftar dokumen kepemilikan (B)

/** Baris "menurut jenis" (sub-sub golongan) seperti petunjuk pengisian Format C */
export const JENIS_BMD = [
  { kib: "A", code: "1.3.1", name: "Tanah" },
  { kib: "B", code: "1.3.2", name: "Peralatan dan Mesin" },
  { kib: "C", code: "1.3.3", name: "Gedung dan Bangunan" },
  { kib: "D", code: "1.3.4", name: "Jalan, Irigasi dan Jaringan" },
  { kib: "E", code: "1.3.5", name: "Aset Tetap Lainnya" },
  { kib: "ATB", code: "1.5.3", name: "Aset Tak Berwujud" },
] as const;

/** C.23 — BMD rusak berat/usang & tindak lanjutnya dalam satu tahun */
export async function rusakBeratData(tx: Tx, year: number) {
  const end = `${year}-12-31`;
  const rb = await tx
    .select({ kib: assets.kib, n: sql<number>`count(*)::int`, v: sql<string>`coalesce(sum(${assets.acqPrice}),0)` })
    .from(assets)
    .where(and(eq(assets.condition, "RUSAK_BERAT"), ne(assets.status, "DIHAPUS"), lte(assets.acqDate, end)))
    .groupBy(assets.kib);
  const prop = await tx.execute(sql`
    select a.kib, l.follow_up, count(*)::int n, coalesce(sum(a.acq_price),0)::text v
    from disposal_lines l join disposals d on d.id = l.disposal_id join assets a on a.id = l.asset_id
    where d.status in ('DIAJUKAN','DIKIRIM','SELESAI') and l.reason in ('RUSAK_BERAT','USANG')
      and extract(year from coalesce(d.submitted_at, d.created_at) at time zone 'Asia/Makassar') = ${year}
    group by a.kib, l.follow_up`);
  const pRows = [...prop] as unknown as { kib: string; follow_up: string; n: number; v: string }[];
  const [ps] = await tx
    .select({ q: sql<string>`coalesce(sum(${stockMovements.qtyOut}),0)`, v: sql<string>`coalesce(sum(${stockMovements.value}),0)` })
    .from(stockMovements)
    .innerJoin(stockDocs, eq(stockDocs.id, stockMovements.docId))
    .where(and(eq(stockMovements.kind, "RUSAK_USANG"), eq(stockDocs.status, "DIPOSTING"), sql`extract(year from ${stockMovements.date}) = ${year}`));
  const rows: { code: string; name: string; n: number; v: bigint; ptN: number; ptV: bigint; pmN: number; pmV: bigint }[] = JENIS_BMD.filter((j) => j.kib !== "ATB").map((j) => {
    const r = rb.find((x) => x.kib === j.kib);
    const pt = pRows.find((x) => x.kib === j.kib && x.follow_up === "PEMINDAHTANGANAN");
    const pm = pRows.find((x) => x.kib === j.kib && x.follow_up === "PEMUSNAHAN");
    return { code: j.code, name: `${j.name} rusak berat/usang`, n: r?.n ?? 0, v: parseDec(r?.v ?? "0"), ptN: pt?.n ?? 0, ptV: parseDec(pt?.v ?? "0"), pmN: pm?.n ?? 0, pmV: parseDec(pm?.v ?? "0") };
  });
  rows.push({ code: "1.1.7", name: "Persediaan rusak berat/usang", n: Number(ps.q), v: parseDec(ps.v), ptN: 0, ptV: 0n, pmN: 0, pmV: 0n });
  return rows;
}

/** C.3 — BMD tidak digunakan untuk tugas & fungsi */
export async function tidakDigunakanData(tx: Tx) {
  const r = await tx
    .select({ kib: assets.kib, plan: assets.idlePlan, n: sql<number>`count(*)::int`, v: sql<string>`coalesce(sum(${assets.acqPrice}),0)` })
    .from(assets)
    .where(and(eq(assets.idle, true), ne(assets.status, "DIHAPUS")))
    .groupBy(assets.kib, assets.idlePlan);
  return JENIS_BMD.map((j) => {
    const g = r.filter((x) => x.kib === j.kib);
    const by = (p: string) => g.filter((x) => x.plan === p).reduce((a, x) => a + x.n, 0);
    return { code: j.code, name: j.name, n: g.reduce((a, x) => a + x.n, 0), v: g.reduce((a, x) => a + parseDec(x.v), 0n), penggunaan: by("PENGGUNAAN"), pemanfaatan: by("PEMANFAATAN"), pemindahtanganan: by("PEMINDAHTANGANAN") };
  });
}

/** B.1 (sertifikat tanah) / B.2 (selain sertifikat tanah: BPKB, dokumen gedung, dsb.) */
export async function dokumenKepemilikanData(tx: Tx, jenis: "tanah" | "lain") {
  const list = await tx.select().from(assets).where(and(ne(assets.status, "DIHAPUS"), jenis === "tanah" ? eq(assets.kib, "A") : sql`${assets.kib} <> 'A'`)).orderBy(asc(assets.bmdCode), asc(assets.regNo));
  const names = await codeNames(tx, list.map((a) => a.bmdCode));
  return list
    .map((a) => {
      const at = a.attrs;
      const doc =
        a.kib === "A" ? (at.sertifikatNo ? { jenis: at.hak ? `Sertifikat ${at.hak}` : "Sertifikat", nomor: at.sertifikatNo, tanggal: at.sertifikatTgl ?? "" } : null)
        : a.kib === "B" ? (at.noBpkb ? { jenis: "BPKB", nomor: at.noBpkb, tanggal: "" } : null)
        : a.kib === "C" ? (at.dokumenNo ? { jenis: "Dokumen gedung (IMB/PBG)", nomor: at.dokumenNo, tanggal: at.dokumenTgl ?? "" } : null)
        : null;
      if (!doc) return null;
      return {
        code: a.bmdCode, codeName: names.get(a.bmdCode) ?? "", spec: [a.name, a.brand, at.noPolisi ? `Nopol ${at.noPolisi}` : ""].filter(Boolean).join(" · "),
        luas: at.luas ?? at.luasLantai ?? "", satuan: at.luas || at.luasLantai ? "m²" : "", lokasi: at.alamat ?? at.letak ?? "", doc, reg: a.regNo,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
