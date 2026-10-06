import "server-only";
import { asc, eq, inArray, or, type SQL } from "drizzle-orm";
import type { Tx } from "@/db";
import { fundingComponents, fundingSources, proposals, supplyItems, units, uoms } from "@/db/schema";
import { allowedUnitIds } from "@/lib/server/requests";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

export async function proposalScope(tx: Tx, s: SchoolSession): Promise<SQL | undefined> {
  if (hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"])) return undefined;
  const u = await allowedUnitIds(tx, s);
  const own = eq(proposals.requestedBy, s.userId);
  return u === "ALL" || !u.length ? own : or(own, inArray(proposals.unitId, u));
}

export async function loadProposalOptions(tx: Tx, s: SchoolSession) {
  const allowed = await allowedUnitIds(tx, s);
  const un = await tx.select({ id: units.id, name: units.name }).from(units).where(allowed === "ALL" ? eq(units.isActive, true) : inArray(units.id, allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"])).orderBy(asc(units.name));
  const fs = await tx.select({ id: fundingSources.id, name: fundingSources.name }).from(fundingSources).where(eq(fundingSources.isActive, true)).orderBy(asc(fundingSources.name));
  const fc = await tx.select({ id: fundingComponents.id, name: fundingComponents.name, sourceId: fundingComponents.fundingSourceId }).from(fundingComponents).where(eq(fundingComponents.isActive, true)).orderBy(asc(fundingComponents.name));
  const items = await tx.select({ id: supplyItems.id, name: supplyItems.name, nusp: supplyItems.nusp, uom: uoms.name }).from(supplyItems).innerJoin(uoms, eq(uoms.id, supplyItems.uomId)).where(eq(supplyItems.isActive, true)).orderBy(asc(supplyItems.name));
  const uomList = (await tx.select({ n: uoms.name }).from(uoms).orderBy(asc(uoms.name))).map((x) => x.n);
  return { units: un, fundingSources: fs, fundingComponents: fc, items, uoms: uomList };
}
export type ProposalOptions = Awaited<ReturnType<typeof loadProposalOptions>>;
