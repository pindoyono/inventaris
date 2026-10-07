import Link from "next/link";

const TABS = [
  { href: "/aset", label: "Daftar aset" },
  { href: "/aset/kdp", label: "KDP & renovasi" },
  { href: "/aset/pemanfaatan", label: "Pemanfaatan" },
  { href: "/aset/pengalihan", label: "Pengalihan" },
] as const;

/** Sub-menu Aset */
export function AsetTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 ${t.href === active ? "border-teal-700 font-medium text-teal-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}
