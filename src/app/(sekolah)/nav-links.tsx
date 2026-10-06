"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`border-b-2 px-3 py-2 text-sm whitespace-nowrap ${active ? "border-teal-700 font-medium text-teal-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
