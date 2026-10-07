"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAdmins, platformLogs, users } from "@/db/schema";
import { requirePlatformAdmin, requireSchoolUser, withSchool, AccessError } from "@/lib/tenant";
import { logActivity } from "@/lib/server/activity";
import { clientIp } from "@/lib/server/request";
import { decryptSecret, encryptSecret, hashRecoveryCodes, matchRecoveryCode, newRecoveryCodes, newSecret, otpauthUri, verifyTotp } from "@/lib/server/totp";

/** Aksi pengaktifan/penonaktifan verifikasi dua langkah, untuk pengguna sekolah ("school") dan pengelola platform ("platform") */

export type TwoFaState = { error?: string; ok?: string; qr?: string; secret?: string; codes?: string[] };
type Row = { id: string; name: string; label: string; passwordHash: string; totpSecret: string | null; totpEnabledAt: Date | null; totpLastStep: number | null; recoveryCodes: string[] | null };
type Patch = Partial<{ totpSecret: string | null; totpEnabledAt: Date | null; totpLastStep: number | null; recoveryCodes: string[] | null }>;

/** Jalankan fn dengan baris akun yang sedang masuk dan fungsi simpan + catat log */
async function withAccount<T>(kind: "school" | "platform", fn: (r: Row, save: (p: Patch, action: string) => Promise<void>) => Promise<T>): Promise<T> {
  if (kind === "platform") {
    const a = await requirePlatformAdmin();
    const [r] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, a.adminId));
    return fn({ ...r, label: `pengelola:${r.username}` }, async (p, action) => {
      await db.update(platformAdmins).set({ ...p, updatedAt: new Date() }).where(eq(platformAdmins.id, r.id));
      await db.insert(platformLogs).values({ adminId: r.id, action, detail: null, ip: await clientIp() });
    });
  }
  const s = await requireSchoolUser([]);
  return withSchool(s.schoolId, async (tx) => {
    const [r] = await tx.select().from(users).where(eq(users.id, s.userId));
    return fn({ ...r, label: `${s.npsn}:${r.username}` }, async (p, action) => {
      await tx.update(users).set({ ...p, updatedAt: new Date() }).where(eq(users.id, r.id));
      await logActivity(tx, s, action, "user", s.userId);
    });
  });
}

const guard = async <T,>(fn: () => Promise<T>): Promise<T | TwoFaState> => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessError) return { error: "Sesi berakhir. Silakan masuk lagi." };
    throw e;
  }
};

/** Langkah 1: buat rahasia baru (belum aktif) + QR untuk dipindai aplikasi autentikator */
export async function begin2fa(kind: "school" | "platform"): Promise<TwoFaState> {
  return guard(() =>
    withAccount(kind, async (r, save) => {
      if (r.totpEnabledAt) return { error: "Verifikasi dua langkah sudah aktif." };
      const secret = newSecret();
      await save({ totpSecret: encryptSecret(secret), totpLastStep: null }, "2FA_MULAI");
      const qr = await QRCode.toString(otpauthUri(r.label, secret), { type: "svg", margin: 1, width: 200 });
      return { qr, secret: secret.replace(/(.{4})/g, "$1 ").trim() };
    }),
  ) as Promise<TwoFaState>;
}

/** Langkah 2: konfirmasi kode pertama → aktif + kode pemulihan (ditampilkan sekali) */
export async function confirm2fa(kind: "school" | "platform", fd: FormData): Promise<TwoFaState> {
  const code = String(fd.get("code") ?? "");
  return guard(() =>
    withAccount(kind, async (r, save) => {
      if (r.totpEnabledAt || !r.totpSecret) return { error: "Mulai pengaktifan terlebih dahulu." };
      const step = verifyTotp(decryptSecret(r.totpSecret), code, null);
      if (step === null) return { error: "Kode salah. Pastikan jam di HP akurat, lalu masukkan kode terbaru." };
      const codes = newRecoveryCodes();
      await save({ totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: await hashRecoveryCodes(codes) }, "2FA_AKTIF");
      return { ok: "Verifikasi dua langkah aktif.", codes };
    }),
  ) as Promise<TwoFaState>;
}

async function checkBoth(r: Row, password: string, code: string) {
  if (!(await bcrypt.compare(password, r.passwordHash))) return "Kata sandi salah.";
  if (!r.totpSecret) return "Verifikasi dua langkah belum aktif.";
  if (verifyTotp(decryptSecret(r.totpSecret), code, r.totpLastStep) === null && (await matchRecoveryCode(r.recoveryCodes, code)) < 0) return "Kode verifikasi salah.";
  return null;
}

/** Kata sandi & kode dikirim sebagai FormData agar tidak tercatat sebagai argumen aksi di log */
const creds = (fd: FormData) => [String(fd.get("password") ?? ""), String(fd.get("code") ?? "")] as const;

export async function disable2fa(kind: "school" | "platform", fd: FormData): Promise<TwoFaState> {
  const [password, code] = creds(fd);
  return guard(() =>
    withAccount(kind, async (r, save) => {
      const err = await checkBoth(r, password, code);
      if (err) return { error: err };
      await save({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null }, "2FA_NONAKTIF");
      return { ok: "Verifikasi dua langkah dinonaktifkan." };
    }),
  ) as Promise<TwoFaState>;
}

export async function regenerateRecovery(kind: "school" | "platform", fd: FormData): Promise<TwoFaState> {
  const [password, code] = creds(fd);
  return guard(() =>
    withAccount(kind, async (r, save) => {
      const err = await checkBoth(r, password, code);
      if (err) return { error: err };
      const codes = newRecoveryCodes();
      await save({ recoveryCodes: await hashRecoveryCodes(codes) }, "2FA_KODE_PEMULIHAN");
      return { ok: "Kode pemulihan baru dibuat; kode lama tidak berlaku.", codes };
    }),
  ) as Promise<TwoFaState>;
}
