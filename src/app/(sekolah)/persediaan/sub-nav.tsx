"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/persediaan", label: "Barang", match: (p: string) => p === "/persediaan" || p.startsWith("/persediaan/barang") },
  { href: "/persediaan/dokumen", label: "Dokumen stok", match: (p: string) => p.startsWith("/persediaan/dokumen") },
];

export function SubNav() {
  const p = usePathname();
  return (
    <div className="flex gap-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-full px-3 py-1 text-sm ${t.match(p) ? "bg-slate-800 text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
