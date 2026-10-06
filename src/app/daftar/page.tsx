import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { regions } from "@/db/schema";
import { ScopeNotice } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Daftarkan Sekolah" };
export const dynamic = "force-dynamic";

export default async function DaftarPage() {
  const all = await db.select().from(regions).orderBy(asc(regions.code));
  const provinces = all.filter((r) => r.level === 1).map(({ code, name }) => ({ code, name }));
  const regencies = all.filter((r) => r.level === 2).map(({ code, name }) => ({ code, name }));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-teal-700 hover:underline">← Inventaris</Link>
        <h1 className="mt-2 text-2xl font-semibold">Daftarkan sekolah</h1>
        <p className="mt-1 text-sm text-slate-600">
          Satu NPSN untuk satu akun sekolah. Pendaftaran diperiksa pengelola platform sebelum sekolah bisa masuk.
        </p>
      </div>
      <ScopeNotice />
      <RegisterForm provinces={provinces} regencies={regencies} />
    </main>
  );
}
