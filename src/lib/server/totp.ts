import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/** Verifikasi dua langkah: TOTP RFC 6238 (SHA-1, 6 digit, 30 detik) — cocok dengan Google Authenticator, Authy, dll. */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32Encode(randomBytes(20));

export function totpAt(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const n = (h.readUInt32BE(off) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, "0");
}
export const currentStep = (now = Date.now()) => Math.floor(now / 30_000);

/** Kode cocok (toleransi ±1 langkah) dan lebih baru dari langkah terakhir yang dipakai → kembalikan langkahnya */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const cur = currentStep(now);
  for (const st of [cur - 1, cur, cur + 1]) {
    if (lastStep !== null && st <= lastStep) continue;
    const exp = totpAt(secret, st);
    if (timingSafeEqual(Buffer.from(exp), Buffer.from(c))) return st;
  }
  return null;
}

export const otpauthUri = (account: string, secret: string, issuer = "Inventaris BMD") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// ───────── enkripsi rahasia di database

const key = (purpose: string) => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET belum di-set");
  return createHash("sha256").update(`${purpose}:${s}`).digest();
};
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key("totp"), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${ct.toString("base64url")}`;
}
export function decryptSecret(enc: string) {
  const [v, iv, tag, ct] = enc.split(".");
  if (v !== "v1") throw new Error("format rahasia tidak dikenal");
  const d = createDecipheriv("aes-256-gcm", key("totp"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

// ───────── kode pemulihan

export function newRecoveryCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const h = randomBytes(5).toString("hex");
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
}
export const hashRecoveryCodes = (codes: string[]) => Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
/** Indeks kode pemulihan yang cocok, atau -1 */
export async function matchRecoveryCode(hashes: string[] | null, code: string) {
  const c = code.trim().toLowerCase();
  if (!hashes?.length || !/^[0-9a-f]{5}-[0-9a-f]{5}$/.test(c)) return -1;
  for (let i = 0; i < hashes.length; i++) if (await bcrypt.compare(c, hashes[i])) return i;
  return -1;
}

// ───────── tantangan login langkah kedua (tanpa menyimpan kata sandi)

export type Challenge = { k: "school" | "platform"; u: string; s?: string; exp: number };
export function signChallenge(c: Omit<Challenge, "exp">, ttlMs = 5 * 60_000) {
  const payload = Buffer.from(JSON.stringify({ ...c, exp: Date.now() + ttlMs })).toString("base64url");
  return `${payload}.${createHmac("sha256", key("otp-challenge")).update(payload).digest("base64url")}`;
}
export function readChallenge(token: string | undefined | null): Challenge | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const exp = createHmac("sha256", key("otp-challenge")).update(payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, "base64url").toString()) as Challenge;
    return c.exp > Date.now() ? c : null;
  } catch {
    return null;
  }
}
