/**
 * Membuat atau mereset akun pengelola platform.
 *   PLATFORM_USERNAME=pengelola PLATFORM_PASSWORD='...' bun scripts/platform-admin.ts
 */
import postgres from "postgres";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL_OWNER;
const username = process.env.PLATFORM_USERNAME;
const password = process.env.PLATFORM_PASSWORD;
const name = process.env.PLATFORM_NAME ?? "Pengelola Platform";

if (!url) throw new Error("DATABASE_URL_OWNER belum di-set");
if (!username || !password || password.length < 12) {
  console.error("Set PLATFORM_USERNAME dan PLATFORM_PASSWORD (minimal 12 karakter).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const hash = await bcrypt.hash(password, 12);
await sql`
  insert into platform_admins (username, name, password_hash)
  values (${username}, ${name}, ${hash})
  on conflict (username) do update set password_hash = excluded.password_hash, name = excluded.name,
    failed_logins = 0, locked_until = null, updated_at = now()`;
console.log(`Pengelola platform "${username}" siap.`);
await sql.end();
