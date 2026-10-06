"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { processOutbox } from "@/lib/server/inbox";
import { cancelProcurement, orderProcurement, receiveProcurement, saveProcurementDraft } from "@/lib/server/procurement";
import { fieldErrors } from "@/lib/validations";

const ROLES = ["ADMIN", "PETUGAS"] as const;
const optUuid = z.union([z.literal(""), z.null(), z.uuid()]).optional().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.object({
  id: z.union([z.literal(""), z.uuid()]).optional(),
  proposalId: optUuid, vendorId: optUuid, fundingSourceId: optUuid, fundingComponentId: optUuid,
  orderDate: date, refNumber: z.string().max(100).optional().nullable().transform((v) => v?.trim() || null),
  refDate: z.union([z.literal(""), z.null(), date]).optional().transform((v) => v || null),
  taxAmount: z.string().optional(), note: z.string().max(500).optional().nullable().transform((v) => v?.trim() || null),
  lines: z.array(z.object({ proposalLineId: optUuid, kind: z.enum(["PERSEDIAAN", "ASET"]), itemId: optUuid, bmdCode: z.string().max(32).optional().nullable(), description: z.string().trim().min(2, "Isi uraian barang").max(200), brand: z.string().max(100).optional().nullable(), qty: z.string(), unitPrice: z.string() })).min(1, "Isi minimal satu barang"),
});
export type ProcPayload = z.input<typeof schema>;

export async function saveProcurementAction(payload: ProcPayload, andOrder: boolean): Promise<FormState> {
  const p = schema.safeParse(payload);
  if (!p.success) return { errors: fieldErrors(p.error) };
  let id = "";
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    id = await saveProcurementDraft(tx, s, { ...p.data, id: p.data.id || undefined });
    if (andOrder) await orderProcurement(tx, s, id);
    await logActivity(tx, s, andOrder ? "PESAN" : "SIMPAN", "pengadaan", id, null, { lines: p.data.lines.length });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  revalidatePath("/pengadaan", "layout");
  redirect(`/pengadaan/${id}`);
}

export async function procurementActAction(id: string, input: { action: "PESAN" | "BATAL" | "TERIMA"; date?: string; warehouseId?: string; lines?: { lineId: string; qty: string; itemId?: string; roomId?: string; condition?: string }[] }): Promise<FormState> {
  if (!z.uuid().safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    if (input.action === "PESAN") { await orderProcurement(tx, s, id); await logActivity(tx, s, "PESAN", "pengadaan", id); return { ok: "Ditandai sudah dipesan." }; }
    if (input.action === "BATAL") { await cancelProcurement(tx, s, id); await logActivity(tx, s, "BATAL", "pengadaan", id); return { ok: "Pengadaan dibatalkan." }; }
    const lines = z.array(z.object({ lineId: z.uuid(), qty: z.string(), itemId: optUuid, roomId: optUuid, condition: z.enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]).optional() })).parse(input.lines ?? []);
    const r = await receiveProcurement(tx, s, id, { date: date.parse(input.date), warehouseId: input.warehouseId || null, lines });
    await logActivity(tx, s, "TERIMA", "pengadaan", id, null, r);
    return { ok: `Barang diterima${r.docs.length ? ` · persediaan: ${r.docs.join(", ")}` : ""}${r.assetUnits ? ` · ${r.assetUnits} unit aset dicatat` : ""}${r.done ? " · pengadaan selesai" : ""}.` };
  });
  revalidatePath("/pengadaan", "layout");
  revalidatePath("/usulan", "layout");
  revalidatePath("/persediaan", "layout");
  revalidatePath("/aset", "layout");
  after(() => processOutbox().catch((e) => console.error("outbox", e)));
  return res;
}
