import "server-only";
import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { emailOutbox, notifications, userRoles, users } from "@/db/schema";
import { sendMailStrict, url } from "@/lib/server/mail";
import { emit } from "@/lib/server/realtime";
import type { Role } from "@/lib/roles";

export type Msg = { title: string; body?: string; link?: string };

/** Id pengguna aktif dengan salah satu peran (dalam konteks sekolah) */
export async function userIdsWithRoles(tx: Tx, roles: Role[]) {
  const rows = await tx
    .selectDistinct({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(eq(users.isActive, true), inArray(userRoles.role, roles)));
  return rows.map((r) => r.id);
}

/**
 * Notifikasi di aplikasi + antrean email (bila pengguna punya email). Dalam transaksi kejadian,
 * jadi tidak ada notifikasi untuk transaksi yang batal. `exceptUserId` = pelaku (tidak perlu diberi tahu).
 */
export async function notifyUsers(tx: Tx, schoolId: string, userIds: string[], msg: Msg, exceptUserId?: string) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exceptUserId);
  if (!ids.length) return 0;
  await tx.insert(notifications).values(ids.map((userId) => ({ schoolId, userId, title: msg.title, body: msg.body ?? null, link: msg.link ?? null })));
  await emit(tx, { s: schoolId, k: "notif", u: ids });
  const withEmail = await tx
    .select({ email: users.email })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.isActive, true), isNotNull(users.email)));
  if (withEmail.length)
    await tx.insert(emailOutbox).values(
      withEmail.map((u) => ({
        schoolId,
        to: u.email!,
        subject: msg.title,
        body: [msg.body ?? "", msg.link ? `\nBuka: ${url(msg.link)}` : ""].join("").trim(),
      })),
    );
  return ids.length;
}

/** Kirim email yang tertunda. Aman dipanggil bersamaan (SKIP LOCKED); gagal dicoba ulang bertahap. */
export async function processOutbox(limit = 20) {
  let sent = 0;
  for (let i = 0; i < limit; i++) {
    const done = await db.transaction(async (tx) => {
      const [m] = await tx
        .select()
        .from(emailOutbox)
        .where(and(sql`${emailOutbox.sentAt} is null`, lte(emailOutbox.nextTryAt, new Date()), sql`${emailOutbox.attempts} < 6`))
        .orderBy(emailOutbox.id)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!m) return null;
      try {
        await sendMailStrict(m.to, m.subject, m.body.split("\n"));
        await tx.update(emailOutbox).set({ sentAt: new Date(), attempts: m.attempts + 1, lastError: null }).where(eq(emailOutbox.id, m.id));
        return true;
      } catch (e) {
        const wait = 5 * 2 ** m.attempts; // 5, 10, 20, 40, 80 menit
        await tx
          .update(emailOutbox)
          .set({ attempts: m.attempts + 1, lastError: String(e instanceof Error ? e.message : e).slice(0, 500), nextTryAt: new Date(Date.now() + wait * 60_000) })
          .where(eq(emailOutbox.id, m.id));
        return false;
      }
    });
    if (done === null) break;
    if (done) sent++;
  }
  return sent;
}
