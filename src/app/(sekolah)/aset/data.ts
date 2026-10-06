import "server-only";
import { and, asc, eq, inArray, not, like } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Tx } from "@/db";
import { db } from "@/db";
import { bmdCodes, favoriteBmdCodes, fundingComponents, fundingSources, rooms, schoolSettings, units, vendors } from "@/db/schema";

export async function loadAssetFormOptions(tx: Tx) {
  const [rm, un, vd, fs, fc, [st], fav] = await Promise.all([
    tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name)),
    tx.select({ id: units.id, name: units.name }).from(units).where(eq(units.isActive, true)).orderBy(asc(units.name)),
    tx.select({ id: vendors.id, name: vendors.name }).from(vendors).orderBy(asc(vendors.name)),
    tx.select({ id: fundingSources.id, name: fundingSources.name }).from(fundingSources).where(eq(fundingSources.isActive, true)).orderBy(asc(fundingSources.name)),
    tx.select({ id: fundingComponents.id, name: fundingComponents.name, sourceId: fundingComponents.fundingSourceId }).from(fundingComponents).where(eq(fundingComponents.isActive, true)).orderBy(asc(fundingComponents.name)),
    tx.select({ cap: schoolSettings.capitalization }).from(schoolSettings),
    tx.select({ code: favoriteBmdCodes.code }).from(favoriteBmdCodes).where(not(like(favoriteBmdCodes.code, "1.1.7.%"))),
  ]);
  const parent = alias(bmdCodes, "parent");
  const favorites = fav.length
    ? await db
        .select({ code: bmdCodes.code, name: bmdCodes.name, parent: parent.name })
        .from(bmdCodes)
        .leftJoin(parent, eq(parent.code, bmdCodes.parentCode))
        .where(and(inArray(bmdCodes.code, fav.map((f) => f.code)), eq(bmdCodes.selectable, true)))
        .orderBy(asc(bmdCodes.name))
    : [];
  return {
    rooms: rm,
    units: un,
    vendors: vd,
    fundingSources: fs,
    fundingComponents: fc,
    capitalization: st.cap,
    favorites: favorites.map((f) => ({ code: f.code, name: f.name, parent: f.parent ?? "" })),
  };
}
export type AssetFormOptions = Awaited<ReturnType<typeof loadAssetFormOptions>>;
