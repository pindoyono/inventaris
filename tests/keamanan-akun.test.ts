import { beforeAll, describe, expect, test } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, schools, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { base32Encode, decryptSecret, encryptSecret, hashRecoveryCodes, matchRecoveryCode, newRecoveryCodes, readChallenge, signChallenge, totpAt, verifyTotp } from "@/lib/server/totp";
import { checkResetToken, requestPasswordReset, resetPassword } from "@/lib/server/password-reset";
import { makeSchool, owner, resetTestData } from "./helpers";

describe("TOTP (RFC 6238)", () => {
  // Vektor uji RFC 6238 lampiran B: kunci ASCII "12345678901234567890", T=59 s → 94287082 (8 digit) → 287082
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  test("vektor uji resmi", () => {
    expect(totpAt(secret, 1)).toBe("287082");
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe("081804");
  });
  test("toleransi ±1 langkah; kode yang sama tidak bisa dipakai ulang", () => {
    const now = 59_000;
    expect(verifyTotp(secret, "287082", null, now)).toBe(1);
    expect(verifyTotp(secret, "287 082", null, now + 30_000)).toBe(1); // satu langkah sesudahnya masih diterima
    expect(verifyTotp(secret, "287082", 1, now)).toBeNull(); // sudah dipakai
    expect(verifyTotp(secret, "000000", null, now)).toBeNull();
    expect(verifyTotp(secret, "28708", null, now)).toBeNull();
  });
  test("rahasia terenkripsi, tantangan bertanda tangan & berbatas waktu, kode pemulihan sekali pakai", async () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(enc).not.toContain("JBSWY3DP");
    expect(decryptSecret(enc)).toBe("JBSWY3DPEHPK3PXP");
    const t = signChallenge({ k: "school", u: "u1", s: "s1" });
    expect(readChallenge(t)?.u).toBe("u1");
    expect(readChallenge(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
    const [p] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ k: "school", u: "admin-lain", s: "s1", exp: Date.now() + 1e6 })).toString("base64url");
    expect(readChallenge(`${forged}.${t.split(".")[1]}`)).toBeNull();
    expect(p.length).toBeGreaterThan(10);
    expect(readChallenge(signChallenge({ k: "platform", u: "x" }, -1))).toBeNull();
    const codes = newRecoveryCodes(3);
    const hashes = await hashRecoveryCodes(codes);
    expect(await matchRecoveryCode(hashes, codes[1].toUpperCase())).toBe(1);
    expect(await matchRecoveryCode(hashes, "00000-00000")).toBe(-1);
  });
});

describe("lupa kata sandi", () => {
  let S: string, npsn: string, uid: string;
  beforeAll(async () => {
    await resetTestData();
    const m = await makeSchool();
    S = m.schoolId;
    npsn = m.input.npsn;
    await owner`update schools set status = 'ACTIVE'`;
    [{ id: uid }] = await withSchool(S, (t) => t.update(users).set({ email: "admin@sekolah.test", failedLogins: 3 }).returning({ id: users.id }));
  });

  test("tautan sekali pakai, akun tanpa email/salah username tidak membocorkan apa pun", async () => {
    await requestPasswordReset(npsn, "tidakada", null);
    await requestPasswordReset("00000000", "admin", null);
    expect((await db.select().from(emailOutbox)).length).toBe(0);
    await requestPasswordReset(npsn, "admin", "1.2.3.4");
    const [mail] = await db.select().from(emailOutbox).where(eq(emailOutbox.to, "admin@sekolah.test"));
    const token = /lupa-sandi\/([A-Za-z0-9_-]+)/.exec(mail.body)![1];
    expect(await checkResetToken(token)).not.toBeNull();
    expect(await resetPassword(token, "kataSandiBaru123")).toBe(true);
    expect(await resetPassword(token, "lagi12345")).toBe(false);
    const [u] = await withSchool(S, (t) => t.select().from(users).where(eq(users.id, uid)));
    expect(await bcrypt.compare("kataSandiBaru123", u.passwordHash)).toBe(true);
    expect(u.failedLogins).toBe(0);
  });

  test("maksimal 3 permintaan per jam; sekolah nonaktif diabaikan", async () => {
    await requestPasswordReset(npsn, "admin", null);
    await requestPasswordReset(npsn, "admin", null);
    await requestPasswordReset(npsn, "admin", null);
    expect((await db.select().from(emailOutbox)).length).toBe(3); // 1 sebelumnya + 2 (batas 3/jam)
    await db.update(schools).set({ status: "SUSPENDED" }).where(eq(schools.id, S));
    await requestPasswordReset(npsn, "admin", null);
    expect((await db.select().from(emailOutbox)).length).toBe(3);
  });
});
