import "server-only";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import {
  docCounters,
  schoolSettings,
  stockBalances,
  stockDocLines,
  stockDocs,
  stockLots,
  stockMovements,
  supplyItems,
  units,
  vendors,
  warehouses,
} from "@/db/schema";
import { mulDec, parseDec, toDec } from "@/lib/decimal";
import { UserError } from "@/lib/server/errors";

/**
 * Mesin buku besar persediaan (Permendagri 47/2021: perpetual, FIFO).
 * Semua fungsi dipanggil di dalam withSchool (satu transaksi, RLS aktif).
 *
 * Posting: kunci dokumen → nomor dokumen → kunci saldo (urut barang, gudang) → masuk membuat lot /
 * keluar mengambil lot tertua (FOR UPDATE) → tulis buku besar + saldo sesudahnya → simpan saldo.
 * Dua posting bersamaan atas barang × gudang yang sama saling menunggu di kunci saldo.
 */

export class StockError extends UserError {}

type DocKind = (typeof stockDocs.$inferSelect)["kind"];
type MoveKind = (typeof stockMovements.$inferInsert)["kind"];

export const DOC_PREFIX: Record<DocKind, string> = {
  SALDO_AWAL: "SA",
  PENERIMAAN: "KP",
  PENYALURAN: "BAST",
  MUTASI: "MUT",
  PENYESUAIAN_TAMBAH: "PYS",
  PENYESUAIAN_KURANG: "PYS",
  RUSAK_USANG: "RU",
};

export const DOC_LABEL: Record<DocKind, string> = {
  SALDO_AWAL: "Saldo awal",
  PENERIMAAN: "Penerimaan",
  PENYALURAN: "Penyaluran",
  MUTASI: "Mutasi antar gudang",
  PENYESUAIAN_TAMBAH: "Penyesuaian (tambah)",
  PENYESUAIAN_KURANG: "Penyesuaian (kurang)",
  RUSAK_USANG: "Persediaan rusak/usang",
};

const INBOUND: DocKind[] = ["SALDO_AWAL", "PENERIMAAN", "PENYESUAIAN_TAMBAH"];
export const isInbound = (k: DocKind) => INBOUND.includes(k);

/** Tanggal hari ini di WITA (YYYY-MM-DD) */
export const todayWita = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());

export async function nextDocNumber(tx: Tx, schoolId: string, prefix: string, year: number) {
  const [r] = await tx
    .insert(docCounters)
    .values({ schoolId, kind: prefix, year, last: 1 })
    .onConflictDoUpdate({ target: [docCounters.schoolId, docCounters.kind, docCounters.year], set: { last: sql`${docCounters.last} + 1` } })
    .returning({ last: docCounters.last });
  return `${prefix}/${year}/${String(r.last).padStart(4, "0")}`;
}

type Bal = { itemId: string; warehouseId: string; qty: bigint; value: bigint; lastDate: string | null; dirty: boolean };
const key = (itemId: string, warehouseId: string) => `${itemId}|${warehouseId}`;

/** Kunci saldo barang × gudang dalam urutan tetap (mencegah deadlock) dan kembalikan peta saldo */
async function lockBalances(tx: Tx, schoolId: string, pairs: [string, string][]) {
  const uniq = [...new Map(pairs.map((p) => [key(...p), p])).values()].sort((a, b) => key(...a).localeCompare(key(...b)));
  const map = new Map<string, Bal>();
  for (const [itemId, warehouseId] of uniq) {
    await tx.insert(stockBalances).values({ schoolId, itemId, warehouseId }).onConflictDoNothing();
    const [b] = await tx
      .select()
      .from(stockBalances)
      .where(and(eq(stockBalances.itemId, itemId), eq(stockBalances.warehouseId, warehouseId)))
      .for("update");
    map.set(key(itemId, warehouseId), { itemId, warehouseId, qty: parseDec(b.qty), value: parseDec(b.value), lastDate: b.lastDate, dirty: false });
  }
  return map;
}

async function saveBalances(tx: Tx, map: Map<string, Bal>) {
  for (const b of map.values()) {
    if (!b.dirty) continue;
    await tx
      .update(stockBalances)
      .set({ qty: toDec(b.qty), value: toDec(b.value), lastDate: b.lastDate, updatedAt: new Date() })
      .where(and(eq(stockBalances.itemId, b.itemId), eq(stockBalances.warehouseId, b.warehouseId)));
  }
}

async function checkPeriod(tx: Tx, date: string) {
  const [st] = await tx.select({ closed: schoolSettings.booksClosedUntil }).from(schoolSettings);
  if (st?.closed && date <= st.closed) throw new StockError(`Periode sampai ${st.closed} sudah ditutup`);
}

type MoveBase = { schoolId: string; date: string; docId: string; docNumber: string; createdBy: string; description: string };

/** Catat masuk ke lot (baru atau dikembalikan) dan perbarui saldo di memori */
function moveIn(b: Bal, base: MoveBase, kind: MoveKind, lotId: string, q: bigint, price: bigint) {
  const value = mulDec(q, price);
  b.qty += q;
  b.value += value;
  b.lastDate = !b.lastDate || base.date > b.lastDate ? base.date : b.lastDate;
  b.dirty = true;
  return {
    ...base, itemId: b.itemId, warehouseId: b.warehouseId, kind, lotId,
    qtyIn: toDec(q), qtyOut: "0", unitPrice: toDec(price), value: toDec(value),
    balanceQty: toDec(b.qty), balanceValue: toDec(b.value),
  } satisfies typeof stockMovements.$inferInsert;
}

function moveOut(b: Bal, base: MoveBase, kind: MoveKind, lotId: string, q: bigint, price: bigint) {
  let value = mulDec(q, price);
  // Sisa pembulatan diserap saat stok habis, dan nilai tidak pernah melebihi saldo
  if (b.qty - q === 0n || value > b.value) value = b.value;
  b.qty -= q;
  b.value -= value;
  b.lastDate = !b.lastDate || base.date > b.lastDate ? base.date : b.lastDate;
  b.dirty = true;
  return {
    ...base, itemId: b.itemId, warehouseId: b.warehouseId, kind, lotId,
    qtyIn: "0", qtyOut: toDec(q), unitPrice: toDec(price), value: toDec(value),
    balanceQty: toDec(b.qty), balanceValue: toDec(b.value),
  } satisfies typeof stockMovements.$inferInsert;
}

/** Ambil lot tertua (FIFO). Mengembalikan potongan [lot, qty]; gagal bila stok kurang. */
async function takeFifo(tx: Tx, itemId: string, warehouseId: string, need: bigint, itemLabel: string, available: bigint) {
  if (need > available) throw new StockError(`Stok ${itemLabel} tidak cukup: tersedia ${toDec(available)}, diminta ${toDec(need)}`);
  const lots = await tx
    .select()
    .from(stockLots)
    .where(and(eq(stockLots.itemId, itemId), eq(stockLots.warehouseId, warehouseId), gt(stockLots.qtyLeft, "0")))
    .orderBy(asc(stockLots.receivedDate), asc(stockLots.createdAt), asc(stockLots.id))
    .for("update");
  const pieces: { lot: typeof stockLots.$inferSelect; q: bigint }[] = [];
  let rest = need;
  for (const lot of lots) {
    if (rest === 0n) break;
    const q = parseDec(lot.qtyLeft) < rest ? parseDec(lot.qtyLeft) : rest;
    pieces.push({ lot, q });
    rest -= q;
  }
  if (rest > 0n) throw new StockError(`Lot FIFO ${itemLabel} tidak konsisten dengan saldo`);
  for (const { lot, q } of pieces)
    await tx.update(stockLots).set({ qtyLeft: toDec(parseDec(lot.qtyLeft) - q) }).where(eq(stockLots.id, lot.id));
  return pieces;
}

async function describe(tx: Tx, doc: typeof stockDocs.$inferSelect) {
  if (doc.kind === "PENERIMAAN" && doc.vendorId) {
    const [v] = await tx.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, doc.vendorId));
    return `Penerimaan dari ${v?.name ?? "penyedia"}`;
  }
  if (doc.kind === "PENYALURAN" && doc.unitId) {
    const [u] = await tx.select({ name: units.name }).from(units).where(eq(units.id, doc.unitId));
    return `Penyaluran ke ${u?.name ?? "unit"}`;
  }
  if (doc.kind === "MUTASI" && doc.toWarehouseId) {
    const [w] = await tx.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.id, doc.toWarehouseId));
    return `Mutasi ke ${w?.name ?? "gudang lain"}`;
  }
  return DOC_LABEL[doc.kind];
}

/** Posting dokumen DRAF ke buku besar. Mengembalikan nomor dokumen. */
export async function postDoc(tx: Tx, schoolId: string, userId: string, docId: string) {
  const [doc] = await tx.select().from(stockDocs).where(eq(stockDocs.id, docId)).for("update");
  if (!doc) throw new StockError("Dokumen tidak ditemukan");
  if (doc.status !== "DRAF") throw new StockError("Hanya dokumen draf yang bisa diposting");
  if (doc.date > todayWita()) throw new StockError("Tanggal dokumen tidak boleh di masa depan");
  if (doc.kind === "MUTASI" && (!doc.toWarehouseId || doc.toWarehouseId === doc.warehouseId))
    throw new StockError("Gudang tujuan mutasi harus berbeda dengan gudang asal");
  await checkPeriod(tx, doc.date);

  const lines = await tx
    .select({ line: stockDocLines, item: supplyItems })
    .from(stockDocLines)
    .innerJoin(supplyItems, eq(supplyItems.id, stockDocLines.itemId))
    .where(eq(stockDocLines.docId, docId))
    .orderBy(asc(stockDocLines.lineNo));
  if (!lines.length) throw new StockError("Dokumen belum berisi barang");

  const pairs: [string, string][] = lines.flatMap(({ line }) =>
    doc.kind === "MUTASI" ? [[line.itemId, doc.warehouseId], [line.itemId, doc.toWarehouseId!]] : [[line.itemId, doc.warehouseId]],
  );
  const bal = await lockBalances(tx, schoolId, pairs);
  for (const b of bal.values())
    if (b.lastDate && doc.date < b.lastDate)
      throw new StockError(`Tanggal dokumen lebih awal dari transaksi terakhir barang ini di gudang tersebut (${b.lastDate})`);

  const number = await nextDocNumber(tx, schoolId, DOC_PREFIX[doc.kind], Number(doc.date.slice(0, 4)));
  const base: MoveBase = { schoolId, date: doc.date, docId, docNumber: number, createdBy: userId, description: await describe(tx, doc) };
  const moves: (typeof stockMovements.$inferInsert)[] = [];

  for (const { line, item } of lines) {
    const label = `${item.nusp} ${item.name}`;
    const q = parseDec(line.qty);
    const src = bal.get(key(item.id, doc.warehouseId))!;

    if (isInbound(doc.kind)) {
      if (line.unitPrice === null) throw new StockError(`Harga satuan ${label} wajib diisi`);
      const price = parseDec(line.unitPrice);
      const [lot] = await tx
        .insert(stockLots)
        .values({ schoolId, itemId: item.id, warehouseId: doc.warehouseId, receivedDate: doc.date, qtyIn: toDec(q), qtyLeft: toDec(q), unitPrice: toDec(price), docId })
        .returning({ id: stockLots.id });
      moves.push(moveIn(src, base, doc.kind as MoveKind, lot.id, q, price));
    } else {
      const pieces = await takeFifo(tx, item.id, doc.warehouseId, q, label, src.qty);
      for (const { lot, q: pq } of pieces) {
        const price = parseDec(lot.unitPrice);
        if (doc.kind === "MUTASI") {
          moves.push(moveOut(src, base, "MUTASI_KELUAR", lot.id, pq, price));
          const dst = bal.get(key(item.id, doc.toWarehouseId!))!;
          // Lot pindah gudang dengan tanggal & harga aslinya (urutan FIFO tetap)
          const [nl] = await tx
            .insert(stockLots)
            .values({ schoolId, itemId: item.id, warehouseId: dst.warehouseId, receivedDate: lot.receivedDate, qtyIn: toDec(pq), qtyLeft: toDec(pq), unitPrice: lot.unitPrice, docId, originLotId: lot.id })
            .returning({ id: stockLots.id });
          moves.push(moveIn(dst, { ...base, description: "Mutasi masuk" }, "MUTASI_MASUK", nl.id, pq, price));
        } else {
          moves.push(moveOut(src, base, doc.kind as MoveKind, lot.id, pq, price));
        }
      }
    }
  }

  if (moves.length) await tx.insert(stockMovements).values(moves);
  await saveBalances(tx, bal);
  await tx
    .update(stockDocs)
    .set({ status: "DIPOSTING", number, postedBy: userId, postedAt: new Date(), updatedAt: new Date() })
    .where(eq(stockDocs.id, docId));
  return number;
}

/**
 * Batalkan dokumen yang sudah diposting dengan baris PEMBALIK (buku besar tidak diubah).
 * Dokumen masuk hanya bisa dibatalkan bila lotnya belum terpakai.
 */
export async function cancelDoc(tx: Tx, schoolId: string, userId: string, docId: string, reason: string) {
  const [doc] = await tx.select().from(stockDocs).where(eq(stockDocs.id, docId)).for("update");
  if (!doc) throw new StockError("Dokumen tidak ditemukan");
  if (doc.status !== "DIPOSTING") throw new StockError("Hanya dokumen yang sudah diposting yang bisa dibatalkan");
  const date = todayWita();
  await checkPeriod(tx, date);

  const orig = await tx.select().from(stockMovements).where(eq(stockMovements.docId, docId)).orderBy(asc(stockMovements.id));
  const bal = await lockBalances(tx, schoolId, orig.map((m) => [m.itemId, m.warehouseId]));
  const base: MoveBase = { schoolId, date, docId, docNumber: doc.number!, createdBy: userId, description: `Pembatalan ${doc.number}: ${reason}` };
  const moves: (typeof stockMovements.$inferInsert)[] = [];

  // Balik dari baris terakhir agar saldo tidak sempat negatif
  for (const m of [...orig].reverse()) {
    const b = bal.get(key(m.itemId, m.warehouseId))!;
    const [lot] = await tx.select().from(stockLots).where(eq(stockLots.id, m.lotId)).for("update");
    const price = parseDec(m.unitPrice);
    if (parseDec(m.qtyIn) > 0n) {
      const q = parseDec(m.qtyIn);
      if (parseDec(lot.qtyLeft) < q) throw new StockError(`Barang dari dokumen ini sudah dikeluarkan sebagian; batalkan dulu dokumen pengeluarannya`);
      await tx.update(stockLots).set({ qtyLeft: toDec(parseDec(lot.qtyLeft) - q) }).where(eq(stockLots.id, lot.id));
      moves.push(moveOut(b, base, "PEMBALIK", lot.id, q, price));
    } else {
      const q = parseDec(m.qtyOut);
      await tx.update(stockLots).set({ qtyLeft: toDec(parseDec(lot.qtyLeft) + q) }).where(eq(stockLots.id, lot.id));
      moves.push(moveIn(b, base, "PEMBALIK", lot.id, q, price));
    }
  }
  if (moves.length) await tx.insert(stockMovements).values(moves);
  await saveBalances(tx, bal);
  await tx
    .update(stockDocs)
    .set({ status: "DIBATALKAN", cancelledBy: userId, cancelledAt: new Date(), cancelReason: reason, updatedAt: new Date() })
    .where(eq(stockDocs.id, docId));
}
