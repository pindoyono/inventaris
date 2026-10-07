import "server-only";
import { kodeBarangInternal } from "@/lib/assets-shared";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { procurementLines, procurements, proposalLines, proposals, rooms, supplyItems } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, postDoc, todayWita } from "@/lib/server/ledger";
import { saveDraftDoc } from "@/lib/server/supply";
import { createAssets } from "@/lib/server/assets";
import { notifyUsers } from "@/lib/server/inbox";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

const dec = (v: string, label: string) => {
  try {
    const n = parseDec(normalizeIdNumber(v));
    if (n < 0n) throw new Error();
    return n;
  } catch {
    throw new UserError(`${label} tidak valid`);
  }
};
const petugasOnly = (s: SchoolSession) => {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya Petugas Barang yang mengelola pengadaan");
};

export type ProcLineInput = { proposalLineId?: string | null; kind: "PERSEDIAAN" | "ASET"; itemId?: string | null; bmdCode?: string | null; description: string; brand?: string | null; qty: string; unitPrice: string };
export type ProcInput = {
  id?: string; proposalId?: string | null; vendorId: string | null; fundingSourceId: string | null; fundingComponentId: string | null;
  orderDate: string; refNumber: string | null; refDate: string | null; taxAmount?: string; note: string | null; lines: ProcLineInput[];
};

/** Sisa jumlah usulan yang belum dibuatkan pengadaan (per baris usulan) */
export async function proposalRemaining(tx: Tx, proposalId: string, exceptProcurementId?: string) {
  const lines = await tx.select().from(proposalLines).where(eq(proposalLines.proposalId, proposalId)).orderBy(asc(proposalLines.lineNo));
  const used = await tx
    .select({ id: procurementLines.proposalLineId, q: sql<string>`coalesce(sum(${procurementLines.qty}),0)` })
    .from(procurementLines)
    .innerJoin(procurements, eq(procurements.id, procurementLines.procurementId))
    .where(and(inArray(procurementLines.proposalLineId, lines.length ? lines.map((l) => l.id) : ["00000000-0000-0000-0000-000000000000"]), ne(procurements.status, "DIBATALKAN"), exceptProcurementId ? ne(procurements.id, exceptProcurementId) : undefined))
    .groupBy(procurementLines.proposalLineId);
  return lines.map((l) => ({ ...l, remaining: parseDec(l.qtyApproved ?? "0") - parseDec(used.find((u) => u.id === l.id)?.q ?? "0") }));
}

export async function saveProcurementDraft(tx: Tx, s: SchoolSession, input: ProcInput) {
  petugasOnly(s);
  if (!input.lines.length) throw new UserError("Isi minimal satu barang");
  if (input.orderDate > todayWita()) throw new UserError("Tanggal tidak boleh di masa depan");
  let remaining: Awaited<ReturnType<typeof proposalRemaining>> = [];
  if (input.proposalId) {
    const [p] = await tx.select().from(proposals).where(eq(proposals.id, input.proposalId));
    if (!p || p.status !== "DISETUJUI") throw new UserError("Usulan belum disetujui");
    remaining = await proposalRemaining(tx, input.proposalId, input.id);
  }
  const lines = input.lines.map((l, i) => {
    const q = dec(l.qty, `Jumlah baris ${i + 1}`);
    if (q <= 0n) throw new UserError(`Jumlah baris ${i + 1} harus lebih dari 0`);
    if (l.bmdCode) l.bmdCode = kodeBarangInternal(l.bmdCode);
    if (l.kind === "ASET" && !/^1\.[35]\./.test(l.bmdCode ?? "")) throw new UserError(`Baris ${i + 1}: pilih kode barang aset`);
    if (l.proposalLineId) {
      const r = remaining.find((x) => x.id === l.proposalLineId);
      if (!r) throw new UserError(`Baris ${i + 1} tidak termasuk usulan ini`);
      if (q > r.remaining) throw new UserError(`Baris ${i + 1} melebihi sisa jumlah yang disetujui (${toDec(r.remaining)})`);
    }
    return {
      schoolId: s.schoolId, lineNo: i + 1, proposalLineId: l.proposalLineId || null, kind: l.kind, itemId: l.itemId || null, bmdCode: l.kind === "ASET" ? l.bmdCode! : null,
      description: l.description.trim(), brand: l.brand?.trim() || null, qty: toDec(q), unitPrice: toDec(dec(l.unitPrice, `Harga baris ${i + 1}`)),
    };
  });
  const head = {
    proposalId: input.proposalId || null, vendorId: input.vendorId, fundingSourceId: input.fundingSourceId, fundingComponentId: input.fundingComponentId, orderDate: input.orderDate,
    refNumber: input.refNumber, refDate: input.refDate, taxAmount: toDec(dec(input.taxAmount || "0", "Pajak")), note: input.note,
  };
  let id = input.id;
  if (id) {
    const [x] = await tx.select().from(procurements).where(eq(procurements.id, id)).for("update");
    if (!x || x.status !== "DRAF") throw new UserError("Hanya draf yang bisa diubah");
    await tx.update(procurements).set({ ...head, updatedAt: new Date() }).where(eq(procurements.id, id));
    await tx.delete(procurementLines).where(eq(procurementLines.procurementId, id));
  } else {
    const number = await nextDocNumber(tx, s.schoolId, "PBJ", Number(input.orderDate.slice(0, 4)));
    [{ id }] = await tx.insert(procurements).values({ ...head, schoolId: s.schoolId, number, createdBy: s.userId }).returning({ id: procurements.id });
  }
  await tx.insert(procurementLines).values(lines.map((l) => ({ ...l, procurementId: id! })));
  return id!;
}

async function lockProc(tx: Tx, id: string) {
  const [p] = await tx.select().from(procurements).where(eq(procurements.id, id)).for("update");
  if (!p) throw new UserError("Pengadaan tidak ditemukan");
  return p;
}

export async function orderProcurement(tx: Tx, s: SchoolSession, id: string) {
  petugasOnly(s);
  const p = await lockProc(tx, id);
  if (p.status !== "DRAF") throw new UserError("Hanya draf yang bisa dipesan");
  await tx.update(procurements).set({ status: "DIPESAN", updatedAt: new Date() }).where(eq(procurements.id, id));
}

export async function cancelProcurement(tx: Tx, s: SchoolSession, id: string) {
  petugasOnly(s);
  const p = await lockProc(tx, id);
  if (!["DRAF", "DIPESAN"].includes(p.status)) throw new UserError("Pengadaan yang sudah ada penerimaannya tidak bisa dibatalkan");
  await tx.update(procurements).set({ status: "DIBATALKAN", closedAt: new Date(), updatedAt: new Date() }).where(eq(procurements.id, id));
}

export type ReceiveLine = { lineId: string; qty: string; itemId?: string | null; roomId?: string | null; condition?: "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT" };

/**
 * Terima barang: persediaan → dokumen PENERIMAAN (KP) diposting di gudang terpilih;
 * aset → dicatat per unit (nomor register, kapitalisasi otomatis). Bisa sebagian.
 */
export async function receiveProcurement(tx: Tx, s: SchoolSession, id: string, r: { date: string; warehouseId: string | null; lines: ReceiveLine[] }) {
  petugasOnly(s);
  const p = await lockProc(tx, id);
  if (!["DIPESAN", "DITERIMA_SEBAGIAN"].includes(p.status)) throw new UserError("Tandai pengadaan sebagai dipesan sebelum menerima barang");
  if (r.date > todayWita() || r.date < p.orderDate) throw new UserError("Tanggal terima tidak valid");
  const lines = await tx.select().from(procurementLines).where(eq(procurementLines.procurementId, id)).orderBy(asc(procurementLines.lineNo));
  const take = r.lines.map((x) => {
    const l = lines.find((y) => y.id === x.lineId);
    if (!l) throw new UserError("Baris tidak dikenal");
    const q = x.qty ? dec(x.qty, `Jumlah terima baris ${l.lineNo}`) : 0n;
    if (q > parseDec(l.qty) - parseDec(l.qtyReceived)) throw new UserError(`Baris ${l.lineNo}: melebihi sisa yang belum diterima`);
    return { l, q, x };
  }).filter((t) => t.q > 0n);
  if (!take.length) throw new UserError("Isi jumlah yang diterima");

  const supply = take.filter((t) => t.l.kind === "PERSEDIAAN");
  const docs: string[] = [];
  if (supply.length) {
    if (!r.warehouseId) throw new UserError("Pilih gudang penerimaan persediaan");
    for (const t of supply) {
      const itemId = t.l.itemId ?? t.x.itemId;
      if (!itemId) throw new UserError(`Baris ${t.l.lineNo}: pilih barang persediaan (NUSP) untuk "${t.l.description}"`);
      const [it] = await tx.select({ id: supplyItems.id }).from(supplyItems).where(eq(supplyItems.id, itemId));
      if (!it) throw new UserError(`Baris ${t.l.lineNo}: barang persediaan tidak ditemukan`);
      if (!t.l.itemId) await tx.update(procurementLines).set({ itemId }).where(eq(procurementLines.id, t.l.id));
      t.l.itemId = itemId;
    }
    const docId = await saveDraftDoc(tx, s.schoolId, s.userId, {
      kind: "PENERIMAAN", date: r.date, warehouseId: r.warehouseId, vendorId: p.vendorId, fundingSourceId: p.fundingSourceId, fundingComponentId: p.fundingComponentId,
      acquisition: "PEMBELIAN", refNumber: p.refNumber, refDate: p.refDate, procurementId: id, note: `Pengadaan ${p.number}`,
      lines: supply.map((t) => ({ itemId: t.l.itemId!, qty: toDec(t.q), unitPrice: t.l.unitPrice })),
    });
    docs.push(await postDoc(tx, s.schoolId, s.userId, docId));
  }
  let assetUnits = 0;
  for (const t of take.filter((t) => t.l.kind === "ASET")) {
    if (t.x.roomId) {
      const [rm] = await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, t.x.roomId));
      if (!rm) throw new UserError("Ruangan tidak ditemukan");
    }
    if (t.q % 100n !== 0n) throw new UserError(`Baris ${t.l.lineNo}: jumlah aset harus bilangan bulat`);
    const res = await createAssets(tx, s, {
      bmdCode: t.l.bmdCode!, name: t.l.description, brand: t.l.brand, attrs: {}, acqDate: r.date, acqPrice: t.l.unitPrice, acquisition: "PEMBELIAN",
      fundingSourceId: p.fundingSourceId, fundingComponentId: p.fundingComponentId, vendorId: p.vendorId, refNumber: p.refNumber ?? p.number,
      roomId: t.x.roomId ?? null, unitId: null, condition: t.x.condition ?? "BAIK", note: `Pengadaan ${p.number}`, qty: Number(t.q / 100n), startRegNo: null, procurementId: id,
    });
    assetUnits += res.ids.length;
  }
  for (const t of take) await tx.update(procurementLines).set({ qtyReceived: toDec(parseDec(t.l.qtyReceived) + t.q) }).where(eq(procurementLines.id, t.l.id));
  const after = await tx.select().from(procurementLines).where(eq(procurementLines.procurementId, id));
  const done = after.every((l) => parseDec(l.qtyReceived) >= parseDec(l.qty));
  await tx.update(procurements).set({ status: done ? "DITERIMA" : "DITERIMA_SEBAGIAN", ...(done ? { closedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(procurements.id, id));

  // Usulan selesai bila seluruh jumlah yang disetujui sudah diterima
  if (done && p.proposalId) {
    const rem = await proposalRemaining(tx, p.proposalId);
    const open = await tx.select({ n: sql<number>`count(*)::int` }).from(procurements).where(and(eq(procurements.proposalId, p.proposalId), inArray(procurements.status, ["DRAF", "DIPESAN", "DITERIMA_SEBAGIAN"])));
    if (rem.every((x) => x.remaining <= 0n) && open[0].n === 0) {
      const [pr] = await tx.update(proposals).set({ status: "SELESAI", closedAt: new Date(), updatedAt: new Date() }).where(and(eq(proposals.id, p.proposalId), eq(proposals.status, "DISETUJUI"))).returning();
      if (pr) await notifyUsers(tx, s.schoolId, [pr.requestedBy], { title: `Usulan ${pr.number} selesai: barang sudah diterima`, link: `/usulan/${pr.id}` }, s.userId);
    }
  }
  return { docs, assetUnits, done };
}
