"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { schoolSettings } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { todayWita } from "@/lib/server/ledger";
import { formToObject } from "@/lib/validations";

const schema = z.object({
  until: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  reason: z.string().trim().max(300).optional(),
});

/** Tutup buku sampai tanggal tertentu; membuka kembali (mundur) wajib beralasan & tercatat di log */
export async function setBooksClosed(_prev: FormState, fd: FormData): Promise<FormState> {
  const p = schema.safeParse(formToObject(fd));
  if (!p.success) return { errors: { until: "Tanggal tidak valid" } };
  const until = p.data.until || null;
  if (until && until >= todayWita()) return { errors: { until: "Tanggal tutup buku harus sebelum hari ini" } };
  return runSchoolAction(["ADMIN", "KEPSEK"], async (tx, s) => {
    const [st] = await tx.select({ closed: schoolSettings.booksClosedUntil }).from(schoolSettings);
    const reopening = !!st.closed && (!until || until < st.closed);
    if (reopening && (p.data.reason ?? "").length < 10) return { errors: { reason: "Membuka kembali periode yang sudah ditutup wajib disertai alasan (minimal 10 karakter)" } };
    await tx.update(schoolSettings).set({ booksClosedUntil: until, updatedAt: new Date() });
    await logActivity(tx, s, reopening ? "BUKA_PERIODE" : "TUTUP_BUKU", "periode", null, { until: st.closed }, { until, reason: p.data.reason ?? null });
    revalidatePath("/pengaturan/tutup-buku");
    return { ok: until ? `Buku ditutup sampai ${until}.` : "Semua periode dibuka." };
  });
}
