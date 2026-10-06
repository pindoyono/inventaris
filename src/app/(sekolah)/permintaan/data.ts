import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { stockBalances, supplyItems, units, uoms, warehouses } from "@/db/schema";
import { allowedUnitIds } from "@/lib/server/requests";
import type { SchoolSession } from "@/lib/tenant";

/** Pilihan form nota: unit yang boleh, barang aktif + stok total (perkiraan ketersediaan) */
export async function loadRequestOptions(tx: Tx, s: SchoolSession) {
  const allowed = await allowedUnitIds(tx, s);
  const unitRows = await tx
    .select({ id: units.id, name: units.name })
    .from(units)
    .where(allowed === "ALL" ? eq(units.isActive, true) : inArray(units.id, allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]))
    .orderBy(asc(units.name));
  const items = await tx
    .select({
      id: supplyItems.id, nusp: supplyItems.nusp, name: supplyItems.name, spec: supplyItems.spec, uom: uoms.name,
      stock: sql<string>`coalesce((select sum(${stockBalances.qty}) from ${stockBalances} where ${stockBalances.itemId} = ${supplyItems.id}), 0)`,
    })
    .from(supplyItems)
    .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
    .where(eq(supplyItems.isActive, true))
    .orderBy(asc(supplyItems.name));
  const whs = await tx.select({ id: warehouses.id, name: warehouses.name, isDefault: warehouses.isDefault }).from(warehouses).where(eq(warehouses.isActive, true)).orderBy(asc(warehouses.name));
  return { units: unitRows, items, warehouses: whs };
}
export type RequestOptions = Awaited<ReturnType<typeof loadRequestOptions>>;
