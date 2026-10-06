"use server";

import { eq } from "drizzle-orm";
import { assets, qrTokens, rooms } from "@/db/schema";
import { db } from "@/db";
import { requireSchoolUser, withSchool } from "@/lib/tenant";

export type ScannedAsset = { id: string; name: string; brand: string | null; bmdCode: string; regNo: number; status: string; condition: "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT"; room: string | null; roomId: string | null };

/** Token QR → aset milik sekolah pengguna (null bila bukan milik sekolah ini) */
export async function lookupQr(token: string): Promise<ScannedAsset | null> {
  if (!/^[0-9a-f]{24}$/.test(token)) return null;
  const s = await requireSchoolUser();
  const [t] = await db.select().from(qrTokens).where(eq(qrTokens.token, token));
  if (!t || t.schoolId !== s.schoolId || t.kind !== "ASET") return null;
  const [a] = await withSchool(s.schoolId, (tx) =>
    tx.select({ id: assets.id, name: assets.name, brand: assets.brand, bmdCode: assets.bmdCode, regNo: assets.regNo, status: assets.status, condition: assets.condition, room: rooms.name, roomId: assets.roomId })
      .from(assets).leftJoin(rooms, eq(rooms.id, assets.roomId)).where(eq(assets.id, t.refId)));
  return a ?? null;
}
