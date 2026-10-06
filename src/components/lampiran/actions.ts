"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { addAttachment, isAttachEntity, removeAttachment } from "@/lib/server/attachments";

export async function uploadAttachment(entity: string, entityId: string, path: string, _p: FormState, fd: FormData): Promise<FormState> {
  const file = fd.get("file");
  if (!isAttachEntity(entity) || !z.uuid().safeParse(entityId).success) return { errors: { _form: "Tidak valid" } };
  if (!(file instanceof File) || !file.size) return { errors: { _form: "Pilih berkas foto/PDF" } };
  const caption = String(fd.get("caption") ?? "").trim().slice(0, 200) || null;
  const res = await runSchoolAction(["ADMIN", "PETUGAS", "KEPSEK"], async (tx, s) => {
    const a = await addAttachment(tx, s, entity, entityId, file, caption);
    await logActivity(tx, s, "LAMPIRAN", entity, entityId, null, { file: a.fileName, caption });
    return { ok: "Lampiran ditambahkan." };
  });
  if (path.startsWith("/")) revalidatePath(path);
  return res;
}

export async function deleteAttachment(id: string, path: string): Promise<FormState> {
  if (!z.uuid().safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  const res = await runSchoolAction(["ADMIN", "PETUGAS", "KEPSEK"], async (tx, s) => {
    const a = await removeAttachment(tx, s, id);
    await logActivity(tx, s, "HAPUS_LAMPIRAN", a.entity, a.entityId, { file: a.fileName });
    return { ok: "Lampiran dihapus." };
  });
  if (path.startsWith("/")) revalidatePath(path);
  return res;
}
