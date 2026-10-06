import "server-only";
import { AuthError, CredentialsSignin } from "next-auth";

export const LOGIN_MESSAGES: Record<string, string> = {
  invalid: "NPSN, username, atau password salah.",
  locked: "Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.",
  school_pending: "Pendaftaran sekolah masih menunggu persetujuan pengelola platform.",
  school_rejected: "Pendaftaran sekolah ditolak. Hubungi pengelola platform untuk informasi lebih lanjut.",
  school_suspended: "Akun sekolah sedang dinonaktifkan. Hubungi pengelola platform.",
  rate: "Terlalu banyak percobaan masuk dari jaringan ini. Coba lagi beberapa menit lagi.",
  server: "Terjadi kesalahan server. Silakan coba lagi.",
};

/** Hanya izinkan tujuan internal (cegah open redirect) */
export function safeNext(next: unknown, fallback: string) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

/** Ubah error Auth.js jadi pesan; error lain (termasuk redirect sukses) dilempar ulang */
export function loginErrorMessage(e: unknown) {
  if (e instanceof CredentialsSignin) return LOGIN_MESSAGES[e.code] ?? LOGIN_MESSAGES.invalid;
  if (e instanceof AuthError) return LOGIN_MESSAGES.server;
  throw e;
}
