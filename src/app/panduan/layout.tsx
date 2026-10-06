import Link from "next/link";
import type { Metadata } from "next";
import { TOPICS } from "./topics";
import { PanduanNav } from "./nav";

export const metadata: Metadata = { title: { template: "%s · Panduan Inventaris", default: "Panduan Inventaris" } };

export default function PanduanLayout({ children }: LayoutProps<"/panduan">) {
  const items = [
    { href: "/panduan", label: "Beranda panduan" },
    { href: "/panduan/alur", label: "Flowchart alur (interaktif)" },
    ...TOPICS.map((t) => ({ href: `/panduan/${t.slug}`, label: t.title })),
  ];
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/panduan" className="font-semibold">Inventaris <span className="font-normal text-slate-500">· Panduan pengguna</span></Link>
          <Link href="/dasbor" className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">Buka aplikasi →</Link>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="print:hidden"><PanduanNav items={items} /></aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
