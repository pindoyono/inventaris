import Link from "next/link";
import { pagePlatformAdmin } from "@/lib/server/guard";
import { platformSignOut } from "./actions";

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const admin = await pagePlatformAdmin();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/platform" className="font-semibold">Inventaris · Pengelola Platform</Link>
          <form action={platformSignOut} className="flex items-center gap-3 text-sm text-slate-600">
            <Link href="/platform/statistik" className="hover:underline">Statistik</Link>
            <Link href="/platform/2fa" className="hover:underline" title="Verifikasi dua langkah">{admin.adminName}</Link>
            <button className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">Keluar</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
