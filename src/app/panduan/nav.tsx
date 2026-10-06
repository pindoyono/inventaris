"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavEntry = { href: string; label: string };

/** Daftar isi panduan: kolom samping di layar lebar, menu lipat di HP */
export function PanduanNav({ items }: { items: NavEntry[] }) {
  const path = usePathname();
  const list = (
    <ul className="space-y-0.5 text-sm">
      {items.map((i) => {
        const active = path === i.href;
        return (
          <li key={i.href}>
            <Link href={i.href} aria-current={active ? "page" : undefined}
              className={`block rounded-md px-3 py-1.5 ${active ? "bg-teal-50 font-medium text-teal-800" : "text-slate-700 hover:bg-slate-100"}`}>{i.label}</Link>
          </li>
        );
      })}
    </ul>
  );
  const current = items.find((i) => i.href === path)?.label ?? "Daftar isi";
  return (
    <>
      <details className="rounded-lg border border-slate-200 bg-white lg:hidden">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium">☰ {current}</summary>
        <div className="px-2 pb-2">{list}</div>
      </details>
      <nav aria-label="Daftar isi panduan" className="sticky top-4 hidden lg:block">{list}</nav>
    </>
  );
}
