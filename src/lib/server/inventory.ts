import "server-only";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import type { Tx } from "@/db";
import { assetEvents, assetInventories, assetInventoryLines, assets } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, todayWita } from "@/lib/server/ledger";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

type Cond = "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT";
const petugas = (s: SchoolSession) => hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);

async function lockInv(tx: Tx, id: string) {
  const [v] = await tx.select().from(assetInventories).where(eq(assetInventories.id, id)).for("update");
  if (!v) throw new UserError("Inventarisasi tidak ditemukan");
  return v;
}

/** Mulai inventarisasi ruangan: daftar aset menurut catatan (KIR saat ini) */
export async function startInventory(tx: Tx, s: SchoolSession, roomId: string, note: string | null) {
  if (!petugas(s)) throw new UserError("Hanya Petugas Barang");
  const date = todayWita();
  const number = await nextDocNumber(tx, s.schoolId, "INV", Number(date.slice(0, 4)));
  const [v] = await tx.insert(assetInventories).values({ schoolId: s.schoolId, number, roomId, date, note, createdBy: s.userId }).returning();
  const list = await tx.select({ id: assets.id, condition: assets.condition }).from(assets).where(and(eq(assets.roomId, roomId), ne(assets.status, "DIHAPUS"))).orderBy(asc(assets.bmdCode), asc(assets.regNo));
  if (list.length) await tx.insert(assetInventoryLines).values(list.map((a) => ({ schoolId: s.schoolId, inventoryId: v.id, assetId: a.id, conditionRecorded: a.condition })));
  return v;
}

export type CheckInput = { lineId: string; found: boolean | null; condition?: Cond | null; note?: string | null };

export async function saveChecks(tx: Tx, s: SchoolSession, id: string, checks: CheckInput[], extras: { name: string; qty: number; note?: string | null }[] = []) {
  const v = await lockInv(tx, id);
  if (v.status !== "DRAF" || !petugas(s)) throw new UserError("Inventarisasi sudah selesai");
  for (const c of checks)
    await tx
      .update(assetInventoryLines)
      .set({ found: c.found, conditionFound: c.found ? (c.condition ?? null) : null, note: c.note?.trim() || null })
      .where(and(eq(assetInventoryLines.id, c.lineId), eq(assetInventoryLines.inventoryId, id)));
  for (const x of extras) {
    if (x.name.trim().length < 3 || !(x.qty >= 1)) throw new UserError("Barang belum tercatat: isi uraian dan jumlah");
    await tx.insert(assetInventoryLines).values({ schoolId: s.schoolId, inventoryId: id, extraName: x.name.trim(), extraQty: Math.floor(x.qty), note: x.note?.trim() || null });
  }
}

export async function removeExtra(tx: Tx, s: SchoolSession, id: string, lineId: string) {
  const v = await lockInv(tx, id);
  if (v.status !== "DRAF" || !petugas(s)) throw new UserError("Inventarisasi sudah selesai");
  await tx.delete(assetInventoryLines).where(and(eq(assetInventoryLines.id, lineId), eq(assetInventoryLines.inventoryId, id), isNull(assetInventoryLines.assetId)));
}

/**
 * Selesaikan: kondisi berubah → diperbarui; tidak ditemukan → status HILANG (tetap di daftar barang
 * sampai SK penghapusan); ditemukan kembali → DIGUNAKAN. Barang belum tercatat jadi daftar tindak lanjut.
 */
export async function finishInventory(tx: Tx, s: SchoolSession, id: string) {
  const v = await lockInv(tx, id);
  if (v.status !== "DRAF" || !petugas(s)) throw new UserError("Inventarisasi tidak bisa diselesaikan");
  const lines = await tx.select().from(assetInventoryLines).where(eq(assetInventoryLines.inventoryId, id));
  const assetLines = lines.filter((l) => l.assetId);
  if (assetLines.some((l) => l.found === null)) throw new UserError("Periksa semua barang (ditemukan / tidak ditemukan) terlebih dahulu");
  const rows = assetLines.length ? await tx.select().from(assets).where(inArray(assets.id, assetLines.map((l) => l.assetId!))).for("update") : [];
  const date = todayWita();
  const ev = (assetId: string, e: Partial<typeof assetEvents.$inferInsert>) => ({
    schoolId: s.schoolId, assetId, date, createdBy: s.userId, createdByName: s.userName, note: `Inventarisasi ${v.number}`, ...e,
  }) as typeof assetEvents.$inferInsert;
  const summary = { checked: assetLines.length, missing: 0, changed: 0, recovered: 0, extras: lines.length - assetLines.length };
  for (const l of assetLines) {
    const a = rows.find((x) => x.id === l.assetId)!;
    if (!l.found) {
      if (a.status !== "HILANG" && a.status !== "DIPINJAM") {
        await tx.update(assets).set({ status: "HILANG", updatedAt: new Date() }).where(eq(assets.id, a.id));
        await tx.insert(assetEvents).values(ev(a.id, { kind: "STATUS", fromStatus: a.status, toStatus: "HILANG", note: `Tidak ditemukan saat inventarisasi ${v.number}${l.note ? `: ${l.note}` : ""}` }));
        summary.missing++;
      }
      continue;
    }
    if (a.status === "HILANG") {
      await tx.update(assets).set({ status: "DIGUNAKAN", updatedAt: new Date() }).where(eq(assets.id, a.id));
      await tx.insert(assetEvents).values(ev(a.id, { kind: "STATUS", fromStatus: "HILANG", toStatus: "DIGUNAKAN", note: `Ditemukan kembali saat inventarisasi ${v.number}` }));
      summary.recovered++;
    }
    if (l.conditionFound && l.conditionFound !== a.condition) {
      await tx.update(assets).set({ condition: l.conditionFound, updatedAt: new Date() }).where(eq(assets.id, a.id));
      await tx.insert(assetEvents).values(ev(a.id, { kind: "KONDISI", fromCondition: a.condition, toCondition: l.conditionFound, note: `Inventarisasi ${v.number}${l.note ? `: ${l.note}` : ""}` }));
      summary.changed++;
    }
  }
  await tx.update(assetInventories).set({ status: "SELESAI", finishedBy: s.userId, finishedAt: new Date(), updatedAt: new Date() }).where(eq(assetInventories.id, id));
  return summary;
}

export async function cancelInventory(tx: Tx, s: SchoolSession, id: string) {
  const v = await lockInv(tx, id);
  if (v.status !== "DRAF" || !petugas(s)) throw new UserError("Hanya inventarisasi draf yang bisa dibatalkan");
  await tx.update(assetInventories).set({ status: "DIBATALKAN", updatedAt: new Date() }).where(eq(assetInventories.id, id));
}
