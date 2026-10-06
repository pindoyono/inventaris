import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, pesan } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <Link href="/" className="text-sm text-teal-700 hover:underline">← Inventaris</Link>
        <h1 className="mt-2 text-2xl font-semibold">Masuk</h1>
        <p className="mt-1 text-sm text-slate-600">Gunakan NPSN sekolah, username, dan password Anda.</p>
      </div>
      {pesan === "nonaktif" && <Alert tone="warning">Akun sekolah sedang tidak aktif. Hubungi pengelola platform.</Alert>}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
        <LoginForm kind="school" next={typeof next === "string" ? next : undefined} />
      </div>
      <p className="text-center text-sm text-slate-600">
        Sekolah belum terdaftar? <Link href="/daftar" className="font-medium text-teal-700 hover:underline">Daftarkan sekolah</Link>
        <span className="mx-2 text-slate-300">·</span>
        <Link href="/panduan" className="font-medium text-teal-700 hover:underline">Panduan pengguna</Link>
      </p>
    </main>
  );
}
