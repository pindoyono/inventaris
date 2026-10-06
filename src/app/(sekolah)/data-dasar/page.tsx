import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { ENTITIES, type EntitySlug } from "./config";
import { TABLES } from "./tables";

export const metadata: Metadata = { title: "Data Dasar" };

export default async function DataDasarPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const counts = await withSchool(s.schoolId, async (tx) => {
    const out: Record<string, number> = {};
    for (const [slug, t] of Object.entries(TABLES)) out[slug] = (await tx.select({ n: count() }).from(t))[0].n;
    return out;
  });
  return (
    <div>
      <PageTitle title="Data dasar" desc="Struktur sekolah dan referensi yang dipakai saat mencatat barang." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(ENTITIES) as EntitySlug[]).map((slug) => (
          <Link key={slug} href={`/data-dasar/${slug}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{ENTITIES[slug].title}</span>
              <span className="text-sm text-slate-500">{counts[slug]}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{ENTITIES[slug].desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
