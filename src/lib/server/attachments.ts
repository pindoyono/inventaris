import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { assets, attachments, constructions, disposals, loans, maintenances, procurements, utilizations } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { FileError, saveDocument } from "@/lib/server/files";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

/** Entitas yang boleh diberi lampiran → tabelnya (memastikan id milik sekolah ini lewat RLS) */
const TABLES = { aset: assets, pengadaan: procurements, peminjaman: loans, penghapusan: disposals, pemeliharaan: maintenances, kdp: constructions, pemanfaatan: utilizations } as const;
export type AttachEntity = keyof typeof TABLES;
export const isAttachEntity = (e: string): e is AttachEntity => e in TABLES;

export async function addAttachment(tx: Tx, s: SchoolSession, entity: AttachEntity, entityId: string, file: File, caption: string | null) {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK"])) throw new UserError("Tidak berwenang menambah lampiran");
  const t = TABLES[entity];
  const [row] = await tx.select({ id: t.id }).from(t).where(eq(t.id, entityId));
  if (!row) throw new UserError("Data tidak ditemukan");
  const n = (await tx.select({ id: attachments.id }).from(attachments).where(and(eq(attachments.entity, entity), eq(attachments.entityId, entityId)))).length;
  if (n >= 20) throw new UserError("Maksimal 20 lampiran per data");
  let stored: string;
  try {
    stored = await saveDocument(s.schoolId, `lampiran-${entity}`, file);
  } catch (e) {
    if (e instanceof FileError) throw new UserError(e.message);
    throw e;
  }
  const [a] = await tx.insert(attachments).values({ schoolId: s.schoolId, entity, entityId, fileName: file.name.slice(0, 200), storedName: stored, caption, uploadedBy: s.userId }).returning();
  return a;
}

export async function listAttachments(tx: Tx, entity: AttachEntity, entityId: string) {
  return tx.select().from(attachments).where(and(eq(attachments.entity, entity), eq(attachments.entityId, entityId))).orderBy(desc(attachments.createdAt));
}

export async function removeAttachment(tx: Tx, s: SchoolSession, id: string) {
  const [a] = await tx.select().from(attachments).where(eq(attachments.id, id));
  if (!a) throw new UserError("Lampiran tidak ditemukan");
  if (a.uploadedBy !== s.userId && !hasAnyRole(s.roles, ["ADMIN"])) throw new UserError("Hanya pengunggah atau Admin yang bisa menghapus lampiran");
  await tx.delete(attachments).where(eq(attachments.id, id));
  return a;
}
