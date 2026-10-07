"use server";

import { cookies } from "next/headers";
import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { LOGIN_MESSAGES, loginErrorMessage, safeNext } from "@/lib/server/login";
import { clientIp, rateLimit } from "@/lib/server/request";

export type LoginState = { error?: string; npsn?: string; username?: string; otp?: boolean; next?: string };

const CH = "inv_otp_ch";

/** Simpan tantangan langkah kedua di cookie httpOnly (5 menit); kata sandi tidak disimpan */
async function holdChallenge(e: unknown) {
  if (!(e instanceof CredentialsSignin) || !e.code.startsWith("otp_required.")) return false;
  (await cookies()).set(CH, e.code.slice("otp_required.".length), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 300 });
  return true;
}

async function login(kind: "school" | "platform", fd: FormData, fields: Record<string, string>, redirectTo: string): Promise<LoginState> {
  const otp = String(fd.get("otp") ?? "").trim();
  const jar = await cookies();
  const challenge = jar.get(CH)?.value;
  const base = { npsn: fields.npsn, username: fields.username, next: String(fd.get("next") ?? "") };
  if (otp) {
    if (!challenge) return { ...base, error: "Waktu verifikasi habis. Masuk ulang dengan kata sandi." };
    jar.delete(CH);
    try {
      await signIn(kind, { challenge, otp, redirectTo });
    } catch (e) {
      if (e instanceof CredentialsSignin && e.code === "otp_invalid") {
        jar.set(CH, challenge, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 300 });
        return { ...base, otp: true, error: LOGIN_MESSAGES.otp_invalid };
      }
      return { ...base, error: loginErrorMessage(e) };
    }
    return {};
  }
  try {
    await signIn(kind, { ...fields, password: String(fd.get("password") ?? ""), redirectTo });
  } catch (e) {
    if (await holdChallenge(e)) return { ...base, otp: true };
    return { ...base, error: loginErrorMessage(e) };
  }
  return {};
}

export async function schoolLoginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const npsn = String(fd.get("npsn") ?? "");
  const username = String(fd.get("username") ?? "");
  if (!rateLimit(`login:${(await clientIp()) ?? "?"}`, 30, 15 * 60 * 1000)) return { npsn, username, error: LOGIN_MESSAGES.rate };
  return login("school", fd, { npsn, username }, safeNext(fd.get("next"), "/dasbor"));
}

export async function platformLoginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const username = String(fd.get("username") ?? "");
  if (!rateLimit(`plogin:${(await clientIp()) ?? "?"}`, 10, 15 * 60 * 1000)) return { username, error: LOGIN_MESSAGES.rate };
  return login("platform", fd, { username }, "/platform");
}
