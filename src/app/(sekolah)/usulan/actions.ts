"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { budgetCeilings } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { processOutbox } from "@/lib/server/inbox";
import { actOnProposal, saveProposalDraft } from "@/lib/server/proposals";
import { P_ACTION_LABEL } from "@/lib/proposals-shared";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { fieldErrors } from "@/lib/validations";

const ALL = ["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"] as const;
const flush = () => after(() => processOutbox().catch((e) => console.error("outbox", e)));
const optUuid = z.union([z.literal(""), z.null(), z.uuid()]).optional().transform((v) => v || null);

const schema = z.object({
  id: z.union([z.literal(""), z.uuid()]).optional(),
  unitId: z.uuid("Pilih unit"),
  year: z.coerce.number().int().min(2020).max(2100),
  fundingSourceId: optUuid,
  fundingComponentId: optUuid,
  title: z.string().trim().min(5, "Isi judul/keperluan usulan").max(200),
  lines: z.array(z.object({
    kind: z.enum(["PERSEDIAAN", "ASET"]), itemId: optUuid, bmdCode: z.string().max(32).optional().nullable(),
    description: z.string().max(200), uom: z.string().max(30), qty: z.string(), estPrice: z.string(), reason: z.string().max(300).optional().nullable(), priority: z.coerce.number().int().min(1).max(3).optional(),
  })).min(1, "Isi minimal satu barang"),
});
export type ProposalPayload = z.input<typeof schema>;

export async function saveProposalAction(payload: ProposalPayload, andSubmit: boolean): Promise<FormState> {
  const p = schema.safeParse(payload);
  if (!p.success) return { errors: fieldErrors(p.error) };
  let id = "";
  const res = await runSchoolAction([...ALL], async (tx, s) => {
    id = await saveProposalDraft(tx, s, { ...p.data, id: p.data.id || undefined });
    if (andSubmit) await actOnProposal(tx, s, id, { action: "AJUKAN" });
    await logActivity(tx, s, andSubmit ? "AJUKAN" : "SIMPAN", "usulan_kebutuhan", id, null, { lines: p.data.lines.length });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  revalidatePath("/usulan", "layout");
  flush();
  redirect(`/usulan/${id}`);
}

export async function proposalActAction(id: string, input: { action: string; reason?: string; qty?: Record<string, string> }): Promise<FormState> {
  const p = z.object({ action: z.enum(["AJUKAN", "BATAL", "VERIFIKASI", "SETUJUI", "KEMBALIKAN", "TOLAK", "SELESAI"]), reason: z.string().max(300).optional(), qty: z.record(z.string(), z.string()).optional() }).safeParse(input);
  if (!p.success || !z.uuid().safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  const res = await runSchoolAction([...ALL], async (tx, s) => {
    const r = await actOnProposal(tx, s, id, p.data);
    await logActivity(tx, s, p.data.action, "usulan_kebutuhan", id, null, { status: r.status, reason: p.data.reason ?? null });
    return { ok: `${P_ACTION_LABEL[p.data.action]}: berhasil${r.number ? ` (${r.number})` : ""}.` };
  });
  revalidatePath("/usulan", "layout");
  revalidatePath("/dasbor");
  flush();
  return res;
}

/** Simpan pagu satu tahun: { "unitId|fundingSourceId": "nilai" } */
export async function saveBudgetAction(year: number, values: Record<string, string>): Promise<FormState> {
  if (!(year >= 2020 && year <= 2100)) return { errors: { _form: "Tahun tidak valid" } };
  return runSchoolAction(["ADMIN", "KEPSEK"], async (tx, s) => {
    let n = 0;
    for (const [k, raw] of Object.entries(values)) {
      const [unitId, fundingSourceId] = k.split("|");
      if (!z.uuid().safeParse(unitId).success || !z.uuid().safeParse(fundingSourceId).success) continue;
      const v = raw.trim();
      if (!v) {
        await tx.delete(budgetCeilings).where(and(eq(budgetCeilings.year, year), eq(budgetCeilings.unitId, unitId), eq(budgetCeilings.fundingSourceId, fundingSourceId)));
        continue;
      }
      let amount: bigint;
      try { amount = parseDec(normalizeIdNumber(v)); } catch { return { errors: { _form: `Nilai pagu tidak valid: ${v}` } }; }
      await tx.insert(budgetCeilings).values({ schoolId: s.schoolId, year, unitId, fundingSourceId, amount: toDec(amount) })
        .onConflictDoUpdate({ target: [budgetCeilings.schoolId, budgetCeilings.year, budgetCeilings.unitId, budgetCeilings.fundingSourceId], set: { amount: toDec(amount), updatedAt: new Date() } });
      n++;
    }
    await logActivity(tx, s, "UBAH", "pagu", null, null, { year, values });
    revalidatePath("/usulan", "layout");
    return { ok: `Pagu tahun ${year} tersimpan (${n} pos).` };
  });
}
