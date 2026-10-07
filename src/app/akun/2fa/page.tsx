import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { TwoFactorPanel } from "@/components/two-factor-panel";

export const metadata: Metadata = { title: "Verifikasi dua langkah" };

export default async function TwoFaPage() {
  const s = await pageSchoolUser();
  const [u] = await withSchool(s.schoolId, (tx) => tx.select({ on: users.totpEnabledAt, codes: users.recoveryCodes }).from(users).where(eq(users.id, s.userId)));
  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-12">
      <div>
        <Link href="/dasbor" className="text-sm text-teal-700 hover:underline">← Dasbor</Link>
        <h1 className="mt-2 text-2xl font-semibold">Verifikasi dua langkah</h1>
        <p className="mt-1 text-sm text-slate-600">{s.userName} · sangat dianjurkan untuk Admin, Kepala Sekolah, dan Petugas Barang.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs"><TwoFactorPanel kind="school" enabled={!!u.on} recoveryLeft={u.codes?.length ?? 0} /></div>
      <p className="text-sm"><Link href="/akun/password" className="text-teal-700 hover:underline">Ganti kata sandi</Link></p>
    </main>
  );
}
