import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, passwordResets, schools, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { url } from "@/lib/server/mail";

const TTL_MIN = 30;
const MAX_PER_HOUR = 3;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Minta tautan atur ulang kata sandi. Jawaban ke pengguna selalu sama (tidak membocorkan apakah akun/email ada).
 * Email masuk antrean (email_outbox) dan dikirim proses latar belakang.
 */
export async function requestPasswordReset(npsn: string, username: string, ip: string | null) {
  const [school] = await db.select({ id: schools.id, name: schools.name, status: schools.status }).from(schools).where(eq(schools.npsn, npsn));
  if (!school || school.status !== "ACTIVE") return;
  await withSchool(school.id, async (tx) => {
    const [u] = await tx.select().from(users).where(and(eq(users.username, username.trim()), eq(users.isActive, true)));
    if (!u?.email) return;
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(passwordResets)
      .where(and(eq(passwordResets.userId, u.id), gt(passwordResets.createdAt, sql`now() - interval '1 hour'`)));
    if (n >= MAX_PER_HOUR) return;
    const token = randomBytes(32).toString("base64url");
    await tx.insert(passwordResets).values({ schoolId: school.id, userId: u.id, tokenHash: hash(token), expiresAt: sql`now() + make_interval(mins => ${TTL_MIN})` as unknown as Date, ip });
    await tx.insert(emailOutbox).values({
      schoolId: school.id,
      to: u.email,
      subject: "Atur ulang kata sandi Inventaris",
      body: [
        `Halo ${u.name},`,
        "",
        `Ada permintaan mengatur ulang kata sandi akun "${u.username}" di ${school.name}.`,
        `Buka tautan berikut dalam ${TTL_MIN} menit (hanya bisa dipakai sekali):`,
        url(`/lupa-sandi/${token}`),
        "",
        "Abaikan email ini bila Anda tidak memintanya; kata sandi tidak berubah.",
      ].join("\n"),
    });
  });
}

/** Cek token (untuk menampilkan form); null bila tidak sah/kedaluwarsa/terpakai */
export async function checkResetToken(token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const [r] = await db
    .select({ id: passwordResets.id, schoolId: passwordResets.schoolId, userId: passwordResets.userId })
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hash(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, sql`now()`)));
  return r ?? null;
}

/** Pakai token: ganti kata sandi, buka kunci akun, batalkan token lain milik pengguna yang sama */
export async function resetPassword(token: string, password: string) {
  const r = await checkResetToken(token);
  if (!r) return false;
  const passwordHash = await bcrypt.hash(password, 12);
  return db.transaction(async (tx) => {
    // klaim token secara atomik (sekali pakai walau diklik bersamaan)
    const claimed = await tx.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.id, r.id), isNull(passwordResets.usedAt))).returning({ id: passwordResets.id });
    if (!claimed.length) return false;
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, r.userId), isNull(passwordResets.usedAt)));
    await tx.execute(sql`select set_config('app.school_id', ${r.schoolId}, true)`);
    await tx.update(users).set({ passwordHash, failedLogins: 0, lockedUntil: null, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, r.userId));
    return true;
  });
}
