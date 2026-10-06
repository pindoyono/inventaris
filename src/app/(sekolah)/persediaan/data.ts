import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { fundingComponents, fundingSources, stockBalances, supplyItems, units, uoms, vendors, warehouses } from "@/db/schema";

export type Opt = { id: string; name: string };

/** Pilihan untuk form dokumen stok */
export async function loadDocOptions(tx: Tx) {
  const [wh, un, vd, fs, fc, items, bal] = await Promise.all([
    tx.select({ id: warehouses.id, name: warehouses.name, isDefault: warehouses.isDefault }).from(warehouses).where(eq(warehouses.isActive, true)).orderBy(asc(warehouses.name)),
    tx.select({ id: units.id, name: units.name }).from(units).where(eq(units.isActive, true)).orderBy(asc(units.name)),
    tx.select({ id: vendors.id, name: vendors.name }).from(vendors).orderBy(asc(vendors.name)),
    tx.select({ id: fundingSources.id, name: fundingSources.name }).from(fundingSources).where(eq(fundingSources.isActive, true)).orderBy(asc(fundingSources.name)),
    tx
      .select({ id: fundingComponents.id, name: fundingComponents.name, sourceId: fundingComponents.fundingSourceId })
      .from(fundingComponents)
      .where(eq(fundingComponents.isActive, true))
      .orderBy(asc(fundingComponents.name)),
    tx
      .select({ id: supplyItems.id, nusp: supplyItems.nusp, name: supplyItems.name, spec: supplyItems.spec, uom: uoms.name })
      .from(supplyItems)
      .innerJoin(uoms, eq(uoms.id, supplyItems.uomId))
      .where(eq(supplyItems.isActive, true))
      .orderBy(asc(supplyItems.name)),
    tx.select({ itemId: stockBalances.itemId, warehouseId: stockBalances.warehouseId, qty: stockBalances.qty }).from(stockBalances).where(sql`${stockBalances.qty} > 0`),
  ]);
  const stock: Record<string, Record<string, string>> = {};
  for (const b of bal) (stock[b.itemId] ??= {})[b.warehouseId] = b.qty;
  return { warehouses: wh, units: un, vendors: vd, fundingSources: fs, fundingComponents: fc, items, stock };
}

export type DocOptions = Awaited<ReturnType<typeof loadDocOptions>>;
