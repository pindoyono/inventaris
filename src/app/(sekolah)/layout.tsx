import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole, ROLE_LABEL, type Role } from "@/lib/roles";
import { signOut } from "@/auth";
import { NavLinks, type NavItem } from "./nav-links";

const NAV: (NavItem & { roles?: Role[] })[] = [
  { href: "/dasbor", label: "Dasbor" },
  { href: "/permintaan", label: "Permintaan", roles: ["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"] },
  { href: "/aset", label: "Aset" },
  { href: "/persediaan", label: "Persediaan", roles: ["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"] },
  { href: "/kode-barang", label: "Kode Barang" },
  { href: "/pengaturan", label: "Penyiapan", roles: ["ADMIN"] },
  { href: "/data-dasar", label: "Data Dasar", roles: ["ADMIN", "PETUGAS"] },
  { href: "/pengguna", label: "Pengguna", roles: ["ADMIN"] },
  { href: "/log", label: "Log Aktivitas", roles: ["ADMIN", "KEPSEK"] },
];

export default async function SchoolLayout({ children }: LayoutProps<"/">) {
  const s = await pageSchoolUser();
  const [school] = await db
    .select({ shortName: schools.shortName, setupCompletedAt: schools.setupCompletedAt })
    .from(schools)
    .where(eq(schools.id, s.schoolId));
  const items = NAV.filter((n) => !n.roles || hasAnyRole(s.roles, n.roles)).map(({ href, label }) => ({ href, label }));

  async function keluar() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dasbor" className="font-semibold">
            Inventaris <span className="font-normal text-slate-500">· {school?.shortName}</span>
          </Link>
          <form action={keluar} className="flex items-center gap-3 text-sm text-slate-600">
            <Link href="/akun/password" title={s.roles.map((r) => ROLE_LABEL[r as Role] ?? r).join(", ")} className="hover:underline">{s.userName}</Link>
            <button className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">Keluar</button>
          </form>
        </div>
        <NavLinks items={items} />
      </header>
      {!school?.setupCompletedAt && hasAnyRole(s.roles, ["ADMIN"]) && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Penyiapan sekolah belum selesai. <Link href="/pengaturan" className="font-medium underline">Lanjutkan penyiapan</Link>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
