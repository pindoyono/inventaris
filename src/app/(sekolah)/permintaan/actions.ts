"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { processOutbox } from "@/lib/server/inbox";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { actOnRequest, saveRequestDraft } from "@/lib/server/requests";
import { ACTION_LABEL, type ReqAction } from "@/lib/requests-shared";
import { fieldErrors } from "@/lib/validations";

const ALL = ["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"] as const;

const draftSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]).optional(),
  unitId: z.uuid("Pilih unit"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal"),
  purpose: z.string().trim().max(300).optional().transform((v) => v || null),
  lines: z.array(z.object({ itemId: z.uuid(), qty: z.string().min(1, "Isi jumlah"), note: z.string().max(200).optional().nullable() })).min(1, "Isi minimal satu barang"),
});
export type RequestPayload = z.input<typeof draftSchema>;

export async function saveRequestAction(payload: RequestPayload, andSubmit: boolean): Promise<FormState> {
  const parsed = draftSchema.safeParse(payload);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  let id = "";
  const res = await runSchoolAction([...ALL], async (tx, s) => {
    id = await saveRequestDraft(tx, s, { ...d, id: d.id || undefined });
    if (andSubmit) {
      const r = await actOnRequest(tx, s, id, { action: "AJUKAN" });
      await logActivity(tx, s, "AJUKAN", "nota_permintaan", id, null, { number: r.docNumber });
    } else await logActivity(tx, s, d.id ? "UBAH" : "TAMBAH", "nota_permintaan", id, null, { lines: d.lines.length });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  revalidatePath("/permintaan", "layout");
  if (andSubmit) after(() => processOutbox().catch((e) => console.error("outbox", e)));
  redirect(`/permintaan/${id}`);
}

const actSchema = z.object({
  action: z.enum(["AJUKAN", "BATAL", "TERUSKAN", "VERIFIKASI", "SETUJUI", "SALURKAN", "TOLAK", "KEMBALIKAN"]),
  reason: z.string().max(300).optional().nullable(),
  qty: z.record(z.string(), z.string()).optional(),
  warehouseId: z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || undefined),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function requestActAction(id: string, input: z.input<typeof actSchema>): Promise<FormState> {
  const parsed = actSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(id).success) return { errors: { _form: "Permintaan tidak valid" } };
  const a = parsed.data;
  const res = await runSchoolAction([...ALL], async (tx, s) => {
    const r = await actOnRequest(tx, s, id, a);
    await logActivity(tx, s, a.action, "nota_permintaan", id, null, { status: r.status, doc: r.docNumber, reason: a.reason ?? null });
    return { ok: `${ACTION_LABEL[a.action as ReqAction]}: berhasil${r.docNumber ? ` (${r.docNumber})` : ""}.` };
  });
  revalidatePath("/permintaan", "layout");
  revalidatePath("/dasbor");
  after(() => processOutbox().catch((e) => console.error("outbox", e)));
  return res;
}
