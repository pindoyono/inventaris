import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL belum di-set (lihat .env.local)");
}

// Satu pool per proses; dipakai ulang saat hot-reload di development
const globalForDb = globalThis as unknown as { queryClient?: ReturnType<typeof postgres> };
const queryClient = globalForDb.queryClient ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.queryClient = queryClient;

/**
 * Koneksi sebagai `inventaris_app` (terkena RLS). Query ke tabel sekolah TANPA `withSchool`
 * tidak akan melihat baris apa pun — gunakan helper di `@/lib/tenant`.
 */
export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
