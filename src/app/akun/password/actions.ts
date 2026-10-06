"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { users } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { changePasswordSchema, fieldErrors, formToObject } from "@/lib/validations";

export async function changeOwnPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { current, password } = parsed.data;
  const res = await runSchoolAction([], async (tx, s) => {
    const [u] = await tx.select({ hash: users.passwordHash }).from(users).where(eq(users.id, s.userId));
    if (!u || !(await bcrypt.compare(current, u.hash))) return { errors: { current: "Password lama salah" } };
    await tx
      .update(users)
      .set({ passwordHash: await bcrypt.hash(password, 12), mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, s.userId));
    await logActivity(tx, s, "GANTI_PASSWORD", "user", s.userId);
    return { ok: "Password berhasil diganti." };
  });
  if (res.ok) redirect("/dasbor");
  return res;
}
