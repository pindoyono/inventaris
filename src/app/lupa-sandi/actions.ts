"use server";

import { after } from "next/server";
import { z } from "zod";
import { processOutbox } from "@/lib/server/inbox";
import { requestPasswordReset, resetPassword } from "@/lib/server/password-reset";
import { clientIp, rateLimit } from "@/lib/server/request";
import { npsnSchema, passwordSchema } from "@/lib/validations";

export type ResetState = { ok?: string; error?: string; npsn?: string; username?: string };

export async function requestResetAction(_p: ResetState, fd: FormData): Promise<ResetState> {
  const npsn = String(fd.get("npsn") ?? "").trim();
  const username = String(fd.get("username") ?? "").trim();
  const ip = (await clientIp()) ?? "?";
  if (!rateLimit(`reset:${ip}`, 10, 15 * 60 * 1000)) return { npsn, username, error: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." };
  if (!npsnSchema.safeParse(npsn).success || !username) return { npsn, username, error: "Isi NPSN (8 digit) dan username." };
  await requestPasswordReset(npsn, username, ip);
  after(() => processOutbox().catch((e) => console.error("outbox", e)));
  return { ok: "Bila NPSN & username cocok dan akun memiliki alamat email, tautan atur ulang telah dikirim (berlaku 30 menit). Periksa juga folder spam. Akun tanpa email: minta Admin sekolah mengatur ulang kata sandi." };
}

export async function resetAction(token: string, _p: ResetState, fd: FormData): Promise<ResetState> {
  const p = z.object({ password: passwordSchema, confirm: z.string() }).refine((d) => d.password === d.confirm, { message: "Konfirmasi kata sandi tidak sama", path: ["confirm"] }).safeParse({ password: fd.get("password"), confirm: fd.get("confirm") });
  if (!p.success) return { error: p.error.issues[0].message };
  if (!rateLimit(`resetpw:${(await clientIp()) ?? "?"}`, 20, 15 * 60 * 1000)) return { error: "Terlalu banyak percobaan." };
  return (await resetPassword(token, p.data.password)) ? { ok: "Kata sandi diganti. Silakan masuk dengan kata sandi baru." } : { error: "Tautan tidak berlaku (kedaluwarsa atau sudah dipakai). Minta tautan baru." };
}
