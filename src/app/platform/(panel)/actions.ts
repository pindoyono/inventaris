"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformLogs, schools } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/tenant";
import { clientIp } from "@/lib/server/request";
import { signOut } from "@/auth";
import { formToObject, schoolStatusChangeSchema } from "@/lib/validations";
import { notifyStatusChange } from "@/lib/server/notify";

export type StatusState = { error?: string; ok?: string };

const ACTION_LABEL = { ACTIVE: "SETUJUI", REJECTED: "TOLAK", SUSPENDED: "NONAKTIFKAN" } as const;

export async function changeSchoolStatus(_prev: StatusState, fd: FormData): Promise<StatusState> {
  const admin = await requirePlatformAdmin();
  const parsed = schoolStatusChangeSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: "Data tidak valid" };
  const { schoolId, status, note } = parsed.data;
  if (status !== "ACTIVE" && !note) return { error: "Alasan wajib diisi untuk menolak atau menonaktifkan" };

  const ip = await clientIp();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(schools).where(eq(schools.id, schoolId)).for("update");
    if (!before) return { error: "Sekolah tidak ditemukan" };
    if (before.status === status) return { error: "Status sudah sama" };
    await tx
      .update(schools)
      .set({
        status,
        statusNote: note ?? null,
        updatedAt: new Date(),
        ...(status === "ACTIVE" && !before.approvedAt ? { approvedAt: new Date() } : {}),
      })
      .where(eq(schools.id, schoolId));
    await tx.insert(platformLogs).values({
      adminId: admin.adminId,
      action: ACTION_LABEL[status],
      schoolId,
      detail: { from: before.status, to: status, note: note ?? null, npsn: before.npsn },
      ip,
    });
    return { ok: `${before.shortName}: ${before.status} → ${status}`, school: before };
  });

  revalidatePath("/platform");
  if (!("school" in result) || !result.school) return result;
  const { school } = result;
  const emailed = await notifyStatusChange(school, status, note ?? null, status === "ACTIVE" && !school.approvedAt);
  const msg = result.ok + (school.contactEmail ? (emailed ? " · email pemberitahuan terkirim" : " · email GAGAL terkirim (cek journal)") : " · tanpa email (PJ tidak mengisi email)");
  // Kartu sekolah pindah tab setelah status berubah, jadi hasilnya ditampilkan sebagai banner halaman
  redirect(`/platform?status=${school.status}&hasil=${encodeURIComponent(msg)}`);
}

export async function platformSignOut() {
  await signOut({ redirectTo: "/platform/login" });
}
