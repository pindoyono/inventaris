import { beforeAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, RLS_TABLES, rooms, units, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { pgCode } from "@/lib/server/activity";
import { makeSchool, owner, resetTestData } from "./helpers";

let A: string;
let B: string;

beforeAll(async () => {
  await resetTestData();
  A = (await makeSchool({ name: "SMA Negeri Tes A" })).schoolId;
  B = (await makeSchool({ name: "SMA Negeri Tes B" })).schoolId;
  await withSchool(A, (tx) => tx.insert(units).values({ schoolId: A, name: "Unit A" }));
  await withSchool(B, (tx) => tx.insert(units).values({ schoolId: B, name: "Unit B" }));
});


describe("katalog: semua tabel ber-school_id dilindungi RLS", () => {
  test("setiap tabel dengan kolom school_id ada di RLS_TABLES (kecuali platform_logs, qr_tokens, email_outbox, password_resets — diakses sebelum login, hanya hash token)", async () => {
    const rows = await owner`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'school_id' and table_name not in ('platform_logs', 'qr_tokens', 'email_outbox', 'password_resets')`;
    const withSchoolId = rows.map((r) => r.table_name as string).sort();
    expect(withSchoolId).toEqual([...RLS_TABLES].sort());
  });

  test("RLS aktif + FORCE + kebijakan sekolah_sendiri di setiap tabel", async () => {
    const rows = await owner`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity,
             exists(select 1 from pg_policies p where p.tablename = c.relname and p.policyname = 'sekolah_sendiri') as has_policy
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any(${[...RLS_TABLES]})`;
    expect(rows.length).toBe(RLS_TABLES.length);
    for (const r of rows) expect([r.relname, r.relrowsecurity, r.relforcerowsecurity, r.has_policy]).toEqual([r.relname, true, true, true]);
  });

  test("role aplikasi bukan superuser dan tidak BYPASSRLS", async () => {
    const [r] = await db.execute<{ rolsuper: boolean; rolbypassrls: boolean }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(r).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});

describe("isolasi data antar sekolah", () => {
  test("tanpa konteks sekolah tidak ada baris yang terlihat", async () => {
    expect(await db.select().from(users)).toEqual([]);
    expect(await db.select().from(units)).toEqual([]);
  });

  test("sekolah A hanya melihat datanya sendiri", async () => {
    const seen = await withSchool(A, (tx) => tx.select({ name: units.name, schoolId: units.schoolId }).from(units));
    expect(seen).toEqual([{ name: "Unit A", schoolId: A }]);
    const u = await withSchool(A, (tx) => tx.select({ schoolId: users.schoolId }).from(users));
    expect(u.every((r) => r.schoolId === A)).toBe(true);
  });

  test("sekolah A tidak bisa menyisipkan baris milik sekolah B", async () => {
    const res = await withSchool(A, (tx) => tx.insert(units).values({ schoolId: B, name: "Selundupan" })).then(() => "ok", pgCode);
    expect(res).toBe("42501"); // pelanggaran kebijakan RLS
  });

  test("sekolah A tidak bisa mengubah/menghapus baris sekolah B", async () => {
    const [unitB] = await withSchool(B, (tx) => tx.select().from(units));
    const upd = await withSchool(A, (tx) => tx.update(units).set({ name: "Diubah A" }).where(eq(units.id, unitB.id)).returning());
    const del = await withSchool(A, (tx) => tx.delete(units).where(eq(units.id, unitB.id)).returning());
    expect(upd).toEqual([]);
    expect(del).toEqual([]);
    const [still] = await withSchool(B, (tx) => tx.select().from(units).where(eq(units.id, unitB.id)));
    expect(still.name).toBe("Unit B");
  });

  test("sekolah A tidak bisa memindahkan barisnya ke sekolah B", async () => {
    const [unitA] = await withSchool(A, (tx) => tx.select().from(units));
    const res = await withSchool(A, (tx) => tx.update(units).set({ schoolId: B }).where(eq(units.id, unitA.id))).then(() => "ok", pgCode);
    expect(res).toBe("42501");
  });

  test("FK lintas sekolah ditolak walau id milik sekolah lain diketahui", async () => {
    const [unitB] = await withSchool(B, (tx) => tx.select().from(units));
    const res = await withSchool(A, (tx) => tx.insert(rooms).values({ schoolId: A, name: "Ruang Uji FK", unitId: unitB.id })).then(
      () => "ok",
      (e) => pgCode(e),
    );
    expect(res).toBe("23503");
  });

  test("konteks tidak bocor ke transaksi berikutnya di pool yang sama", async () => {
    await withSchool(A, (tx) => tx.select().from(units));
    const after = await db.execute<{ v: string | null }>(sql`select current_setting('app.school_id', true) as v`);
    expect([null, ""]).toContain(after[0].v);
  });
});

describe("log aktivitas tidak bisa diubah", () => {
  test("UPDATE dan DELETE ditolak", async () => {
    const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => pgCode(e));
    expect(await code(withSchool(A, (tx) => tx.update(activityLogs).set({ action: "PALSU" })))).toBe("42501");
    expect(await code(withSchool(A, (tx) => tx.delete(activityLogs)))).toBe("42501");
  });
});
