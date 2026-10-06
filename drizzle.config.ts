import { defineConfig } from "drizzle-kit";

// Migrasi dijalankan sebagai pemilik tabel (inventaris_owner); aplikasi memakai inventaris_app (terkena RLS).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_OWNER!,
  },
  strict: true,
  verbose: true,
});
