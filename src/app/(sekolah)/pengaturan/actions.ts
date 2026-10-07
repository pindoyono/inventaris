"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { schoolSettings, schools } from "@/db/schema";
import { FormFail, runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { FileError, saveImage } from "@/lib/server/files";
import {
  bmdSettingsSchema,
  fieldErrors,
  formToObject,
  KIB_GOLONGAN,
  profileSchema,
  workflowSchema,
} from "@/lib/validations";
import { setupStatus } from "./status";
import { DEFAULT_USEFUL_LIFE } from "@/lib/depreciation-shared";

export async function saveProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { values: raw, errors: fieldErrors(parsed.error) };
  const { name, shortName, address, ...settings } = parsed.data;

  const res = await runSchoolAction(["ADMIN"], async (tx, s) => {
    const logos: { logoSchoolFile?: string; logoPemdaFile?: string } = {};
    for (const [field, key, base] of [
      ["logoSchool", "logoSchoolFile", "logo-sekolah"],
      ["logoPemda", "logoPemdaFile", "logo-pemda"],
    ] as const) {
      const f = fd.get(field);
      if (f instanceof File && f.size > 0) {
        try {
          logos[key] = await saveImage(s.schoolId, base, f);
        } catch (e) {
          if (e instanceof FileError) throw new FormFail({ [field]: e.message });
          throw e;
        }
      }
    }
    const [before] = await tx.select().from(schoolSettings);
    await tx.update(schools).set({ name, shortName, address, updatedAt: new Date() }).where(eq(schools.id, s.schoolId));
    await tx.update(schoolSettings).set({ ...settings, ...logos, updatedAt: new Date() });
    await logActivity(tx, s, "UBAH", "profil_sekolah", s.schoolId, before, { name, shortName, address, ...settings, ...logos });
    revalidatePath("/", "layout");
    return { ok: "Profil dan kop tersimpan." };
  });
  // React mengosongkan form setelah action; kembalikan isian agar tidak hilang saat gagal
  return res.errors ? { ...res, values: raw } : res;
}

export async function saveBmdSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = bmdSettingsSchema.safeParse(raw);
  if (!parsed.success) return { values: raw, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const capitalization: Record<string, number> = { default: d.capDefault };
  for (const g of KIB_GOLONGAN) {
    const v = (raw[`cap_${g}`] ?? "").replace(/[^\d]/g, "");
    if (v) capitalization[g] = Number(v);
  }

  const res = await runSchoolAction(["ADMIN"], async (tx, s) => {
    const [before] = await tx.select().from(schoolSettings);
    const after = {
      kodeProvinsi: d.kodeProvinsi,
      kodeKab: d.kodeKab,
      kodeBidang: d.kodeBidang,
      kodeUnit: d.kodeUnit,
      kodeSubUnit: d.kodeSubUnit,
      kodeUpb: d.kodeUpb,
      labelQr: d.labelQr,
      labelLogo: d.labelLogo,
      capitalization,
    };
    await tx.update(schoolSettings).set({ ...after, updatedAt: new Date() });
    await logActivity(tx, s, "UBAH", "pengaturan_bmd", s.schoolId,
      { kodeProvinsi: before.kodeProvinsi, kodeKab: before.kodeKab, kodeBidang: before.kodeBidang, kodeUnit: before.kodeUnit, kodeSubUnit: before.kodeSubUnit, kodeUpb: before.kodeUpb, labelQr: before.labelQr, labelLogo: before.labelLogo, capitalization: before.capitalization },
      after);
    revalidatePath("/pengaturan");
    return { ok: "Kode lokasi, pengaturan label, dan batas kapitalisasi tersimpan." };
  });
  return res.errors ? { ...res, values: raw } : res;
}

export async function saveWorkflow(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const parsed = workflowSchema.safeParse(raw);
  if (!parsed.success) return { values: raw, errors: fieldErrors(parsed.error) };
  return runSchoolAction(["ADMIN"], async (tx, s) => {
    const [before] = await tx.select().from(schoolSettings);
    await tx.update(schoolSettings).set({ ...parsed.data, updatedAt: new Date() });
    await logActivity(tx, s, "UBAH", "alur_kerja", s.schoolId,
      { approvalLevels: before.approvalLevels, studentAccounts: before.studentAccounts, distributionMode: before.distributionMode, loanDefaultDays: before.loanDefaultDays, unitLabel: before.unitLabel },
      parsed.data);
    revalidatePath("/pengaturan");
    return { ok: "Alur kerja tersimpan." };
  });
}

export async function completeSetup(_prev: FormState): Promise<FormState> {
  return runSchoolAction(["ADMIN"], async (tx, s) => {
    const st = await setupStatus(tx);
    const missing = st.steps.filter((x) => x.required && !x.done).map((x) => x.title);
    if (missing.length) return { errors: { _form: `Belum lengkap: ${missing.join(", ")}.` } };
    await tx.update(schools).set({ setupCompletedAt: new Date(), updatedAt: new Date() }).where(eq(schools.id, s.schoolId));
    await logActivity(tx, s, "SELESAI", "penyiapan", s.schoolId);
    revalidatePath("/", "layout");
    return { ok: "Penyiapan selesai. Sekolah siap digunakan." };
  });
}

/** Masa manfaat penyusutan per objek (tahun; 0 = tidak disusutkan). Hanya simpan yang berbeda dari bawaan. */
export async function saveUsefulLife(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = formToObject(fd);
  const out: Record<string, number> = {};
  for (const [code, def] of Object.entries(DEFAULT_USEFUL_LIFE)) {
    const v = (raw[`life_${code}`] ?? "").trim();
    if (v === "") continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 100) return { values: raw, errors: { _form: `Masa manfaat ${code} harus bilangan bulat 0–100` } };
    if (n !== def) out[code] = n;
  }
  const res = await runSchoolAction(["ADMIN"], async (tx, s) => {
    const [before] = await tx.select({ usefulLife: schoolSettings.usefulLife }).from(schoolSettings);
    await tx.update(schoolSettings).set({ usefulLife: out, updatedAt: new Date() });
    await logActivity(tx, s, "UBAH", "masa_manfaat", s.schoolId, before.usefulLife, out);
    return { ok: "Masa manfaat tersimpan. Laporan penyusutan memakai nilai baru." };
  });
  return res.errors ? { ...res, values: raw } : res;
}
