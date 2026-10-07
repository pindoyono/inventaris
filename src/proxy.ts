import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC = [/^\/$/, /^\/panduan(\/|$)/, /^\/lupa-sandi(\/[A-Za-z0-9_-]+)?$/, /^\/(sw\.js|manifest\.webmanifest|offline\.html)$/, /^\/keluar$/, /^\/q\/[0-9a-f]{24}$/, /^\/daftar(\/|$)/, /^\/login$/, /^\/platform\/login$/, /^\/api\/auth\//];

/**
 * Pemeriksaan awal (optimistik) dari JWT saja. Otorisasi sebenarnya tetap di server
 * (requireSchoolUser/requirePlatformAdmin) karena status sekolah & peran bisa berubah.
 */
/**
 * Content-Security-Policy dengan nonce per permintaan: hanya skrip bertanda nonce (dan yang dimuatnya,
 * 'strict-dynamic') yang boleh berjalan. Next.js membaca nonce dari header CSP permintaan dan memasangnya
 * pada skripnya sendiri; karena itu semua halaman dirender dinamis (lihat app/layout.tsx).
 */
function securityHeaders() {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  return { nonce, csp };
}

const PERMISSIONS = "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";

/** Berkas unggahan disajikan dengan CSP "sandbox" sendiri — jangan ditimpa */
const OWN_CSP = /^\/berkas\//;

function withHeaders(req: NextRequest, redirect?: URL) {
  if (redirect) return NextResponse.redirect(redirect);
  if (OWN_CSP.test(req.nextUrl.pathname)) return NextResponse.next();
  const { nonce, csp } = securityHeaders();
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Permissions-Policy", PERMISSIONS);
  return res;
}

/**
 * Pemeriksaan awal (optimistik) dari JWT saja. Otorisasi sebenarnya tetap di server
 * (requireSchoolUser/requirePlatformAdmin) karena status sekolah & peran bisa berubah.
 */
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return withHeaders(req);

  const kind = req.auth?.user?.kind;
  const isPlatform = pathname === "/platform" || pathname.startsWith("/platform/");
  const need = isPlatform ? "platform" : "school";
  if (kind === need) return withHeaders(req);

  const url = req.nextUrl.clone();
  url.pathname = isPlatform ? "/platform/login" : "/login";
  url.search = kind ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return withHeaders(req, url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
