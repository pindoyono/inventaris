"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { notifications } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";

export async function markAllRead(_prev: FormState): Promise<FormState> {
  const res = await runSchoolAction([], async (tx, s) => {
    await tx.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, s.userId), isNull(notifications.readAt)));
    return { ok: "Semua ditandai sudah dibaca." };
  });
  revalidatePath("/", "layout");
  return res;
}
