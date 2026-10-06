"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { kirStatus, saveKirSnapshot } from "@/lib/server/kir";
import { todayWita } from "@/lib/server/ledger";

export async function markKirPrinted(roomId: string): Promise<FormState> {
  if (!z.uuid().safeParse(roomId).success) return { errors: { _form: "Tidak valid" } };
  const res = await runSchoolAction(["ADMIN", "PETUGAS"], async (tx, s) => {
    const id = await saveKirSnapshot(tx, s, roomId, todayWita());
    await logActivity(tx, s, "KIR_DICETAK", "kir", id, null, { roomId });
    return { ok: "KIR diarsipkan sebagai versi tercetak & ditempel." };
  });
  revalidatePath("/laporan", "layout");
  return res;
}

/** Arsipkan sekaligus KIR semua ruangan yang perlu diperbarui (setelah dicetak lewat "Cetak semua") */
export async function markAllKirPrinted(): Promise<FormState> {
  const res = await runSchoolAction(["ADMIN", "PETUGAS"], async (tx, s) => {
    const today = todayWita();
    const need = (await kirStatus(tx, today)).filter((r) => r.reasons.length);
    for (const r of need) await saveKirSnapshot(tx, s, r.roomId, today);
    await logActivity(tx, s, "KIR_DICETAK", "kir", null, null, { rooms: need.length });
    return { ok: need.length ? `${need.length} KIR ruangan diarsipkan.` : "Semua KIR sudah mutakhir." };
  });
  revalidatePath("/laporan", "layout");
  return res;
}
