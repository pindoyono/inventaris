import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { schoolSettings, units, userRoles, users, userUnits, userWarehouses, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { UserManager, type UserRow } from "./user-manager";

export const metadata: Metadata = { title: "Pengguna" };

export default async function PenggunaPage({ searchParams }: PageProps<"/pengguna">) {
  const s = await pageSchoolUser(["ADMIN"]);
  const { ubah } = await searchParams;
  const data = await withSchool(s.schoolId, async (tx) => {
    const [list, roles, uu, uw, unitOpts, whOpts, [st]] = await Promise.all([
      tx.select().from(users).orderBy(asc(users.name)),
      tx.select().from(userRoles),
      tx.select().from(userUnits),
      tx.select().from(userWarehouses),
      tx.select({ id: units.id, name: units.name }).from(units).where(eq(units.isActive, true)).orderBy(asc(units.name)),
      tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.isActive, true)).orderBy(asc(warehouses.name)),
      tx.select({ studentAccounts: schoolSettings.studentAccounts, unitLabel: schoolSettings.unitLabel }).from(schoolSettings),
    ]);
    const rows: UserRow[] = list.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      nip: u.nip,
      email: u.email,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      locked: !!(u.lockedUntil && u.lockedUntil > new Date()),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      roles: roles.filter((r) => r.userId === u.id).map((r) => r.role),
      unitIds: uu.filter((r) => r.userId === u.id).map((r) => r.unitId),
      warehouseIds: uw.filter((r) => r.userId === u.id).map((r) => r.warehouseId),
    }));
    return { rows, unitOpts, whOpts, settings: st };
  });
  const editing = typeof ubah === "string" ? (data.rows.find((r) => r.id === ubah) ?? null) : null;

  return (
    <div>
      <PageTitle
        title="Pengguna & peran"
        desc="Satu orang bisa memegang beberapa peran. Pengguna baru dan password yang direset wajib diganti saat pertama masuk."
      />
      <UserManager
        rows={data.rows}
        units={data.unitOpts}
        warehouses={data.whOpts}
        unitLabel={data.settings.unitLabel}
        studentAccounts={data.settings.studentAccounts}
        editing={editing}
        selfId={s.userId}
      />
    </div>
  );
}
