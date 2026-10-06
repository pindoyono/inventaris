import type { NextAuthConfig } from "next-auth";

/** Konfigurasi tanpa akses database — dipakai juga oleh proxy. Provider ada di `src/auth.ts`. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id!;
        token.kind = user.kind;
        token.schoolId = user.schoolId;
        token.npsn = user.npsn;
        token.roles = user.roles ?? [];
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid;
      session.user.kind = token.kind;
      session.user.schoolId = token.schoolId;
      session.user.npsn = token.npsn;
      session.user.roles = token.roles ?? [];
      return session;
    },
  },
} satisfies NextAuthConfig;
