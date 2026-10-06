"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { warehouses } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { fieldErrors, formToObject } from "@/lib/validations";
import { ENTITIES, isEntitySlug, type FieldDef } from "./config";
import { TABLES } from "./tables";

const ROLES = ["ADMIN", "PETUGAS"] as const;

function fieldSchema(f: FieldDef) {
  if (f.type === "checkbox") return z.literal("on").optional().transform(Boolean);
  if (f.type === "select")
    return f.required
      ? z.uuid(`Pilih ${f.label.toLowerCase()}`)
      : z.union([z.literal("").transform(() => null), z.uuid()]).optional().transform((v) => v ?? null);
  let s = z.string().trim().max(f.max ?? 200, `Maksimal ${f.max} karakter`);
  if (f.pattern) s = s.regex(new RegExp(f.pattern.re), f.pattern.message);
  if (f.required) return s.min(1, `${f.label} wajib diisi`);
  return s.optional().transform((v) => (v ? v : null));
}

export async function saveEntity(slug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!isEntitySlug(slug)) return { errors: { _form: "Jenis data tidak dikenal" } };
  const def = ENTITIES[slug];
  const raw = formToObject(fd);
  const id = raw.id || null;
  const schema = z.object(Object.fromEntries(def.fields.map((f) => [f.name, fieldSchema(f)])));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { values: raw, errors: fieldErrors(parsed.error) };
  const data = parsed.data as Record<string, unknown>;

  const result = await runSchoolAction(
    [...ROLES],
    async (tx, s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabel dipilih dinamis dari config
      const t = TABLES[slug] as any;
      const hasUpdatedAt = "updatedAt" in t;
      let rowId = id;
      let before = null;
      if (id) {
        [before] = await tx.select().from(t).where(eq(t.id, id));
        if (!before) return { errors: { _form: "Data tidak ditemukan" } };
        await tx.update(t).set({ ...data, ...(hasUpdatedAt ? { updatedAt: new Date() } : {}) }).where(eq(t.id, id));
      } else {
        [{ id: rowId }] = await tx.insert(t).values({ ...data, schoolId: s.schoolId }).returning({ id: t.id });
      }
      // Hanya satu gudang utama
      if (slug === "gudang" && data.isDefault)
        await tx.update(warehouses).set({ isDefault: false }).where(and(ne(warehouses.id, rowId!), eq(warehouses.isDefault, true)));
      await logActivity(tx, s, id ? "UBAH" : "TAMBAH", slug, rowId, before, data);
      return { ok: `${def.title} "${String(data.name ?? data.code)}" tersimpan.` };
    },
    { unique: `${def.title} dengan nama/kode tersebut sudah ada.` },
  );
  if (result.errors) return { ...result, values: raw };
  revalidatePath(`/data-dasar`, "layout");
  return result;
}

export async function deleteEntity(slug: string, id: string, _prev: FormState): Promise<FormState> {
  if (!isEntitySlug(slug) || !z.uuid().safeParse(id).success) return { errors: { _form: "Permintaan tidak valid" } };
  const def = ENTITIES[slug];
  const result = await runSchoolAction(
    [...ROLES],
    async (tx, s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabel dipilih dinamis dari config
      const t = TABLES[slug] as any;
      const [before] = await tx.select().from(t).where(eq(t.id, id));
      if (!before) return { errors: { _form: "Data tidak ditemukan" } };
      if (slug === "gudang" && (before as { isDefault: boolean }).isDefault)
        return { errors: { _form: "Gudang utama tidak bisa dihapus. Jadikan gudang lain sebagai gudang utama terlebih dahulu." } };
      await tx.delete(t).where(eq(t.id, id));
      await logActivity(tx, s, "HAPUS", slug, id, before);
      return { ok: `${def.title} dihapus.` };
    },
    { inUse: `${def.title} ini masih dipakai data lain. Nonaktifkan saja bila tidak dipakai lagi.` },
  );
  revalidatePath(`/data-dasar`, "layout");
  return result;
}
