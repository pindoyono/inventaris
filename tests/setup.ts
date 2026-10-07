import { mock } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// Tes selalu memakai database *_test (bukan dev/produksi). Variabel lingkungan (CI) didahulukan, lalu .env.local.
const file = existsSync(new URL("../.env.local", import.meta.url))
  ? Object.fromEntries(
      readFileSync(new URL("../.env.local", import.meta.url), "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2")]),
    )
  : {};
const env = { TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? file.TEST_DATABASE_URL, TEST_DATABASE_URL_OWNER: process.env.TEST_DATABASE_URL_OWNER ?? file.TEST_DATABASE_URL_OWNER };
if (!env.TEST_DATABASE_URL || !env.TEST_DATABASE_URL_OWNER) throw new Error("TEST_DATABASE_URL(_OWNER) belum di-set (variabel lingkungan atau .env.local)");
process.env.DATABASE_URL = env.TEST_DATABASE_URL;
process.env.TEST_DATABASE_URL_OWNER = env.TEST_DATABASE_URL_OWNER;
process.env.FILES_DIR = "/tmp/inventaris-test-files";
process.env.AUTH_SECRET ??= "rahasia-khusus-tes-bukan-produksi-0000000000";

// Modul Next yang hanya berlaku di server React
mock.module("server-only", () => ({}));
mock.module("next/headers", () => ({ headers: async () => new Headers() }));
