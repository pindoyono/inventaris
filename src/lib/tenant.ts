import "server-only";
import { eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { schools, userRoles, users } from "@/db/schema";
import { auth } from "@/auth";
import { hasAnyRole, type Role } from "@/lib/roles";
import { withSchool } from "@/lib/tenant-core";

export { withSchool };

export class AccessError extends Error {
  constructor(public readonly reason: "UNAUTHENTICATED" | "FORBIDDEN" | "SCHOOL_INACTIVE") {
    super(reason);
  }
}

export type SchoolSession = {
  userId: string;
  userName: string;
  schoolId: string;
  npsn: string;
  roles: Role[];
  mustChangePassword: boolean;
};

/**
 * Ambil sesi pengguna sekolah dan pastikan sekolah masih ACTIVE serta pengguna masih aktif.
 * Peran dibaca ulang dari database setiap request (JWT tetap berlaku 12 jam setelah perubahan).
 * `roles` kosong = semua peran sekolah boleh.
 */
export async function requireSchoolUser(roles: Role[] = []): Promise<SchoolSession> {
  const session = await auth();
  const u = session?.user;
  if (!u || u.kind !== "school" || !u.schoolId) throw new AccessError("UNAUTHENTICATED");

  const [school] = await db.select({ status: schools.status }).from(schools).where(eq(schools.id, u.schoolId));
  if (school?.status !== "ACTIVE") throw new AccessError("SCHOOL_INACTIVE");

  const fresh = await withSchool(u.schoolId, async (tx) => {
    const [row] = await tx
      .select({ name: users.name, isActive: users.isActive, mustChangePassword: users.mustChangePassword })
      .from(users)
      .where(eq(users.id, u.id));
    if (!row?.isActive) return null;
    const r = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
    return { ...row, roles: r.map((x) => x.role) };
  });
  if (!fresh) throw new AccessError("UNAUTHENTICATED");
  if (roles.length && !hasAnyRole(fresh.roles, roles)) throw new AccessError("FORBIDDEN");

  return {
    userId: u.id,
    userName: fresh.name,
    schoolId: u.schoolId,
    npsn: u.npsn ?? "",
    roles: fresh.roles,
    mustChangePassword: fresh.mustChangePassword,
  };
}

/** Gabungan: cek akses lalu jalankan dalam konteks RLS sekolah pengguna. */
export async function asSchoolUser<T>(roles: Role[], fn: (tx: Tx, s: SchoolSession) => Promise<T>): Promise<T> {
  const s = await requireSchoolUser(roles);
  return withSchool(s.schoolId, (tx) => fn(tx, s));
}

export async function requirePlatformAdmin() {
  const session = await auth();
  const u = session?.user;
  if (!u || u.kind !== "platform") throw new AccessError("UNAUTHENTICATED");
  return { adminId: u.id, adminName: u.name ?? "" };
}
