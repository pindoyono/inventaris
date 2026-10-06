import "server-only";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { Tx } from "@/db";

export const CHANNEL = "inventaris_peristiwa";
export type LiveEvent = { s: string; k: "notif" | "data"; u?: string[] };
type Client = { schoolId: string; userId: string; send: (e: LiveEvent) => void };

/** Kirim sinyal (diteruskan saat transaksi COMMIT; batal bila rollback) */
export async function emit(tx: Tx, e: LiveEvent) {
  await tx.execute(sql`select pg_notify(${CHANNEL}, ${JSON.stringify(e)})`);
}

// Satu koneksi LISTEN per proses, disebar ke klien SSE yang terhubung
type Live = { clients: Map<number, Client>; seq: number; ready?: Promise<void> };
const g = globalThis as unknown as { __live?: Live };
const live: Live = (g.__live ??= { clients: new Map<number, Client>(), seq: 0 });

function ensureListener() {
  live.ready ??= (async () => {
    const conn = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 0 });
    await conn.listen(CHANNEL, (payload) => {
      let e: LiveEvent;
      try { e = JSON.parse(payload); } catch { return; }
      for (const c of live.clients.values()) {
        if (c.schoolId !== e.s) continue;
        if (e.k === "notif" && e.u && !e.u.includes(c.userId)) continue;
        try { c.send(e); } catch { /* klien sudah putus */ }
      }
    });
  })().catch((err) => { live.ready = undefined; throw err; });
  return live.ready;
}

export async function subscribe(c: Client) {
  await ensureListener();
  const id = ++live.seq;
  live.clients.set(id, c);
  return () => live.clients.delete(id);
}
