"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { userRoles, users, userUnits, userWarehouses } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { fieldErrors, userSchema } from "@/lib/validations";

async function otherActiveAdmins(tx: Tx, exceptUserId: string) {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.role, "ADMIN"), eq(users.isActive, true), ne(users.id, exceptUserId)));
  return r.n;
}

export async function saveUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = {
    id: String(fd.get("id") ?? ""),
    name: String(fd.get("name") ?? ""),
    username: String(fd.get("username") ?? ""),
    nip: String(fd.get("nip") ?? ""),
    email: String(fd.get("email") ?? ""),
    roles: fd.getAll("roles").map(String),
    unitIds: fd.getAll("unitIds").map(String),
    warehouseIds: fd.getAll("warehouseIds").map(String),
    password: String(fd.get("password") ?? ""),
    isActive: fd.get("isActive") === "on",
  };
  const { password: _pw, ...echo } = raw;
  const values = { ...echo, roles: raw.roles.join(","), unitIds: raw.unitIds.join(","), warehouseIds: raw.warehouseIds.join(","), isActive: raw.isActive ? "on" : "" };
  const parsed = userSchema.safeParse(raw);
  if (!parsed.success) return { values, errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (!d.id && !d.password) return { values, errors: { password: "Password awal wajib diisi untuk pengguna baru" } };

  const res = await runSchoolAction(
    ["ADMIN"],
    async (tx, s) => {
      const base = { name: d.name, username: d.username, nip: d.nip ?? null, email: d.email ?? null, isActive: d.isActive };
      let userId = d.id || "";
      let before: unknown = null;
      if (userId) {
        const [old] = await tx.select().from(users).where(eq(users.id, userId));
        if (!old) return { errors: { _form: "Pengguna tidak ditemukan" } };
        const oldRoles = (await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId))).map((r) => r.role);
        before = { name: old.name, username: old.username, nip: old.nip, email: old.email, isActive: old.isActive, roles: oldRoles };
        const losesAdmin = oldRoles.includes("ADMIN") && old.isActive && (!d.roles.includes("ADMIN") || !d.isActive);
        if (losesAdmin && (await otherActiveAdmins(tx, userId)) === 0)
          return { errors: { _form: "Harus ada minimal satu Admin Sekolah yang aktif." } };
        await tx
          .update(users)
          .set({
            ...base,
            updatedAt: new Date(),
            // Reset password oleh admin → pengguna wajib menggantinya saat masuk
            ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12), mustChangePassword: true, failedLogins: 0, lockedUntil: null } : {}),
          })
          .where(eq(users.id, userId));
        await tx.delete(userRoles).where(eq(userRoles.userId, userId));
        await tx.delete(userUnits).where(eq(userUnits.userId, userId));
        await tx.delete(userWarehouses).where(eq(userWarehouses.userId, userId));
      } else {
        [{ id: userId }] = await tx
          .insert(users)
          .values({ ...base, schoolId: s.schoolId, passwordHash: await bcrypt.hash(d.password!, 12), mustChangePassword: true })
          .returning({ id: users.id });
      }
      await tx.insert(userRoles).values(d.roles.map((role) => ({ schoolId: s.schoolId, userId, role })));
      if (d.unitIds.length) await tx.insert(userUnits).values(d.unitIds.map((unitId) => ({ schoolId: s.schoolId, userId, unitId })));
      if (d.warehouseIds.length)
        await tx.insert(userWarehouses).values(d.warehouseIds.map((warehouseId) => ({ schoolId: s.schoolId, userId, warehouseId })));

      await logActivity(tx, s, d.id ? "UBAH" : "TAMBAH", "user", userId, before, {
        ...base,
        roles: d.roles,
        unitIds: d.unitIds,
        warehouseIds: d.warehouseIds,
        passwordReset: !!(d.id && d.password),
      });
      return { ok: `Pengguna ${d.username} tersimpan.${d.password ? " Pengguna wajib mengganti password saat pertama masuk." : ""}` };
    },
    { unique: "Username sudah dipakai di sekolah ini." },
  );
  revalidatePath("/pengguna");
  return res.errors ? { ...res, values } : res;
}
