"use server";

import { revalidatePath } from "next/cache";
import { and, eq, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bmdCodes, favoriteBmdCodes, localBmdCodes } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { fieldErrors, formToObject } from "@/lib/validations";

const ROLES = ["ADMIN", "PETUGAS"] as const;

export async function toggleFavorite(code: string, on: boolean): Promise<FormState> {
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    if (on) await tx.insert(favoriteBmdCodes).values({ schoolId: s.schoolId, code }).onConflictDoNothing();
    else await tx.delete(favoriteBmdCodes).where(eq(favoriteBmdCodes.code, code));
    return { ok: on ? "Ditambahkan ke favorit" : "Dihapus dari favorit" };
  });
  revalidatePath("/kode-barang");
  return res;
}

const localSchema = z.object({
  parentCode: z.string().regex(/^\d\.\d\.\d\.\d{2}\.\d{2}\.\d{2}$/, "Induk harus kode sub rincian objek (tingkat 6)"),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(200),
  decreeRef: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .optional(),
});

/** Kode barang tambahan di bawah sub rincian objek; nomor urut melanjutkan kode resmi & lokal yang sudah ada. */
export async function addLocalCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = localSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const [parent] = await db.select().from(bmdCodes).where(eq(bmdCodes.code, d.parentCode));
  if (!parent || parent.level !== 6) return { errors: { parentCode: "Kode induk tidak ditemukan" } };
  const official = await db.select({ code: bmdCodes.code }).from(bmdCodes).where(and(eq(bmdCodes.parentCode, d.parentCode)));

  const res = await runSchoolAction(
    [...ROLES],
    async (tx, s) => {
      const local = await tx.select({ code: localBmdCodes.code }).from(localBmdCodes).where(like(localBmdCodes.code, `${d.parentCode}.%`));
      const max = Math.max(0, ...[...official, ...local].map((r) => Number(r.code.split(".").pop())));
      if (max >= 999) return { errors: { _form: "Nomor urut di bawah induk ini sudah penuh" } };
      const code = `${d.parentCode}.${String(max + 1).padStart(3, "0")}`;
      const [row] = await tx.insert(localBmdCodes).values({ schoolId: s.schoolId, code, parentCode: d.parentCode, name: d.name, decreeRef: d.decreeRef ?? null }).returning();
      await logActivity(tx, s, "TAMBAH", "kode_barang_lokal", row.id, null, row);
      return { ok: `Kode ${code} — ${d.name} ditambahkan.` };
    },
    { unique: "Kode sudah ada, coba lagi." },
  );
  revalidatePath("/kode-barang");
  return res;
}
