import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAdmins } from "@/db/schema";
import { pagePlatformAdmin } from "@/lib/server/guard";
import { TwoFactorPanel } from "@/components/two-factor-panel";

export const metadata: Metadata = { title: "Verifikasi dua langkah · Pengelola" };

export default async function PlatformTwoFaPage() {
  const a = await pagePlatformAdmin();
  const [r] = await db.select({ on: platformAdmins.totpEnabledAt, codes: platformAdmins.recoveryCodes }).from(platformAdmins).where(eq(platformAdmins.id, a.adminId));
  return (
    <div className="max-w-lg space-y-4">
      <Link href="/platform" className="text-sm text-teal-700 hover:underline">← Panel</Link>
      <h1 className="text-2xl font-semibold">Verifikasi dua langkah</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6"><TwoFactorPanel kind="platform" enabled={!!r.on} recoveryLeft={r.codes?.length ?? 0} /></div>
    </div>
  );
}
