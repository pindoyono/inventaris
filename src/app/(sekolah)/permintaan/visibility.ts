import "server-only";
import { eq, inArray, or, type SQL } from "drizzle-orm";
import type { Tx } from "@/db";
import { supplyRequests } from "@/db/schema";
import { allowedUnitIds } from "@/lib/server/requests";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

/** Pengusul (tanpa peran lain) hanya melihat nota buatannya atau unit lingkupnya */
export async function requestScope(tx: Tx, s: SchoolSession): Promise<SQL | undefined> {
  if (hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"])) return undefined;
  const units = await allowedUnitIds(tx, s);
  const own = eq(supplyRequests.requestedBy, s.userId);
  return units === "ALL" || !units.length ? own : or(own, inArray(supplyRequests.unitId, units));
}
