import "server-only";
import type { Tx } from "@/db";
import { AccessError, requireSchoolUser, withSchool, type SchoolSession } from "@/lib/tenant";
import type { Role } from "@/lib/roles";
import type { FieldErrors } from "@/lib/validations";
import { pgCode } from "@/lib/server/activity";
import { UserError } from "@/lib/server/errors";

export type FormState = { errors?: FieldErrors; ok?: string; values?: Record<string, string> };

const ACCESS_MESSAGE = {
  UNAUTHENTICATED: "Sesi berakhir. Silakan masuk lagi.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  SCHOOL_INACTIVE: "Akun sekolah tidak aktif.",
} as const;

/**
 * Jalankan server action sekolah: cek peran, buka transaksi RLS, dan ubah error umum jadi pesan form.
 * `fn` boleh melempar FormFail untuk membatalkan transaksi dengan pesan tertentu.
 */
export async function runSchoolAction(
  roles: Role[],
  fn: (tx: Tx, s: SchoolSession) => Promise<FormState>,
  messages: { unique?: string; inUse?: string } = {},
): Promise<FormState> {
  let s: SchoolSession;
  try {
    s = await requireSchoolUser(roles);
  } catch (e) {
    if (e instanceof AccessError) return { errors: { _form: ACCESS_MESSAGE[e.reason] } };
    throw e;
  }
  try {
    return await withSchool(s.schoolId, (tx) => fn(tx, s));
  } catch (e) {
    if (e instanceof FormFail) return { errors: e.errors };
    if (e instanceof UserError) return { errors: { _form: e.message } };
    const code = pgCode(e);
    if (code === "23505") return { errors: { _form: messages.unique ?? "Data dengan nama/kode yang sama sudah ada." } };
    if (code === "23503") return { errors: { _form: messages.inUse ?? "Data masih dipakai oleh data lain sehingga tidak bisa dihapus." } };
    console.error(e);
    return { errors: { _form: "Terjadi kesalahan server. Silakan coba lagi." } };
  }
}

export class FormFail extends Error {
  constructor(public readonly errors: FieldErrors) {
    super("form");
  }
}
