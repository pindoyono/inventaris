import "server-only";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import type { Tx } from "@/db";
import { stockBalances, stockLots, stockOpnameLines, stockOpnames, supplyItems } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, postDoc, todayWita } from "@/lib/server/ledger";
import { saveDraftDoc, type DocLineInput } from "@/lib/server/supply";
import { notifyUsers, userIdsWithRoles } from "@/lib/server/inbox";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

const petugas = (s: SchoolSession) => hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);

async function lockOpname(tx: Tx, id: string) {
  const [o] = await tx.select().from(stockOpnames).where(eq(stockOpnames.id, id)).for("update");
  if (!o) throw new UserError("Stock opname tidak ditemukan");
  return o;
}

/** Mulai opname: gudang dibekukan, saldo sistem barang bersaldo disalin sebagai pembanding */
export async function startOpname(tx: Tx, s: SchoolSession, warehouseId: string, note: string | null) {
  if (!petugas(s)) throw new UserError("Hanya Petugas Barang yang bisa memulai stock opname");
  const date = todayWita();
  const [busy] = await tx.select({ n: stockOpnames.number }).from(stockOpnames).where(and(eq(stockOpnames.warehouseId, warehouseId), inArray(stockOpnames.status, ["DRAF", "DIAJUKAN"])));
  if (busy) throw new UserError(`Gudang ini sedang dalam stock opname ${busy.n}`);
  const number = await nextDocNumber(tx, s.schoolId, "SO", Number(date.slice(0, 4)));
  let o;
  try {
    [o] = await tx.insert(stockOpnames).values({ schoolId: s.schoolId, number, warehouseId, date, note, createdBy: s.userId }).returning();
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === "23505") throw new UserError("Gudang ini sedang dalam stock opname lain");
    throw e;
  }
  const bal = await tx.select().from(stockBalances).where(and(eq(stockBalances.warehouseId, warehouseId), gt(stockBalances.qty, "0")));
  if (bal.length)
    await tx.insert(stockOpnameLines).values(bal.map((b) => ({ schoolId: s.schoolId, opnameId: o.id, itemId: b.itemId, systemQty: b.qty })));
  return o;
}

/** Tambah barang yang ditemukan fisik tetapi saldo sistemnya 0 */
export async function addOpnameItem(tx: Tx, s: SchoolSession, id: string, itemId: string) {
  const o = await lockOpname(tx, id);
  if (o.status !== "DRAF" || !petugas(s)) throw new UserError("Opname tidak bisa diubah");
  const [it] = await tx.select({ id: supplyItems.id }).from(supplyItems).where(eq(supplyItems.id, itemId));
  if (!it) throw new UserError("Barang tidak ditemukan");
  const [b] = await tx.select().from(stockBalances).where(and(eq(stockBalances.itemId, itemId), eq(stockBalances.warehouseId, o.warehouseId)));
  await tx.insert(stockOpnameLines).values({ schoolId: s.schoolId, opnameId: id, itemId, systemQty: b?.qty ?? "0" }).onConflictDoNothing();
}

export type CountInput = { lineId: string; physicalQty: string; damagedQty?: string; surplusPrice?: string; note?: string };

export async function saveCounts(tx: Tx, s: SchoolSession, id: string, counts: CountInput[]) {
  const o = await lockOpname(tx, id);
  if (o.status !== "DRAF" || !petugas(s)) throw new UserError("Hasil hitung hanya bisa diubah selama opname masih draf");
  const num = (v: string | undefined, label: string) => {
    if (v === undefined || v.trim() === "") return null;
    try {
      const n = parseDec(normalizeIdNumber(v));
      if (n < 0n) throw new Error();
      return toDec(n);
    } catch {
      throw new UserError(`${label} tidak valid`);
    }
  };
  for (const c of counts) {
    await tx
      .update(stockOpnameLines)
      .set({
        physicalQty: num(c.physicalQty, "Jumlah fisik"),
        damagedQty: num(c.damagedQty, "Jumlah rusak") ?? "0",
        surplusPrice: num(c.surplusPrice, "Harga kelebihan"),
        note: c.note?.trim() || null,
      })
      .where(and(eq(stockOpnameLines.id, c.lineId), eq(stockOpnameLines.opnameId, id)));
  }
}

export async function submitOpname(tx: Tx, s: SchoolSession, id: string) {
  const o = await lockOpname(tx, id);
  if (o.status !== "DRAF" || !petugas(s)) throw new UserError("Opname tidak bisa diajukan");
  const lines = await tx.select().from(stockOpnameLines).where(eq(stockOpnameLines.opnameId, id));
  if (!lines.length) throw new UserError("Tidak ada barang untuk dihitung");
  if (lines.some((l) => l.physicalQty === null)) throw new UserError("Isi jumlah fisik semua barang terlebih dahulu (isi 0 bila tidak ada)");
  await tx.update(stockOpnames).set({ status: "DIAJUKAN", submittedAt: new Date(), lastReason: null, updatedAt: new Date() }).where(eq(stockOpnames.id, id));
  await notifyUsers(tx, s.schoolId, await userIdsWithRoles(tx, ["KEPSEK"]), { title: `Stock opname ${o.number} menunggu persetujuan`, link: `/audit/opname/${id}` }, s.userId);
}

export async function rejectOpname(tx: Tx, s: SchoolSession, id: string, reason: string) {
  if (!hasAnyRole(s.roles, ["KEPSEK"])) throw new UserError("Hanya Kepala Sekolah");
  const o = await lockOpname(tx, id);
  if (o.status !== "DIAJUKAN") throw new UserError("Opname tidak dalam status diajukan");
  if (reason.trim().length < 5) throw new UserError("Tulis alasan (minimal 5 karakter)");
  await tx.update(stockOpnames).set({ status: "DRAF", lastReason: reason, updatedAt: new Date() }).where(eq(stockOpnames.id, id));
  await notifyUsers(tx, s.schoolId, [o.createdBy], { title: `Stock opname ${o.number} dikembalikan`, body: `Alasan: ${reason}`, link: `/audit/opname/${id}` }, s.userId);
}

export async function cancelOpname(tx: Tx, s: SchoolSession, id: string) {
  const o = await lockOpname(tx, id);
  if (o.status !== "DRAF" || !petugas(s)) throw new UserError("Hanya opname draf yang bisa dibatalkan");
  await tx.update(stockOpnames).set({ status: "DIBATALKAN", updatedAt: new Date() }).where(eq(stockOpnames.id, id));
}

/** Selisih per baris: fisik baik + rusak − sistem */
export function opnameDiff(l: { systemQty: string; physicalQty: string | null; damagedQty: string }) {
  if (l.physicalQty === null) return null;
  return parseDec(l.physicalQty) + parseDec(l.damagedQty) - parseDec(l.systemQty);
}

/**
 * Kepala Sekolah menyetujui: kelebihan → PENYESUAIAN_TAMBAH (harga isian atau harga lot terakhir),
 * kekurangan → PENYESUAIAN_KURANG (FIFO), rusak/usang → RUSAK_USANG (FIFO). Gudang dibuka kembali.
 */
export async function approveOpname(tx: Tx, s: SchoolSession, id: string) {
  if (!hasAnyRole(s.roles, ["KEPSEK"])) throw new UserError("Hanya Kepala Sekolah yang bisa menyetujui stock opname");
  const o = await lockOpname(tx, id);
  if (o.status !== "DIAJUKAN") throw new UserError("Opname tidak dalam status diajukan");
  const lines = await tx.select().from(stockOpnameLines).where(eq(stockOpnameLines.opnameId, id)).orderBy(asc(stockOpnameLines.itemId));
  const plus: DocLineInput[] = [], minus: DocLineInput[] = [], damaged: DocLineInput[] = [];
  for (const l of lines) {
    const d = opnameDiff(l)!;
    if (d > 0n) {
      let price = l.surplusPrice;
      if (price === null) {
        const [lot] = await tx
          .select({ p: stockLots.unitPrice })
          .from(stockLots)
          .where(and(eq(stockLots.itemId, l.itemId), eq(stockLots.warehouseId, o.warehouseId)))
          .orderBy(desc(stockLots.receivedDate), desc(stockLots.createdAt))
          .limit(1);
        price = lot?.p ?? null;
      }
      if (price === null) {
        const [it] = await tx.select({ name: supplyItems.name }).from(supplyItems).where(eq(supplyItems.id, l.itemId));
        throw new UserError(`Harga kelebihan untuk ${it?.name ?? "barang"} belum diisi (tidak ada harga perolehan sebelumnya)`);
      }
      plus.push({ itemId: l.itemId, qty: toDec(d), unitPrice: price });
    } else if (d < 0n) minus.push({ itemId: l.itemId, qty: toDec(-d) });
    if (parseDec(l.damagedQty) > 0n) damaged.push({ itemId: l.itemId, qty: l.damagedQty });
  }
  const docs: string[] = [];
  const post = async (kind: "PENYESUAIAN_TAMBAH" | "PENYESUAIAN_KURANG" | "RUSAK_USANG", ls: DocLineInput[], note: string) => {
    if (!ls.length) return;
    const docId = await saveDraftDoc(tx, s.schoolId, s.userId, { kind, date: o.date, warehouseId: o.warehouseId, opnameId: id, note, lines: ls });
    docs.push(await postDoc(tx, s.schoolId, s.userId, docId));
  };
  await post("PENYESUAIAN_TAMBAH", plus, `Kelebihan hasil stock opname ${o.number}`);
  await post("PENYESUAIAN_KURANG", minus, `Kekurangan hasil stock opname ${o.number}`);
  await post("RUSAK_USANG", damaged, `Persediaan rusak berat/usang hasil stock opname ${o.number}`);
  await tx.update(stockOpnames).set({ status: "DISETUJUI", approvedBy: s.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(stockOpnames.id, id));
  await notifyUsers(tx, s.schoolId, [o.createdBy], { title: `Stock opname ${o.number} disetujui`, body: docs.length ? `Dokumen penyesuaian: ${docs.join(", ")}` : "Tidak ada selisih.", link: `/audit/opname/${id}` }, s.userId);
  return docs;
}


