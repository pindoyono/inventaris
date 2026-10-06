"use server";

import { redirect } from "next/navigation";
import { fieldErrors, formToObject, registrationSchema, type FieldErrors } from "@/lib/validations";
import { NpsnTakenError, RegionError, registerSchool } from "@/lib/server/provision";
import { clientIp, rateLimit } from "@/lib/server/request";

export type RegisterState = { errors?: FieldErrors; values?: Record<string, string> };

export async function registerAction(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const raw = formToObject(fd);
  // Jangan kembalikan password ke klien
  const values = { ...raw };
  delete values.adminPassword;
  delete values.adminPasswordConfirm;

  if (!rateLimit(`daftar:${(await clientIp()) ?? "?"}`, 5, 60 * 60 * 1000)) {
    return { values, errors: { _form: "Terlalu banyak percobaan pendaftaran. Coba lagi dalam satu jam." } };
  }

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) return { values, errors: fieldErrors(parsed.error) };

  try {
    await registerSchool(parsed.data);
  } catch (e) {
    if (e instanceof NpsnTakenError)
      return { values, errors: { npsn: "NPSN ini sudah terdaftar. Hubungi admin sekolah Anda atau pengelola platform." } };
    if (e instanceof RegionError) return { values, errors: { regencyCode: "Wilayah tidak valid" } };
    console.error("registrasi gagal", e);
    return { values, errors: { _form: "Pendaftaran gagal karena kesalahan server. Silakan coba lagi." } };
  }
  redirect(`/daftar/terkirim?npsn=${parsed.data.npsn}`);
}
