import "server-only";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import type { Tx } from "@/db";
import { db } from "@/db";
import { bmdCodes, favoriteBmdCodes, localBmdCodes, uoms } from "@/db/schema";

export async function loadItemFormOptions(tx: Tx) {
  const units = await tx.select({ id: uoms.id, name: uoms.name }).from(uoms).orderBy(asc(uoms.name));
  const favCodes = (await tx.select({ code: favoriteBmdCodes.code }).from(favoriteBmdCodes).where(like(favoriteBmdCodes.code, "1.1.7.%"))).map((f) => f.code);
  const official = favCodes.length
    ? await db
        .select({ code: bmdCodes.code, name: bmdCodes.name, parentCode: bmdCodes.parentCode })
        .from(bmdCodes)
        .where(and(inArray(bmdCodes.code, favCodes), eq(bmdCodes.level, 7)))
        .orderBy(asc(bmdCodes.code))
    : [];
  const parents = official.length
    ? await db.select({ code: bmdCodes.code, name: bmdCodes.name }).from(bmdCodes).where(inArray(bmdCodes.code, [...new Set(official.map((o) => o.parentCode!))]))
    : [];
  const pName = new Map(parents.map((p) => [p.code, p.name]));
  const locals = await tx.select({ code: localBmdCodes.code, name: localBmdCodes.name }).from(localBmdCodes).where(inArray(localBmdCodes.code, favCodes.length ? favCodes : [""]));
  const favorites = [
    ...official.map((o) => ({ code: o.code, name: o.name, parent: pName.get(o.parentCode!) ?? "" })),
    ...locals.map((l) => ({ ...l, parent: "Kode lokal" })),
  ];
  return { uoms: units, favorites };
}

export async function bmdName(tx: Tx, code: string) {
  const [o] = await db.select({ name: bmdCodes.name }).from(bmdCodes).where(eq(bmdCodes.code, code));
  if (o) return o.name;
  const [l] = await tx.select({ name: localBmdCodes.name }).from(localBmdCodes).where(eq(localBmdCodes.code, code));
  return l?.name ?? code;
}
