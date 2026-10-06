"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { assetEvents, assets } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { createAssets, moveAssets, setCondition, setIdle } from "@/lib/server/assets";
import { todayWita } from "@/lib/server/ledger";
import { searchCodes } from "@/lib/server/code-search";
import { requireSchoolUser } from "@/lib/tenant";
import { KIB_ATTRS, kibOfCode } from "@/lib/assets-shared";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { fieldErrors, formToObject } from "@/lib/validations";

const ROLES = ["ADMIN", "PETUGAS"] as const;

export async function searchAssetCodes(q: string) {
  const s = await requireSchoolUser();
  return searchCodes(s.schoolId, q, "aset");
}

const optUuid = z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null);
const optText = (n: number) => z.string().trim().max(n).optional().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal");
const money = z
  .string()
  .transform((v) => normalizeIdNumber(v || ""))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Isi harga dengan angka (mis. 8.500.000)");

const baseFields = {
  name: z.string().trim().min(3, "Nama barang minimal 3 karakter").max(200),
  brand: optText(100),
  vendorId: optUuid,
  fundingSourceId: optUuid,
  fundingComponentId: optUuid,
  refNumber: optText(100),
  unitId: optUuid,
  note: optText(500),
};

const createSchema = z.object({
  ...baseFields,
  bmdCode: z.string().regex(/^1\.[35]\.\d\.[\d.]+$/, "Pilih kode barang aset"),
  acqDate: date,
  acqPrice: money,
  acquisition: z.enum(["PEMBELIAN", "HIBAH", "PRODUKSI", "INVENTARISASI", "LAINNYA"]),
  roomId: optUuid,
  condition: z.enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]),
  qty: z.coerce.number().int("Jumlah bilangan bulat").min(1, "Minimal 1").max(500, "Maksimal 500 unit sekali catat"),
  startRegNo: z.union([z.literal(""), z.coerce.number().int().min(1).max(999999)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
});

function readAttrs(raw: Record<string, string>, kib: string | null) {
  const out: Record<string, string> = {};
  for (const a of KIB_ATTRS[kib ?? ""] ?? []) {
    const v = (raw[`attr_${a.key}`] ?? "").trim().slice(0, 200);
    if (v) out[a.key] = v;
  }
  return out;
}

export async function createAssetsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { values: raw, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  let target = "";
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const r = await createAssets(tx, s, { ...d, acqPrice: toDec(parseDec(d.acqPrice)), attrs: readAttrs(raw, kibOfCode(d.bmdCode)) });
    await logActivity(tx, s, "TAMBAH", "aset", r.batchId, null, { bmdCode: d.bmdCode, name: d.name, qty: d.qty, regNo: [r.first, r.last], isIntra: r.isIntra });
    target = d.qty === 1 ? `/aset/${r.ids[0]}` : `/aset?batch=${r.batchId}`;
    return { ok: "ok" };
  });
  if (res.errors) return { ...res, values: raw };
  revalidatePath("/aset");
  redirect(target);
}

const updateSchema = z.object({ id: z.uuid(), ...baseFields });

export async function updateAssetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { values: raw, errors: fieldErrors(parsed.error) };
  const { id, ...d } = parsed.data;
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const [before] = await tx.select().from(assets).where(eq(assets.id, id)).for("update");
    if (!before) return { errors: { _form: "Aset tidak ditemukan" } };
    const after = { ...d, attrs: readAttrs(raw, before.kib) };
    await tx.update(assets).set({ ...after, updatedAt: new Date() }).where(eq(assets.id, id));
    await tx.insert(assetEvents).values({
      schoolId: s.schoolId, assetId: id, kind: "UBAH_DATA", date: todayWita(),
      note: "Data barang diperbarui", createdBy: s.userId, createdByName: s.userName,
    });
    await logActivity(tx, s, "UBAH", "aset", id, before, after);
    return { ok: "Tersimpan." };
  });
  if (res.errors) return { ...res, values: raw };
  revalidatePath("/aset", "layout");
  redirect(`/aset/${id}`);
}

const bulkSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Pilih aset").max(1000),
  date,
  note: optText(300),
});

export async function moveAssetsAction(input: { ids: string[]; roomId: string; date: string; note?: string }): Promise<FormState> {
  const parsed = bulkSchema.extend({ roomId: z.uuid("Pilih ruangan tujuan") }).safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const n = await moveAssets(tx, s, d.ids, d.roomId, d.date, d.note);
    await logActivity(tx, s, "PINDAH", "aset", null, null, { ids: d.ids, roomId: d.roomId, date: d.date });
    return { ok: `${n} aset dipindahkan.` };
  });
  revalidatePath("/aset", "layout");
  return res;
}

export async function conditionAction(input: { ids: string[]; condition: string; date: string; note?: string }): Promise<FormState> {
  const parsed = bulkSchema.extend({ condition: z.enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]) }).safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const n = await setCondition(tx, s, d.ids, d.condition, d.date, d.note);
    await logActivity(tx, s, "KONDISI", "aset", null, null, { ids: d.ids, condition: d.condition, date: d.date });
    return { ok: `Kondisi ${n} aset diperbarui.` };
  });
  revalidatePath("/aset", "layout");
  return res;
}

export async function idleAction(input: { id: string; idle: boolean; plan?: string; note?: string }): Promise<FormState> {
  const p = z.object({ id: z.uuid(), idle: z.boolean(), plan: z.enum(["PENGGUNAAN", "PEMANFAATAN", "PEMINDAHTANGANAN"]).optional(), note: z.string().max(300).optional() }).safeParse(input);
  if (!p.success) return { errors: { _form: "Data tidak valid" } };
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    await setIdle(tx, s, p.data.id, p.data.idle, p.data.plan ?? null, p.data.note?.trim() || null);
    await logActivity(tx, s, p.data.idle ? "TIDAK_DIGUNAKAN" : "DIGUNAKAN_KEMBALI", "aset", p.data.id, null, p.data);
    return { ok: p.data.idle ? "Ditandai tidak digunakan untuk tugas & fungsi." : "Ditandai digunakan kembali." };
  });
  revalidatePath("/aset", "layout");
  return res;
}
