import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, ilike, inArray, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bmdCodes, localBmdCodes } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import sinonimPersediaan from "../../../data/bmd/sinonim-persediaan.json";
import sinonimAset from "../../../data/bmd/sinonim-aset.json";

export type CodeHit = { code: string; name: string; parent: string };

/** Kode saran dari nama sehari-hari ("spidol" → Alat Tulis, "infocus" → LCD Projector) */
function synonymCodes(term: string, dict: Record<string, string[]>) {
  const t = term.toLowerCase();
  if (t.length < 2) return [];
  const hits = Object.entries(dict).filter(([k]) => t === k || (t.length >= 3 && (t.includes(k) || k.startsWith(t))));
  return [...new Set(hits.flatMap(([, codes]) => codes))].map((code) => ({ code, word: hits.find(([, c]) => c.includes(code))![0] }));
}

/**
 * Cari kode barang tingkat 7 (resmi + lokal sekolah). Nama dicocokkan juga tanpa spasi
 * ("laptop" → "Lap Top") dan lewat kamus sinonim.
 */
export async function searchCodes(schoolId: string, q: string, kind: "persediaan" | "aset"): Promise<CodeHit[]> {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const isCode = /^[\d.]+$/.test(term);
  const esc = (v: string) => v.replace(/[%_\\]/g, "\\$&");
  const nospace = esc(term.replace(/\s+/g, ""));
  const parent = alias(bmdCodes, "parent");
  const classCond = kind === "persediaan" ? eq(bmdCodes.class, "PERSEDIAAN") : and(ne(bmdCodes.class, "PERSEDIAAN"), sql`${bmdCodes.class} is not null`);
  const cols = { code: bmdCodes.code, name: bmdCodes.name, parent: sql<string>`coalesce(${parent.name}, '')` };

  const official = await db
    .select(cols)
    .from(bmdCodes)
    .leftJoin(parent, eq(parent.code, bmdCodes.parentCode))
    .where(
      and(
        classCond,
        eq(bmdCodes.selectable, true),
        eq(bmdCodes.level, 7),
        isCode
          ? like(bmdCodes.code, `${term}%`)
          : or(
              ilike(bmdCodes.name, `%${esc(term)}%`),
              ilike(sql`replace(${bmdCodes.name}, ' ', '')`, `%${nospace}%`),
              kind === "persediaan" ? ilike(parent.name, `%${esc(term)}%`) : undefined,
            ),
      ),
    )
    .orderBy(sql`position(lower(${term.replace(/\s+/g, "")}) in lower(replace(${bmdCodes.name}, ' ', '')))`, asc(bmdCodes.code))
    .limit(40);

  const prefix = kind === "persediaan" ? "1.1.7.%" : "1.%";
  const local = await withSchool(schoolId, (tx) =>
    tx
      .select({ code: localBmdCodes.code, name: localBmdCodes.name })
      .from(localBmdCodes)
      .where(and(like(localBmdCodes.code, prefix), isCode ? like(localBmdCodes.code, `${term}%`) : ilike(localBmdCodes.name, `%${esc(term)}%`))),
  );
  const localHits = local.filter((l) => (kind === "persediaan") === l.code.startsWith("1.1.7.")).map((l) => ({ ...l, parent: "Kode lokal" }));

  const dict = (kind === "persediaan" ? sinonimPersediaan : sinonimAset).sinonim as Record<string, string[]>;
  const syn = isCode ? [] : synonymCodes(term, dict);
  const synRows = syn.length
    ? await db.select(cols).from(bmdCodes).leftJoin(parent, eq(parent.code, bmdCodes.parentCode)).where(inArray(bmdCodes.code, syn.map((x) => x.code)))
    : [];
  const suggested = syn
    .map((x) => {
      const r = synRows.find((y) => y.code === x.code);
      return r ? { ...r, parent: `Saran untuk “${x.word}” · ${r.parent}` } : null;
    })
    .filter((r): r is CodeHit => !!r);
  const seen = new Set(suggested.map((r) => r.code));
  return [...suggested, ...localHits, ...official.filter((o) => !seen.has(o.code))];
}
