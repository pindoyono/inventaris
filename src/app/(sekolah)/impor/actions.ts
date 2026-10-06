"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { importJobs } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { readImportFile } from "@/lib/server/impor/read";
import { applyRows, validateRows } from "@/lib/server/impor/process";
import { IMPORT_SPECS, type ImportKind } from "@/lib/server/impor/spec";
import { UserError } from "@/lib/server/errors";

const ROLES = ["ADMIN", "PETUGAS"] as const;

export async function previewImport(_p: FormState, fd: FormData): Promise<FormState> {
  const kind = String(fd.get("kind") ?? "") as ImportKind;
  const file = fd.get("file");
  if (!(kind in IMPORT_SPECS)) return { errors: { _form: "Pilih jenis impor" } };
  if (!(file instanceof File) || !file.size) return { errors: { _form: "Pilih berkas .xlsx atau .csv" } };
  if (kind === "pengguna") {
    // hanya Admin yang boleh membuat akun
    const r = await runSchoolAction(["ADMIN"], async () => ({ ok: "ok" }));
    if (r.errors) return r;
  }
  let id = "";
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const rows = await readImportFile(kind, file);
    const checked = await validateRows(tx, kind, rows);
    // Password dari berkas langsung di-hash; teks aslinya tidak pernah disimpan
    if (kind === "pengguna")
      for (const r of checked)
        if (r.data.password) {
          r.data.password_hash = r.errors.length ? "" : await bcrypt.hash(r.data.password, 10);
          delete r.data.password;
        }
    // bersihkan pratinjau lama (> 2 hari)
    await tx.delete(importJobs).where(and(eq(importJobs.status, "PRATINJAU"), lt(importJobs.createdAt, new Date(Date.now() - 2 * 86400_000))));
    [{ id }] = await tx.insert(importJobs).values({ schoolId: s.schoolId, kind, fileName: file.name.slice(0, 200), rows: checked, createdBy: s.userId }).returning({ id: importJobs.id });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  redirect(`/impor/${id}`);
}

export type ApplyResult = FormState & { created?: number; detail?: string[]; passwords?: { username: string; password: string }[] };

export async function applyImport(id: string): Promise<ApplyResult> {
  if (!z.uuid().safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  let out: ApplyResult = {};
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const [job] = await tx.select().from(importJobs).where(eq(importJobs.id, id)).for("update");
    if (!job) throw new UserError("Pratinjau tidak ditemukan");
    if (job.status !== "PRATINJAU") throw new UserError("Impor ini sudah diproses");
    if (job.kind === "pengguna" && !s.roles.includes("ADMIN")) throw new UserError("Hanya Admin yang bisa mengimpor pengguna");
    const kind = job.kind as ImportKind;
    // validasi ulang: data sekolah mungkin berubah sejak pratinjau
    const rows = await validateRows(tx, kind, job.rows.map(({ row, data }) => ({ row, data })));
    const valid = rows.filter((r) => !r.errors.length).length;
    if (!valid) throw new UserError("Tidak ada baris valid untuk diimpor");
    const r = await applyRows(tx, s, kind, rows);
    // password awal TIDAK disimpan; hanya ditampilkan sekali ke pengimpor
    await tx.update(importJobs).set({ status: "SELESAI", rows, result: { created: r.created, detail: r.detail, valid, skipped: rows.length - valid }, updatedAt: new Date() }).where(eq(importJobs.id, id));
    await logActivity(tx, s, "IMPOR", `impor_${kind}`, id, null, { file: job.fileName, valid, skipped: rows.length - valid, created: r.created });
    out = { created: r.created, detail: r.detail, passwords: r.passwords };
    return { ok: `Impor selesai: ${valid} baris diproses${rows.length - valid ? `, ${rows.length - valid} baris dilewati karena tidak valid` : ""}.` };
  });
  revalidatePath("/", "layout");
  return res.errors ? res : { ...res, ...out };
}
