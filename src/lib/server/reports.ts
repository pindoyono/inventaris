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
    select a.id, a.bmd_code, a.reg_no, a.name, a.brand, a.kib, a.acq_date::text, a.acq_price::text, a.is_intra, a.acquisition, a.attrs, a.note,
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
