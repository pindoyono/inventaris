"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bmdCodes, localBmdCodes, supplyItems } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { cancelDoc, postDoc } from "@/lib/server/ledger";
import { createSupplyItem, deleteDraftDoc, saveDraftDoc, type DocInput } from "@/lib/server/supply";
import { requireSchoolUser, withSchool } from "@/lib/tenant";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { fieldErrors, formToObject } from "@/lib/validations";
import sinonim from "../../../../data/bmd/sinonim-persediaan.json";

/** Kode saran dari nama sehari-hari ("spidol" → Alat Tulis) */
function synonymCodes(term: string) {
  const t = term.toLowerCase();
  if (t.length < 3) return [];
  const hits = Object.entries(sinonim.sinonim as Record<string, string[]>).filter(([k]) => t.includes(k) || k.startsWith(t));
  return [...new Set(hits.flatMap(([, codes]) => codes))].map((code) => ({ code, words: hits.filter(([, c]) => c.includes(code)).map(([k]) => k) }));
}

const STOCK_ROLES = ["ADMIN", "PETUGAS"] as const;

const itemSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]).optional(),
  bmdCode: z.string().regex(/^1\.1\.7\.[\d.]+$/, "Pilih kode barang persediaan").optional(),
  name: z.string().trim().min(3, "Nama barang minimal 3 karakter").max(150),
  spec: z.string().trim().max(300).transform((v) => (v === "" ? null : v)),
  uomId: z.uuid("Pilih satuan"),
  minStock: z
    .string()
    .transform((v) => normalizeIdNumber(v || "0"))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Angka tidak valid"),
  isActive: z.literal("on").optional().transform(Boolean),
});

export async function saveItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return { values: raw, errors: fieldErrors(parsed.error) };
  const { id, bmdCode, isActive, ...d } = parsed.data;
  const minStock = toDec(parseDec(d.minStock));
  let savedId = id || "";

  const res = await runSchoolAction(
    [...STOCK_ROLES],
    async (tx, s): Promise<FormState> => {
      if (id) {
        const [before] = await tx.select().from(supplyItems).where(eq(supplyItems.id, id));
        if (!before) return { errors: { _form: "Barang tidak ditemukan" } };
        await tx.update(supplyItems).set({ ...d, minStock, isActive, updatedAt: new Date() }).where(eq(supplyItems.id, id));
        await logActivity(tx, s, "UBAH", "barang_persediaan", id, before, { ...d, minStock, isActive });
        return { ok: "Barang tersimpan." };
      }
      if (!bmdCode) return { errors: { bmdCode: "Pilih kode barang persediaan" } };
      const item = await createSupplyItem(tx, s.schoolId, { bmdCode, ...d, minStock });
      savedId = item.id;
      await logActivity(tx, s, "TAMBAH", "barang_persediaan", item.id, null, item);
      return { ok: `Barang ${item.nusp} ditambahkan.` };
    },
    { unique: "NUSP bentrok, silakan simpan ulang." },
  );
  if (res.errors) return { ...res, values: raw };
  revalidatePath("/persediaan");
  if (!id) redirect(`/persediaan/barang/${savedId}`);
  return res;
}

/** Cari kode barang persediaan (tingkat 7 resmi + kode lokal 1.1.7) untuk pemilih kode */
export async function searchPersediaanCodes(q: string) {
  const s = await requireSchoolUser();
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const isCode = /^[\d.]+$/.test(term);
  const esc = term.replace(/[%_\\]/g, "\\$&");
  const parent = alias(bmdCodes, "parent");
  const official = await db
    .select({ code: bmdCodes.code, name: bmdCodes.name, parent: sql<string>`coalesce(${parent.name}, '')` })
    .from(bmdCodes)
    .leftJoin(parent, eq(parent.code, bmdCodes.parentCode))
    .where(
      and(
        eq(bmdCodes.class, "PERSEDIAAN"),
        eq(bmdCodes.selectable, true),
        eq(bmdCodes.level, 7),
        isCode ? like(bmdCodes.code, `${term}%`) : or(ilike(bmdCodes.name, `%${esc}%`), ilike(parent.name, `%${esc}%`)),
      ),
    )
    .orderBy(asc(bmdCodes.code))
    .limit(40);
  const local = await withSchool(s.schoolId, (tx) =>
    tx
      .select({ code: localBmdCodes.code, name: localBmdCodes.name })
      .from(localBmdCodes)
      .where(and(like(localBmdCodes.code, "1.1.7.%"), isCode ? like(localBmdCodes.code, `${term}%`) : ilike(localBmdCodes.name, `%${esc}%`))),
  );
  const syn = isCode ? [] : synonymCodes(term);
  const synRows = syn.length
    ? await db
        .select({ code: bmdCodes.code, name: bmdCodes.name, parent: sql<string>`coalesce(${parent.name}, '')` })
        .from(bmdCodes)
        .leftJoin(parent, eq(parent.code, bmdCodes.parentCode))
        .where(inArray(bmdCodes.code, syn.map((x) => x.code)))
    : [];
  const suggested = syn
    .map((x) => synRows.find((r) => r.code === x.code))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ ...r, parent: `Saran untuk “${syn.find((x) => x.code === r.code)!.words[0]}” · ${r.parent}` }));
  const seen = new Set(suggested.map((r) => r.code));
  return [...suggested, ...local.map((l) => ({ ...l, parent: "Kode lokal" })), ...official.filter((o) => !seen.has(o.code))];
}

// ─────────────────────────────── dokumen stok

const lineSchema = z.object({
  itemId: z.uuid(),
  qty: z.string().min(1, "Isi jumlah"),
  unitPrice: z.string().optional().nullable(),
  note: z.string().max(200).optional().nullable(),
});
const optUuid = z.union([z.literal(""), z.null(), z.uuid()]).optional().transform((v) => v || null);
const optText = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => v || null);
const docSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]).optional(),
  kind: z.enum(["SALDO_AWAL", "PENERIMAAN", "PENYALURAN", "MUTASI"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal"),
  warehouseId: z.uuid("Pilih gudang"),
  toWarehouseId: optUuid,
  unitId: optUuid,
  vendorId: optUuid,
  fundingSourceId: optUuid,
  fundingComponentId: optUuid,
  acquisition: optText(30),
  refNumber: optText(100),
  refDate: z.union([z.literal(""), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null),
  note: optText(500),
  lines: z.array(lineSchema).min(1, "Isi minimal satu barang"),
});

export type DocPayload = z.input<typeof docSchema>;

export async function saveDoc(payload: DocPayload, andPost: boolean): Promise<FormState> {
  const parsed = docSchema.safeParse(payload);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { id, ...d } = parsed.data;
  if (d.kind === "PENYALURAN" && !d.unitId) return { errors: { unitId: "Pilih unit penerima" } };
  if (d.kind === "MUTASI" && !d.toWarehouseId) return { errors: { toWarehouseId: "Pilih gudang tujuan" } };
  let docId = id || "";

  const res = await runSchoolAction([...STOCK_ROLES], async (tx, s) => {
    docId = await saveDraftDoc(tx, s.schoolId, s.userId, d as DocInput, id || undefined);
    if (andPost) {
      const number = await postDoc(tx, s.schoolId, s.userId, docId);
      await logActivity(tx, s, "POSTING", "dokumen_stok", docId, null, { number, kind: d.kind, lines: d.lines.length });
      return { ok: `Dokumen ${number} diposting.` };
    }
    await logActivity(tx, s, id ? "UBAH" : "TAMBAH", "dokumen_stok", docId, null, { kind: d.kind, status: "DRAF" });
    return { ok: "Draf tersimpan." };
  });
  if (res.errors) return res;
  revalidatePath("/persediaan", "layout");
  redirect(`/persediaan/dokumen/${docId}`);
}

export async function postDocAction(docId: string, _prev: FormState): Promise<FormState> {
  const res = await runSchoolAction([...STOCK_ROLES], async (tx, s) => {
    const number = await postDoc(tx, s.schoolId, s.userId, docId);
    await logActivity(tx, s, "POSTING", "dokumen_stok", docId, null, { number });
    return { ok: `Dokumen ${number} diposting.` };
  });
  revalidatePath("/persediaan", "layout");
  return res;
}

export async function deleteDocAction(docId: string, _prev: FormState): Promise<FormState> {
  const res = await runSchoolAction([...STOCK_ROLES], async (tx, s) => {
    await deleteDraftDoc(tx, docId);
    await logActivity(tx, s, "HAPUS", "dokumen_stok", docId);
    return { ok: "Draf dihapus." };
  });
  if (res.errors) return res;
  revalidatePath("/persediaan", "layout");
  redirect("/persediaan/dokumen");
}

export async function cancelDocAction(docId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { errors: { reason: "Tulis alasan pembatalan (minimal 5 karakter)" } };
  const res = await runSchoolAction(["ADMIN", "PETUGAS", "KEPSEK"], async (tx, s) => {
    await cancelDoc(tx, s.schoolId, s.userId, docId, reason.slice(0, 300));
    await logActivity(tx, s, "BATAL", "dokumen_stok", docId, null, { reason });
    return { ok: "Dokumen dibatalkan; stok sudah dikembalikan." };
  });
  revalidatePath("/persediaan", "layout");
  return res;
}
