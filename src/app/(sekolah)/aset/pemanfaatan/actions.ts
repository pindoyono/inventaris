"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, inArray, ne, notLike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { assets, rooms } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { createUtilization, stepUtilization, updateUtilizationPlan } from "@/lib/server/utilization";
import { requireSchoolUser, withSchool } from "@/lib/tenant";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { fieldErrors } from "@/lib/validations";

const ROLES = ["ADMIN", "PETUGAS"] as const;
const optText = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal");
const optDate = z.union([z.literal(""), z.null(), date]).optional().transform((v) => v || null);
const money = z
  .string()
  .optional()
  .transform((v) => normalizeIdNumber(v || "0"))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Isi nilai dengan angka")
  .transform((v) => toDec(parseDec(v)));

/** Barang yang bisa dimanfaatkan (belum dihapus/hilang/diusulkan hapus) */
export async function searchUtilizableAssets(q: string) {
  const s = await requireSchoolUser(["ADMIN", "PETUGAS"]);
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const e = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  return withSchool(s.schoolId, (tx) =>
    tx
      .select({ id: assets.id, name: assets.name, brand: assets.brand, bmdCode: assets.bmdCode, regNo: assets.regNo, acqPrice: assets.acqPrice, room: rooms.name })
      .from(assets)
      .leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(and(inArray(assets.status, ["DIGUNAKAN", "DIPINJAM", "DALAM_PEMELIHARAAN"]), ne(assets.kib, "F"), notLike(assets.bmdCode, "1.3.5.07.%"), or(ilike(assets.name, e), ilike(assets.brand, e), ilike(assets.bmdCode, e), sql`lpad(${assets.regNo}::text, 6, '0') like ${e}`)))
      .orderBy(asc(assets.name), asc(assets.regNo))
      .limit(60),
  );
}

const schema = z
  .object({
    id: z.union([z.literal(""), z.uuid()]).optional(),
    kind: z.enum(["PEMANFAATAN", "PENGGUNAAN_SEMENTARA", "OPERASIONAL_PIHAK_LAIN"]),
    form: z.union([z.literal(""), z.enum(["SEWA", "PINJAM_PAKAI", "BGS_BSG", "KSP", "KSPI"])]).optional().transform((v) => v || null),
    planYear: z.coerce.number().int(),
    partner: optText(200),
    purpose: z.string().trim().min(3, "Isi peruntukan").max(300),
    term: optText(100),
    contribution: money,
    note: optText(500),
    lines: z.array(z.object({ assetId: z.uuid(), portion: optText(100) })).min(1, "Pilih minimal satu barang"),
    running: z.boolean().optional(),
    startDate: optDate, endDate: optDate, agreementNo: optText(100), agreementDate: optDate, approvalNo: optText(100), approvalDate: optDate,
  })
  .refine((d) => !d.running || !!d.startDate, { message: "Isi tanggal mulai", path: ["startDate"] });
export type UtilPayload = z.input<typeof schema>;

export async function saveUtilizationAction(payload: UtilPayload): Promise<FormState> {
  const p = schema.safeParse(payload);
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { id: editId, running, startDate, endDate, agreementNo, agreementDate, approvalNo, approvalDate, ...d } = p.data;
  let id = editId || "";
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    if (id) await updateUtilizationPlan(tx, s, id, d);
    else id = await createUtilization(tx, s, { ...d, running: running ? { startDate: startDate!, endDate, agreementNo, agreementDate, approvalNo, approvalDate } : null });
    await logActivity(tx, s, editId ? "UBAH" : "TAMBAH", "pemanfaatan", id, null, { kind: d.kind, form: d.form, lines: d.lines.length });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  revalidatePath("/aset", "layout");
  redirect(`/aset/pemanfaatan/${id}`);
}

const stepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("setujui"), approvalNo: z.string().trim().min(3, "Isi nomor surat persetujuan").max(100), approvalDate: date }),
  z.object({ step: z.literal("tolak"), reason: z.string().trim().min(5, "Isi alasan").max(300) }),
  z.object({ step: z.literal("batal"), reason: z.string().trim().min(5, "Isi alasan").max(300) }),
  z.object({ step: z.literal("mulai"), partner: z.string().trim().min(3, "Isi nama mitra").max(200), agreementNo: optText(100), agreementDate: optDate, startDate: date, endDate: optDate, contribution: money }),
  z.object({ step: z.literal("selesai"), endedDate: date }),
]);

export async function utilizationStepAction(id: string, input: Record<string, string>): Promise<FormState> {
  const p = stepSchema.safeParse(input);
  if (!z.uuid().safeParse(id).success || !p.success) return { errors: p.success ? { _form: "Tidak valid" } : fieldErrors(p.error) };
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    await stepUtilization(tx, s, id, p.data);
    await logActivity(tx, s, p.data.step.toUpperCase(), "pemanfaatan", id, null, p.data);
    return { ok: { setujui: "Persetujuan dicatat.", tolak: "Ditandai ditolak.", batal: "Dibatalkan.", mulai: "Pemanfaatan berjalan.", selesai: "Pemanfaatan selesai." }[p.data.step] };
  });
  revalidatePath("/aset", "layout");
  return res;
}
