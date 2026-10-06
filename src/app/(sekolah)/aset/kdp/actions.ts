"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { addConstructionPayment, createConstruction, finishConstruction, setAtrFollowUp, setConstructionProgress, stopConstruction } from "@/lib/server/construction";
import { fmtRp, normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { fieldErrors, formToObject } from "@/lib/validations";

const ROLES = ["ADMIN", "PETUGAS"] as const;
const optUuid = z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null);
const optText = (n: number) => z.string().trim().max(n).optional().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal");
const optDate = z.union([z.literal(""), date]).optional().transform((v) => v || null);
const money = z
  .string()
  .optional()
  .transform((v) => normalizeIdNumber(v || "0"))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Isi nilai dengan angka (mis. 150.000.000)")
  .transform((v) => toDec(parseDec(v)));

const createSchema = z.object({
  kind: z.enum(["KDP", "ATR"]),
  bmdCode: z.string().min(1, "Pilih kode"),
  name: z.string().trim().min(3, "Isi nama pekerjaan").max(200),
  ownerName: optText(200),
  contractNo: optText(100),
  contractDate: optDate,
  vendorId: optUuid,
  contractValue: money,
  startDate: date,
  targetDate: optDate,
  fundingSourceId: optUuid,
  fundingComponentId: optUuid,
  letak: optText(200),
  luas: optText(50),
  konstruksi: optText(50),
  note: optText(500),
});

export async function createConstructionAction(_p: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const p = createSchema.safeParse(raw);
  if (!p.success) return { values: raw, errors: fieldErrors(p.error) };
  const { letak, luas, konstruksi, ...d } = p.data;
  const attrs = Object.fromEntries(Object.entries({ letak, luas, konstruksi, tglMulai: d.startDate }).filter(([, v]) => v)) as Record<string, string>;
  let id = "";
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const r = await createConstruction(tx, s, { ...d, attrs });
    id = r.id;
    await logActivity(tx, s, "TAMBAH", d.kind === "KDP" ? "kdp" : "renovasi", r.id, null, d);
    return { ok: "ok" };
  });
  if (res.errors) return { ...res, values: raw };
  revalidatePath("/aset", "layout");
  redirect(`/aset/kdp/${id}`);
}

const stepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("bayar"), date, amount: money, docNo: optText(100), note: optText(300) }),
  z.object({ step: z.literal("progres"), progress: z.coerce.number({ message: "Isi progres" }).int().min(0, "0–100").max(100, "0–100"), targetDate: optDate }),
  z.object({ step: z.literal("hentikan"), reason: z.string().trim().min(5, "Isi alasan penghentian").max(300) }),
  z.object({ step: z.literal("lanjutkan") }),
  z.object({ step: z.literal("selesai"), date, bastNo: z.string().trim().min(3, "Isi nomor BAST").max(100), bmdCode: optText(32), name: optText(200), roomId: optUuid }),
  z.object({ step: z.literal("tindak-lanjut"), value: z.enum(["", "PEMINDAHTANGANAN", "PENGALIHAN_STATUS"]) }),
]);

export async function constructionStepAction(id: string, input: Record<string, string>): Promise<FormState> {
  const p = stepSchema.safeParse(input);
  if (!z.uuid().safeParse(id).success || !p.success) return { errors: p.success ? { _form: "Tidak valid" } : fieldErrors(p.error) };
  const d = p.data;
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    let ok = "";
    switch (d.step) {
      case "bayar": {
        const v = await addConstructionPayment(tx, s, id, d);
        ok = `Pembayaran dicatat. Nilai sekarang Rp${fmtRp(v)}.`;
        break;
      }
      case "progres":
        await setConstructionProgress(tx, s, id, d.progress, d.targetDate);
        ok = "Progres diperbarui.";
        break;
      case "hentikan":
      case "lanjutkan":
        await stopConstruction(tx, s, id, d.step === "hentikan", d.step === "hentikan" ? d.reason : null);
        ok = d.step === "hentikan" ? "Pekerjaan ditandai dihentikan." : "Pekerjaan dilanjutkan.";
        break;
      case "selesai":
        await finishConstruction(tx, s, id, d);
        ok = "Pekerjaan selesai.";
        break;
      case "tindak-lanjut":
        await setAtrFollowUp(tx, s, id, d.value || null);
        ok = "Tindak lanjut disimpan.";
        break;
    }
    await logActivity(tx, s, d.step.toUpperCase(), "kdp", id, null, d);
    return { ok };
  });
  revalidatePath("/aset", "layout");
  return res;
}
