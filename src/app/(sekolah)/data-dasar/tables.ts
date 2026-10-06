import "server-only";
import { asc } from "drizzle-orm";
import type { Tx } from "@/db";
import { buildings, fundingComponents, fundingSources, rooms, units, uoms, vendors, warehouses } from "@/db/schema";
import type { EntitySlug, RefKey } from "./config";

export const TABLES = {
  unit: units,
  gedung: buildings,
  ruangan: rooms,
  gudang: warehouses,
  satuan: uoms,
  "sumber-dana": fundingSources,
  "komponen-dana": fundingComponents,
  penyedia: vendors,
} as const satisfies Record<EntitySlug, unknown>;

/** Opsi pilihan referensi (dalam konteks RLS) */
export async function loadRefs(tx: Tx, keys: RefKey[]) {
  const out: Partial<Record<RefKey, { id: string; name: string }[]>> = {};
  for (const k of new Set(keys)) {
    const t = { buildings, units, rooms, fundingSources }[k];
    out[k] = await tx.select({ id: t.id, name: t.name }).from(t).orderBy(asc(t.name));
  }
  return out;
}
