import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { platformAdmins, schools, userRoles, users } from "@/db/schema";
import { authConfig } from "@/auth.config";
import { npsnSchema } from "@/lib/validations";
import { withSchool } from "@/lib/tenant-core";

const MAX_GAGAL = 5;
const KUNCI_MENIT = 15;

/** Kode error yang aman ditampilkan (lihat LOGIN_MESSAGES di halaman login) */
class LoginError extends CredentialsSignin {
  constructor(code: "invalid" | "locked" | "school_pending" | "school_rejected" | "school_suspended") {
    super();
    this.code = code;
  }
}

const lockUntil = () => sql`now() + make_interval(mins => ${KUNCI_MENIT})`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // Login gagal adalah kejadian normal, bukan error server
    error(e) {
      if (e.name !== "CredentialsSignin") console.error(e);
    },
  },
  providers: [
    Credentials({
      id: "school",
      credentials: { npsn: {}, username: {}, password: {} },
      async authorize(raw) {
        const npsn = npsnSchema.safeParse(raw?.npsn);
        const username = typeof raw?.username === "string" ? raw.username.trim() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!npsn.success || !username || !password) throw new LoginError("invalid");

        const [school] = await db.select().from(schools).where(eq(schools.npsn, npsn.data));
        if (!school) throw new LoginError("invalid");

        return withSchool(school.id, async (tx) => {
          const [user] = await tx
            .select()
            .from(users)
            .where(and(eq(users.username, username), eq(users.isActive, true)));
          if (!user) throw new LoginError("invalid");
          if (user.lockedUntil && user.lockedUntil > new Date()) throw new LoginError("locked");

          if (!(await bcrypt.compare(password, user.passwordHash))) {
            const gagal = user.failedLogins + 1;
            await tx
              .update(users)
              .set(gagal >= MAX_GAGAL ? { failedLogins: 0, lockedUntil: lockUntil() } : { failedLogins: gagal })
              .where(eq(users.id, user.id));
            throw new LoginError(gagal >= MAX_GAGAL ? "locked" : "invalid");
          }

          // Status sekolah baru diungkap setelah password benar
          if (school.status !== "ACTIVE") {
            throw new LoginError(
              school.status === "PENDING" ? "school_pending" : school.status === "REJECTED" ? "school_rejected" : "school_suspended",
            );
          }

          await tx
            .update(users)
            .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
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
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const username = typeof raw?.username === "string" ? raw.username.trim() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!username || !password) throw new LoginError("invalid");

        const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.username, username));
        if (!admin) throw new LoginError("invalid");
        if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new LoginError("locked");

        if (!(await bcrypt.compare(password, admin.passwordHash))) {
          const gagal = admin.failedLogins + 1;
          await db
            .update(platformAdmins)
            .set(gagal >= MAX_GAGAL ? { failedLogins: 0, lockedUntil: lockUntil() } : { failedLogins: gagal })
            .where(eq(platformAdmins.id, admin.id));
          throw new LoginError(gagal >= MAX_GAGAL ? "locked" : "invalid");
        }

        await db.update(platformAdmins).set({ failedLogins: 0, lockedUntil: null }).where(eq(platformAdmins.id, admin.id));
        return { id: admin.id, name: admin.name, kind: "platform" as const, roles: [] };
      },
    }),
  ],
});
