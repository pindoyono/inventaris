import postgres from "postgres";
import { registerSchool } from "@/lib/server/provision";
import type { RegistrationInput } from "@/lib/validations";

/** Koneksi pemilik tabel (untuk cek katalog & bersih-bersih) */
export const owner = postgres(process.env.TEST_DATABASE_URL_OWNER!, { max: 2, idle_timeout: 2, onnotice: () => {} });

let seq = 0;
export function npsn() {
  return "9" + String(Date.now() % 10_000_000).padStart(6, "0").slice(-6) + (seq++ % 10);
}

export async function makeSchool(over: Partial<RegistrationInput> = {}) {
  const input: RegistrationInput = {
    npsn: npsn(),
    name: "SMA Negeri Tes",
    shortName: "SMAN Tes",
    level: "SMA",
    provinceCode: "65",
    regencyCode: "65.02",
    address: null,
    contactName: "PJ Tes",
    contactPhone: "081200000000",
    contactEmail: null,
    adminName: "Admin Tes",
    adminUsername: "admin",
    adminPassword: "rahasia123",
    adminPasswordConfirm: "rahasia123",
    declaration: "on",
    ...over,
  };
  const { schoolId } = await registerSchool(input);
  return { schoolId, input };
}

/** Kosongkan data sekolah di database tes (TRUNCATE tidak terkena RLS). Hanya untuk database *_test. */
export async function resetTestData() {
  const [{ db }] = await owner`select current_database() as db`;
  if (!String(db).endsWith("_test")) throw new Error(`Menolak reset: ${db} bukan database tes`);
  await owner`truncate schools, platform_logs, platform_admins restart identity cascade`;
}
