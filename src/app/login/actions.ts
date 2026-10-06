"use server";

import { signIn } from "@/auth";
import { LOGIN_MESSAGES, loginErrorMessage, safeNext } from "@/lib/server/login";
import { clientIp, rateLimit } from "@/lib/server/request";

export type LoginState = { error?: string; npsn?: string; username?: string };

export async function schoolLoginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const npsn = String(fd.get("npsn") ?? "");
  const username = String(fd.get("username") ?? "");
  if (!rateLimit(`login:${(await clientIp()) ?? "?"}`, 30, 15 * 60 * 1000)) return { npsn, username, error: LOGIN_MESSAGES.rate };
  try {
    await signIn("school", { npsn, username, password: String(fd.get("password") ?? ""), redirectTo: safeNext(fd.get("next"), "/dasbor") });
  } catch (e) {
    return { npsn, username, error: loginErrorMessage(e) };
  }
  return {};
}

export async function platformLoginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const username = String(fd.get("username") ?? "");
  if (!rateLimit(`plogin:${(await clientIp()) ?? "?"}`, 10, 15 * 60 * 1000)) return { username, error: LOGIN_MESSAGES.rate };
  try {
    await signIn("platform", { username, password: String(fd.get("password") ?? ""), redirectTo: "/platform" });
  } catch (e) {
    return { username, error: loginErrorMessage(e) };
  }
  return {};
}
