import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { kirSnapshots, rooms } from "@/db/schema";
import { kirData } from "@/lib/server/reports";
import { reportPeriod } from "@/lib/assets-shared";
import { toDec } from "@/lib/decimal";
import type { SchoolSession } from "@/lib/tenant";

/** Label semester berjalan, mis. "2026-2" */
export const semesterOf = (iso: string) => `${iso.slice(0, 4)}-${Number(iso.slice(5, 7)) <= 6 ? 1 : 2}`;

export type KirState = { roomId: string; room: string; pic: string | null; last: { at: Date; period: string } | null; reasons: string[] };

/**
 * Status KIR per ruangan (Permendagri 47/2021 Lampiran §K): perlu diperbarui bila belum ada KIR tercetak
 * semester ini, ada perpindahan/penambahan/perubahan barang sesudah KIR terakhir, atau penanggung jawab berganti.
 */
export async function kirStatus(tx: Tx, today: string): Promise<KirState[]> {
  const sem = semesterOf(today);
  const list = await tx.select().from(rooms).orderBy(asc(rooms.name));
  const out: KirState[] = [];
  for (const r of list) {
    const [last] = await tx.select().from(kirSnapshots).where(eq(kirSnapshots.roomId, r.id)).orderBy(desc(kirSnapshots.createdAt)).limit(1);
    const reasons: string[] = [];
    if (!last) reasons.push("belum pernah dicetak");
    else {
      if (last.period !== sem) reasons.push("semester baru");
      const [ch] = await tx.execute(sql`
        select count(*)::int n from asset_events e
        where e.created_at > ${last.createdAt.toISOString()}::timestamptz
          and (e.from_room_id = ${r.id} or e.to_room_id = ${r.id}
               or (e.kind in ('KONDISI','STATUS') and exists (select 1 from assets a where a.id = e.asset_id and a.room_id = ${r.id})))`) as unknown as { n: number }[];
      if (ch.n > 0) reasons.push(`${ch.n} perubahan barang`);
      if ((last.picName ?? "") !== (r.picName ?? "")) reasons.push("penanggung jawab berganti");
    }
    out.push({ roomId: r.id, room: r.name, pic: r.picName, last: last ? { at: last.createdAt, period: last.period } : null, reasons });
  }
  return out;
}

/** Arsipkan KIR yang dicetak & ditempel (posisi per hari ini / akhir semester) */
export async function saveKirSnapshot(tx: Tx, s: SchoolSession, roomId: string, today: string) {
  const sem = semesterOf(today);
  const per = reportPeriod(Number(sem.slice(0, 4)), sem.slice(5));
  const asOf = per.to < today ? per.to : today;
  const k = await kirData(tx, roomId, asOf);
  if (!k) throw new Error("Ruangan tidak ditemukan");
  const [row] = await tx
    .insert(kirSnapshots)
    .values({
      schoolId: s.schoolId, roomId, period: sem, asOf, picName: k.room.picName, units: k.units, total: toDec(k.total),
      rows: k.rows.map((r) => ({ ...r, total: r.total.toString() })), createdBy: s.userId,
    })
    .returning({ id: kirSnapshots.id });
  return row.id;
}
