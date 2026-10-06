import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { assetEvents, assets, maintenances } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { todayWita } from "@/lib/server/ledger";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { hasAnyRole } from "@/lib/roles";
import { addAssetValue } from "@/lib/server/asset-changes";
import type { SchoolSession } from "@/lib/tenant";

type Cond = "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT";
export const MAINT_KIND_LABEL = { RUTIN: "Pemeliharaan rutin", PERBAIKAN: "Perbaikan", PENINGKATAN: "Peningkatan (menambah umur/kapasitas)" } as const;

const money = (v: string | undefined) => {
  try {
    const n = parseDec(normalizeIdNumber(v || "0"));
    if (n < 0n) throw new Error();
    return toDec(n);
  } catch {
    throw new UserError("Biaya tidak valid");
  }
};

export type MaintInput = {
  assetId: string; kind: keyof typeof MAINT_KIND_LABEL; startDate: string; executor: string | null; description: string; cost?: string;
  fundingSourceId: string | null; fundingComponentId: string | null;
  /** Bila diisi: langsung selesai (pemeliharaan singkat). Kosong: barang masuk status dalam pemeliharaan. */
  finish?: { endDate: string; conditionAfter: Cond } | null;
  /** Peningkatan: tambahkan biaya ke nilai aset (kapitalisasi) saat selesai */
  capitalize?: boolean;
};

/** Kapitalisasi biaya peningkatan ke nilai aset (Permendagri 19/2016: menambah umur/kapasitas/mutu) */
async function capitalize(tx: Tx, s: SchoolSession, a: typeof assets.$inferSelect, m: { id: string; kind: string; cost: string; description: string }, date: string) {
  if (m.kind !== "PENINGKATAN") throw new UserError("Kapitalisasi hanya untuk pemeliharaan peningkatan");
  if (parseDec(m.cost) <= 0n) throw new UserError("Isi biaya untuk dikapitalisasi");
  await addAssetValue(tx, s, a, "KAPITALISASI", parseDec(m.cost), date, { maintenanceId: m.id, note: m.description });
  await tx.update(maintenances).set({ capitalized: true }).where(eq(maintenances.id, m.id));
}

export async function recordMaintenance(tx: Tx, s: SchoolSession, m: MaintInput) {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya Petugas Barang");
  if (m.description.trim().length < 5) throw new UserError("Isi uraian pekerjaan");
  const today = todayWita();
  if (m.startDate > today || (m.finish && (m.finish.endDate > today || m.finish.endDate < m.startDate))) throw new UserError("Tanggal tidak valid");
  const [a] = await tx.select().from(assets).where(eq(assets.id, m.assetId)).for("update");
  if (!a) throw new UserError("Aset tidak ditemukan");
  if (a.status !== "DIGUNAKAN") throw new UserError(`Aset sedang ${a.status.toLowerCase().replaceAll("_", " ")}`);
  const [row] = await tx
    .insert(maintenances)
    .values({
      schoolId: s.schoolId, assetId: a.id, kind: m.kind, status: m.finish ? "SELESAI" : "BERJALAN", startDate: m.startDate, endDate: m.finish?.endDate ?? null,
      executor: m.executor, description: m.description.trim(), cost: money(m.cost), fundingSourceId: m.fundingSourceId, fundingComponentId: m.fundingComponentId,
      conditionBefore: a.condition, conditionAfter: m.finish?.conditionAfter ?? null, createdBy: s.userId,
    })
    .returning();
  const base = { schoolId: s.schoolId, assetId: a.id, createdBy: s.userId, createdByName: s.userName };
  if (m.finish && m.capitalize) await capitalize(tx, s, a, { id: row.id, kind: m.kind, cost: row.cost, description: row.description }, m.finish.endDate);
  if (m.finish) {
    if (m.finish.conditionAfter !== a.condition) {
      await tx.update(assets).set({ condition: m.finish.conditionAfter, updatedAt: new Date() }).where(eq(assets.id, a.id));
      await tx.insert(assetEvents).values({ ...base, kind: "KONDISI", date: m.finish.endDate, fromCondition: a.condition, toCondition: m.finish.conditionAfter, note: `${MAINT_KIND_LABEL[m.kind]}: ${m.description.trim()}` });
    }
  } else {
    await tx.update(assets).set({ status: "DALAM_PEMELIHARAAN", updatedAt: new Date() }).where(eq(assets.id, a.id));
    await tx.insert(assetEvents).values({ ...base, kind: "STATUS", date: m.startDate, fromStatus: "DIGUNAKAN", toStatus: "DALAM_PEMELIHARAAN", note: `${MAINT_KIND_LABEL[m.kind]}: ${m.description.trim()}` });
  }
  return row.id;
}

export async function finishMaintenance(tx: Tx, s: SchoolSession, id: string, f: { endDate: string; conditionAfter: Cond; cost?: string; executor?: string | null; capitalize?: boolean }) {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya Petugas Barang");
  const [m] = await tx.select().from(maintenances).where(eq(maintenances.id, id)).for("update");
  if (!m || m.status !== "BERJALAN") throw new UserError("Pemeliharaan tidak sedang berjalan");
  if (f.endDate < m.startDate || f.endDate > todayWita()) throw new UserError("Tanggal selesai tidak valid");
  const [a] = await tx.select().from(assets).where(eq(assets.id, m.assetId)).for("update");
  await tx
    .update(maintenances)
    .set({ status: "SELESAI", endDate: f.endDate, conditionAfter: f.conditionAfter, cost: f.cost !== undefined ? money(f.cost) : m.cost, executor: f.executor ?? m.executor, updatedAt: new Date() })
    .where(eq(maintenances.id, id));
  await tx.update(assets).set({ status: "DIGUNAKAN", condition: f.conditionAfter, updatedAt: new Date() }).where(eq(assets.id, a.id));
  if (f.capitalize) await capitalize(tx, s, a, { id: m.id, kind: m.kind, cost: f.cost !== undefined ? money(f.cost) : m.cost, description: m.description }, f.endDate);
  const base = { schoolId: s.schoolId, assetId: a.id, date: f.endDate, createdBy: s.userId, createdByName: s.userName };
  await tx.insert(assetEvents).values({ ...base, kind: "STATUS", fromStatus: "DALAM_PEMELIHARAAN", toStatus: "DIGUNAKAN", note: `Selesai: ${m.description}` });
  if (f.conditionAfter !== a.condition)
    await tx.insert(assetEvents).values({ ...base, kind: "KONDISI", fromCondition: a.condition, toCondition: f.conditionAfter, note: `Setelah ${MAINT_KIND_LABEL[m.kind].toLowerCase()}` });
}
