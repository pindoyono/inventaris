import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { platformAdmins, schools, userRoles, users } from "@/db/schema";
import { authConfig } from "@/auth.config";
import { npsnSchema } from "@/lib/validations";
import { withSchool } from "@/lib/tenant-core";
import { decryptSecret, matchRecoveryCode, readChallenge, signChallenge, verifyTotp } from "@/lib/server/totp";

const MAX_GAGAL = 5;
const KUNCI_MENIT = 15;

/** Kode error yang aman ditampilkan (lihat LOGIN_MESSAGES di halaman login) */
class LoginError extends CredentialsSignin {
  /** `otp_required.<tantangan>` membawa token tantangan langkah kedua (lihat app/login/actions.ts) */
  constructor(code: "invalid" | "locked" | "school_pending" | "school_rejected" | "school_suspended" | "otp_invalid" | `otp_required.${string}`) {
    super();
    this.code = code;
  }
}

type TwoFactorRow = { totpSecret: string | null; totpEnabledAt: Date | null; totpLastStep: number | null; recoveryCodes: string[] | null };

/** Periksa kode TOTP atau kode pemulihan; kembalikan perubahan kolom bila sah, null bila salah */
async function secondFactor(row: TwoFactorRow, otp: string) {
  if (!row.totpSecret) return null;
  const step = verifyTotp(decryptSecret(row.totpSecret), otp, row.totpLastStep);
  if (step !== null) return { totpLastStep: step };
  const i = await matchRecoveryCode(row.recoveryCodes, otp);
  if (i >= 0) return { recoveryCodes: row.recoveryCodes!.filter((_, j) => j !== i) };
  return null;
}

const lockUntil = () => sql`now() + make_interval(mins => ${KUNCI_MENIT})`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // Login gagal adalah kejadian normal, bukan error server
    error(e) {
      // (subkelas LoginError punya name sendiri; kode bisa memuat token tantangan 2FA — jangan dicatat)
      if (!(e instanceof CredentialsSignin)) console.error(e);
    },
  },
  providers: [
    Credentials({
      id: "school",
      credentials: { npsn: {}, username: {}, password: {}, otp: {}, challenge: {} },
      async authorize(raw) {
        const otp = typeof raw?.otp === "string" ? raw.otp.trim() : "";
        // Langkah kedua: tantangan bertanda tangan + kode TOTP/pemulihan
        const ch = typeof raw?.challenge === "string" ? readChallenge(raw.challenge) : null;
        if (typeof raw?.challenge === "string" && raw.challenge) {
          if (!ch || ch.k !== "school" || !ch.s || !otp) throw new LoginError("invalid");
        }
        let school;
        if (ch) [school] = await db.select().from(schools).where(eq(schools.id, ch.s!));
        else {
          const npsn = npsnSchema.safeParse(raw?.npsn);
          if (!npsn.success) throw new LoginError("invalid");
          [school] = await db.select().from(schools).where(eq(schools.npsn, npsn.data));
        }
        if (!school) throw new LoginError("invalid");
        const username = typeof raw?.username === "string" ? raw.username.trim() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!ch && (!username || !password)) throw new LoginError("invalid");

        return withSchool(school.id, async (tx) => {
          const [user] = await tx
            .select()
            .from(users)
            .where(and(ch ? eq(users.id, ch.u) : eq(users.username, username), eq(users.isActive, true)));
          if (!user) throw new LoginError("invalid");
          if (user.lockedUntil && user.lockedUntil > new Date()) throw new LoginError("locked");
          const fail = async (code: "invalid" | "otp_invalid") => {
            const gagal = user.failedLogins + 1;
            await tx
              .update(users)
              .set(gagal >= MAX_GAGAL ? { failedLogins: 0, lockedUntil: lockUntil() } : { failedLogins: gagal })
              .where(eq(users.id, user.id));
            throw new LoginError(gagal >= MAX_GAGAL ? "locked" : code);
          };

          if (!ch && !(await bcrypt.compare(password, user.passwordHash))) await fail("invalid");

          // Status sekolah baru diungkap setelah password benar
          if (school.status !== "ACTIVE") {
            throw new LoginError(
              school.status === "PENDING" ? "school_pending" : school.status === "REJECTED" ? "school_rejected" : "school_suspended",
            );
          }

          let twoFactorPatch = {};
          if (user.totpEnabledAt) {
            if (!otp) throw new LoginError(`otp_required.${signChallenge({ k: "school", u: user.id, s: school.id })}`);
            const ok = await secondFactor(user, otp);
            if (!ok) await fail("otp_invalid");
            twoFactorPatch = ok!;
          }

          await tx
            .update(users)
            .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(), ...twoFactorPatch })
            .where(eq(users.id, user.id));
          const roles = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));

          return {
            id: user.id,
            name: user.name,
            kind: "school" as const,
            schoolId: school.id,
            npsn: school.npsn,
            roles: roles.map((r) => r.role),
          };
        });
      },
    }),
    Credentials({
      id: "platform",
      credentials: { username: {}, password: {}, otp: {}, challenge: {} },
      async authorize(raw) {
        const otp = typeof raw?.otp === "string" ? raw.otp.trim() : "";
        const ch = typeof raw?.challenge === "string" ? readChallenge(raw.challenge) : null;
        if (typeof raw?.challenge === "string" && raw.challenge && (!ch || ch.k !== "platform" || !otp)) throw new LoginError("invalid");
        const username = typeof raw?.username === "string" ? raw.username.trim() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!ch && (!username || !password)) throw new LoginError("invalid");

        const [admin] = await db.select().from(platformAdmins).where(ch ? eq(platformAdmins.id, ch.u) : eq(platformAdmins.username, username));
        if (!admin) throw new LoginError("invalid");
        if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new LoginError("locked");
        const fail = async (code: "invalid" | "otp_invalid") => {
          const gagal = admin.failedLogins + 1;
          await db
            .update(platformAdmins)
            .set(gagal >= MAX_GAGAL ? { failedLogins: 0, lockedUntil: lockUntil() } : { failedLogins: gagal })
            .where(eq(platformAdmins.id, admin.id));
          throw new LoginError(gagal >= MAX_GAGAL ? "locked" : code);
        };

        if (!ch && !(await bcrypt.compare(password, admin.passwordHash))) await fail("invalid");

        let twoFactorPatch = {};
        if (admin.totpEnabledAt) {
          if (!otp) throw new LoginError(`otp_required.${signChallenge({ k: "platform", u: admin.id })}`);
          const ok = await secondFactor(admin, otp);
          if (!ok) await fail("otp_invalid");
          twoFactorPatch = ok!;
        }

        await db.update(platformAdmins).set({ failedLogins: 0, lockedUntil: null, ...twoFactorPatch }).where(eq(platformAdmins.id, admin.id));
        return { id: admin.id, name: admin.name, kind: "platform" as const, roles: [] };
      },
    }),
  ],
});
