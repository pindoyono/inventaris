import { sql } from "drizzle-orm";
import { db, type Tx } from "@/db";

/**
 * Jalankan `fn` dalam transaksi dengan konteks RLS sekolah `schoolId`.
 * `set_config(..., true)` berlaku lokal untuk transaksi ini saja, sehingga aman dipakai bersama pool koneksi.
 * (Dipisah dari `tenant.ts` agar bisa dipakai `auth.ts` tanpa impor melingkar.)
 */
export async function withSchool<T>(schoolId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.school_id', ${schoolId}, true)`);
    return fn(tx);
  });
}
