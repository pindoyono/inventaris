import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { ENTITIES, isEntitySlug, type FieldDef, type RefKey } from "../config";
import { loadRefs, TABLES } from "../tables";
import { EntityManager } from "./entity-manager";

export async function generateMetadata({ params }: PageProps<"/data-dasar/[jenis]">): Promise<Metadata> {
  const { jenis } = await params;
  return { title: isEntitySlug(jenis) ? ENTITIES[jenis].title : "Data Dasar" };
}

export default async function EntityPage({ params, searchParams }: PageProps<"/data-dasar/[jenis]">) {
  const { jenis } = await params;
  if (!isEntitySlug(jenis)) notFound();
  const { ubah } = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const def = ENTITIES[jenis];
  const fields: FieldDef[] = def.fields;
  const refKeys = fields.flatMap((f) => (f.ref ? [f.ref] : [])) as RefKey[];

  const { rows, refs, editing } = await withSchool(s.schoolId, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabel dipilih dinamis dari config
    const t = TABLES[jenis] as any;
    const rows = (await tx.select().from(t).orderBy(asc(t.name)).limit(1000)) as Record<string, unknown>[];
    const editing =
      typeof ubah === "string" && /^[0-9a-f-]{36}$/.test(ubah) ? ((await tx.select().from(t).where(eq(t.id, ubah)))[0] ?? null) : null;
    return { rows, refs: await loadRefs(tx, refKeys), editing: editing as Record<string, unknown> | null };
  });

  // Hanya kirim kolom yang dipakai ke klien
  const pick = (r: Record<string, unknown>) =>
    Object.fromEntries([["id", r.id], ...fields.map((f) => [f.name, r[f.name] ?? null])]) as Record<string, string | boolean | null>;

  return (
    <div>
      <PageTitle title={def.title} desc={def.desc} back={{ href: "/data-dasar", label: "Data dasar" }} />
      <EntityManager slug={jenis} def={{ ...def, fields }} rows={rows.map(pick)} refs={refs} editing={editing ? pick(editing) : null} />
    </div>
  );
}
