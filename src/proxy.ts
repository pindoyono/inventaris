import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC = [/^\/$/, /^\/keluar$/, /^\/daftar(\/|$)/, /^\/login$/, /^\/platform\/login$/, /^\/api\/auth\//];

/**
 * Pemeriksaan awal (optimistik) dari JWT saja. Otorisasi sebenarnya tetap di server
 * (requireSchoolUser/requirePlatformAdmin) karena status sekolah & peran bisa berubah.
 */
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const kind = req.auth?.user?.kind;
  const isPlatform = pathname === "/platform" || pathname.startsWith("/platform/");
  const need = isPlatform ? "platform" : "school";
  if (kind === need) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = isPlatform ? "/platform/login" : "/login";
  url.search = kind ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
