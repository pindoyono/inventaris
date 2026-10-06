import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bmdCodes, favoriteBmdCodes, localBmdCodes } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { PageTitle } from "@/components/ui";
import { FavoriteToggle, LocalCodeForm } from "./widgets";

export const metadata: Metadata = { title: "Kode Barang" };

const GOLONGAN: Record<string, string> = {
  PERSEDIAAN: "Persediaan",
  A: "KIB A Tanah",
  B: "KIB B Peralatan & Mesin",
  C: "KIB C Gedung & Bangunan",
  D: "KIB D Jalan, Irigasi, Jaringan",
  E: "KIB E Aset Tetap Lainnya",
  F: "KIB F KDP",
  ATB: "Aset Tak Berwujud",
};

type Item = { code: string; name: string; level: number; class: string | null; selectable: boolean; local?: boolean; decreeRef?: string | null };

export default async function KodeBarangPage({ searchParams }: PageProps<"/kode-barang">) {
  const s = await pageSchoolUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const induk = typeof sp.induk === "string" && /^[\d.]{1,32}$/.test(sp.induk) ? sp.induk : "";
  const gol = typeof sp.gol === "string" && sp.gol in GOLONGAN ? sp.gol : "";
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);

  const { favorites, locals } = await withSchool(s.schoolId, async (tx) => ({
    favorites: new Set((await tx.select({ code: favoriteBmdCodes.code }).from(favoriteBmdCodes)).map((f) => f.code)),
    locals: await tx.select().from(localBmdCodes).orderBy(asc(localBmdCodes.code)),
  }));
  const localItems: Item[] = locals.map((l) => ({ code: l.code, name: l.name, level: 7, class: null, selectable: true, local: true, decreeRef: l.decreeRef }));

  let title: string;
  let items: Item[];
  let breadcrumbs: { code: string; name: string }[] = [];
  if (q || gol) {
    const conds: SQL[] = [];
    if (q) {
      if (/^[\d.]+$/.test(q)) conds.push(like(bmdCodes.code, `${q}%`));
      else {
        // Abaikan spasi juga: "laptop" menemukan "Lap Top", "notebook" menemukan "Note Book"
        const esc = (v: string) => v.replace(/[%_\\]/g, "\\$&");
        conds.push(or(ilike(bmdCodes.name, `%${esc(q)}%`), ilike(sql`replace(${bmdCodes.name}, ' ', '')`, `%${esc(q.replace(/\s+/g, ""))}%`))!);
      }
    }
    if (gol) conds.push(eq(bmdCodes.class, gol));
    conds.push(eq(bmdCodes.selectable, true));
    // Nama yang diawali kata kunci tampil lebih dulu (mis. "laptop" → "Lap Top"/"Laptop" sebelum "Tas Laptop")
    const rank = q && !/^[\d.]+$/.test(q) ? sql`position(lower(${q.replace(/\s+/g, "")}) in lower(replace(${bmdCodes.name}, ' ', '')))` : sql`0`;
    items = await db.select().from(bmdCodes).where(and(...conds)).orderBy(rank, asc(bmdCodes.code)).limit(200);
    if (q) items = [...localItems.filter((l) => l.code.startsWith(q) || l.name.toLowerCase().includes(q.toLowerCase())), ...items];
    title = `Hasil pencarian (${items.length}${items.length >= 200 ? "+" : ""})`;
  } else if (induk) {
    items = await db.select().from(bmdCodes).where(eq(bmdCodes.parentCode, induk)).orderBy(asc(bmdCodes.code));
    items = [...items, ...localItems.filter((l) => l.code.startsWith(induk + ".") && l.code.split(".").length === induk.split(".").length + 1)];
    const parts = induk.split(".");
    const chain = parts.map((_, i) => parts.slice(0, i + 1).join("."));
    breadcrumbs = await db.select({ code: bmdCodes.code, name: bmdCodes.name }).from(bmdCodes).where(inArray(bmdCodes.code, chain)).orderBy(asc(bmdCodes.level));
    title = breadcrumbs.at(-1)?.name ?? induk;
  } else {
    const favCodes = [...favorites];
    items = favCodes.length
      ? await db.select().from(bmdCodes).where(inArray(bmdCodes.code, favCodes)).orderBy(asc(bmdCodes.code))
      : [];
    items = [...items, ...localItems.filter((l) => favorites.has(l.code))];
    title = "Favorit sekolah";
  }
  const roots = !q && !gol && !induk ? await db.select().from(bmdCodes).where(eq(bmdCodes.level, 3)).orderBy(asc(bmdCodes.code)) : [];
  const parentForLocal = induk.split(".").length === 6 ? induk : "";

  return (
    <div>
      <PageTitle title="Kode barang" desc="Kodefikasi Barang Milik Daerah, Permendagri 108/2016 (7 tingkat). Tandai bintang untuk kode yang sering dipakai." />
      <form className="mb-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Cari nama atau awalan kode, mis. laptop / 1.3.2.10" className="min-w-64 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
        <select name="gol" defaultValue={gol} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Semua golongan</option>
          {Object.entries(GOLONGAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Cari</button>
        {(q || gol || induk) && <Link href="/kode-barang" className="px-2 py-2 text-sm text-slate-600 hover:underline">Reset</Link>}
      </form>

      {breadcrumbs.length > 0 && (
        <nav className="mb-3 flex flex-wrap gap-1 text-sm text-slate-600">
          <Link href="/kode-barang" className="hover:underline">Favorit</Link>
          {breadcrumbs.map((b) => (
            <span key={b.code}>/ <Link href={`?induk=${b.code}`} className="hover:underline">{b.name}</Link></span>
          ))}
        </nav>
      )}

      <h2 className="mb-2 font-semibold">{title}</h2>
      <CodeList items={items} favorites={favorites} canEdit={canEdit} />

      {parentForLocal && canEdit && (
        <div className="mt-6 max-w-xl">
          <LocalCodeForm parentCode={parentForLocal} />
        </div>
      )}

      {roots.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-semibold">Jelajahi menurut kelompok</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roots.map((r) => (
              <Link key={r.code} href={`?induk=${r.code}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-teal-600">
                <span className="font-mono text-xs text-slate-500">{r.code}</span> {r.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CodeList({ items, favorites, canEdit }: { items: Item[]; favorites: Set<string>; canEdit: boolean }) {
  if (!items.length) return <p className="text-sm text-slate-500">Tidak ada kode.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {items.map((i) => (
        <li key={i.code} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="w-40 shrink-0 font-mono text-xs text-slate-500">{i.code}</span>
          <span className="flex-1">
            {i.level < 7 && !i.selectable ? (
              <Link href={`?induk=${i.code}`} className="text-teal-800 hover:underline">{i.name} ›</Link>
            ) : (
              i.name
            )}
            {i.local && <span className="ml-2 rounded bg-indigo-100 px-1.5 text-xs text-indigo-800">lokal{i.decreeRef ? ` · ${i.decreeRef}` : ""}</span>}
            {i.class && i.selectable && <span className="ml-2 text-xs text-slate-500">{GOLONGAN[i.class] ?? i.class}</span>}
          </span>
          {i.selectable && canEdit && <FavoriteToggle code={i.code} on={favorites.has(i.code)} />}
          {i.selectable && !canEdit && favorites.has(i.code) && <span className="text-amber-500">★</span>}
        </li>
      ))}
    </ul>
  );
}
