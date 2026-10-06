import "server-only";
import { and, eq, max, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { bmdCodes, localBmdCodes, stockDocLines, stockDocs, supplyItems } from "@/db/schema";
import { StockError, todayWita } from "@/lib/server/ledger";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";

/** Kode barang persediaan yang sah: tingkat 7 golongan PERSEDIAAN, atau kode lokal di bawah 1.1.7 */
export async function resolvePersediaanCode(tx: Tx, code: string) {
  const [off] = await tx.select().from(bmdCodes).where(eq(bmdCodes.code, code));
  if (off) {
    if (off.class !== "PERSEDIAAN" || !off.selectable || off.level !== 7) throw new StockError("Pilih kode barang persediaan tingkat 7 (1.1.7.xx.xx.xx.xxx)");
    return { code, name: off.name };
  }
  const [loc] = await tx.select().from(localBmdCodes).where(eq(localBmdCodes.code, code));
  if (loc && code.startsWith("1.1.7.")) return { code, name: loc.name };
  throw new StockError("Kode barang tidak ditemukan");
}

export type ItemInput = { bmdCode: string; name: string; spec: string | null; uomId: string; minStock: string };

/** Buat barang persediaan dengan nomor urut spesifikasi berikutnya → NUSP */
export async function createSupplyItem(tx: Tx, schoolId: string, input: ItemInput) {
  await resolvePersediaanCode(tx, input.bmdCode);
  const [dup] = await tx
    .select({ nusp: supplyItems.nusp })
    .from(supplyItems)
    .where(sql`lower(${supplyItems.name}) = lower(${input.name.trim()})`);
  if (dup) throw new StockError(`Barang bernama “${input.name}” sudah ada (NUSP ${dup.nusp}). Bedakan namanya bila spesifikasinya berbeda.`);
  const [r] = await tx.select({ m: max(supplyItems.seq) }).from(supplyItems).where(eq(supplyItems.bmdCode, input.bmdCode));
  const seq = (r?.m ?? 0) + 1;
  if (seq > 9999) throw new StockError("Nomor urut spesifikasi untuk kode ini sudah penuh");
  const [item] = await tx
    .insert(supplyItems)
    .values({ schoolId, ...input, seq, nusp: `${input.bmdCode}.${String(seq).padStart(4, "0")}` })
    .returning();
  return item;
}

export type DocLineInput = { itemId: string; qty: string; unitPrice?: string | null; note?: string | null };
export type DocInput = {
  kind: (typeof stockDocs.$inferInsert)["kind"];
  date: string;
  warehouseId: string;
  toWarehouseId?: string | null;
  unitId?: string | null;
  vendorId?: string | null;
  fundingSourceId?: string | null;
  fundingComponentId?: string | null;
  acquisition?: string | null;
  refNumber?: string | null;
  refDate?: string | null;
  note?: string | null;
  requestId?: string | null;
  opnameId?: string | null;
  procurementId?: string | null;
  lines: DocLineInput[];
};

/** Simpan dokumen DRAF (baru atau mengganti draf yang ada) */
export async function saveDraftDoc(tx: Tx, schoolId: string, userId: string, input: DocInput, docId?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new StockError("Tanggal tidak valid");
  if (input.date > todayWita()) throw new StockError("Tanggal tidak boleh di masa depan");
  if (!input.lines.length) throw new StockError("Isi minimal satu barang");
  const seen = new Set<string>();
  const lines = input.lines.map((l, i) => {
    if (seen.has(l.itemId)) throw new StockError(`Barang pada baris ${i + 1} tercantum dua kali`);
    seen.add(l.itemId);
    let q: bigint, p: bigint | null;
    try {
      q = parseDec(normalizeIdNumber(l.qty));
      p = l.unitPrice == null || l.unitPrice === "" ? null : parseDec(normalizeIdNumber(l.unitPrice));
    } catch {
      throw new StockError(`Angka pada baris ${i + 1} tidak valid (maks. 2 desimal)`);
    }
    if (q <= 0n) throw new StockError(`Jumlah pada baris ${i + 1} harus lebih dari 0`);
    if (p !== null && p < 0n) throw new StockError(`Harga pada baris ${i + 1} tidak boleh negatif`);
    return { schoolId, lineNo: i + 1, itemId: l.itemId, qty: toDec(q), unitPrice: p === null ? null : toDec(p), note: l.note ?? null };
  });

  const { lines: _l, ...head } = input;
  let id = docId;
  if (id) {
    const [d] = await tx.select({ status: stockDocs.status }).from(stockDocs).where(eq(stockDocs.id, id)).for("update");
    if (!d) throw new StockError("Dokumen tidak ditemukan");
    if (d.status !== "DRAF") throw new StockError("Dokumen yang sudah diposting tidak bisa diubah");
    await tx.update(stockDocs).set({ ...head, updatedAt: new Date() }).where(eq(stockDocs.id, id));
    await tx.delete(stockDocLines).where(eq(stockDocLines.docId, id));
  } else {
    [{ id }] = await tx.insert(stockDocs).values({ schoolId, ...head, createdBy: userId }).returning({ id: stockDocs.id });
  }
  await tx.insert(stockDocLines).values(lines.map((l) => ({ ...l, docId: id! })));
  return id!;
}

export async function deleteDraftDoc(tx: Tx, docId: string) {
  const r = await tx.delete(stockDocs).where(and(eq(stockDocs.id, docId), eq(stockDocs.status, "DRAF"))).returning({ id: stockDocs.id });
  if (!r.length) throw new StockError("Hanya draf yang bisa dihapus");
}
