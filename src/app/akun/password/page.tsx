import type { Metadata } from "next";
import Link from "next/link";
import { pageSchoolUser } from "@/lib/server/guard";
import { Alert } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Ganti Password" };

export default async function GantiPasswordPage() {
  const s = await pageSchoolUser([], { allowMustChange: true });
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        {!s.mustChangePassword && <Link href="/dasbor" className="text-sm text-teal-700 hover:underline">← Dasbor</Link>}
        <h1 className="mt-2 text-2xl font-semibold">Ganti password</h1>
        <p className="mt-1 text-sm text-slate-600">{s.userName}</p>
      </div>
      {s.mustChangePassword && <Alert tone="warning">Password Anda dibuat atau direset oleh admin. Ganti dulu sebelum melanjutkan.</Alert>}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
        <PasswordForm />
      </div>
      {!s.mustChangePassword && <p className="text-sm"><Link href="/akun/2fa" className="text-teal-700 hover:underline">Verifikasi dua langkah (2FA) →</Link></p>}
    </main>
  );
}
