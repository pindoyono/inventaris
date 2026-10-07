import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import type { Cell } from "@/lib/server/csv";

export type SchoolStat = {
  id: string; npsn: string; name: string; users: number; activeUsers30: number; assets: number; assetValue: bigint; supplyValue: bigint;
  docsMonth: number; lastActivity: Date | null; pending: number; setupDone: boolean; twoFa: number;
};

/** Statistik pemakaian per sekolah aktif (dibaca per sekolah lewat RLS) */
export async function schoolStats(): Promise<SchoolStat[]> {
  const list = await db.select().from(schools).where(eq(schools.status, "ACTIVE")).orderBy(asc(schools.name));
  const out: SchoolStat[] = [];
  for (const s of list) {
    const r = await withSchool(s.id, async (tx) => {
      const [row] = (await tx.execute(sql`select
        (select count(*)::int from users) users,
        (select count(*)::int from users where last_login_at > now() - interval '30 days') active30,
        (select count(*)::int from users where totp_enabled_at is not null) twofa,
        (select count(*)::int from assets where status <> 'DIHAPUS') assets,
        (select coalesce(sum(acq_price), 0)::text from assets where status <> 'DIHAPUS' and is_intra) asset_value,
        (select coalesce(sum(value), 0)::text from stock_balances) supply_value,
        (select count(*)::int from stock_docs where status = 'DIPOSTING' and date >= date_trunc('month', now())) docs_month,
        (select max(created_at) from activity_logs) last_activity,
        (select count(*)::int from supply_requests where status in ('DIAJUKAN','DITERUSKAN','DIVERIFIKASI','DISETUJUI')) + (select count(*)::int from proposals where status in ('DIAJUKAN','DIVERIFIKASI')) pending
      `)) as unknown as { users: number; active30: number; twofa: number; assets: number; asset_value: string; supply_value: string; docs_month: number; last_activity: Date | null; pending: number }[];
      return row;
    });
    out.push({
      id: s.id, npsn: s.npsn, name: s.name, users: r.users, activeUsers30: r.active30, assets: r.assets, assetValue: BigInt(Math.round(Number(r.asset_value) * 100)),
      supplyValue: BigInt(Math.round(Number(r.supply_value) * 100)), docsMonth: r.docs_month, lastActivity: r.last_activity ? new Date(r.last_activity) : null,
      pending: r.pending, setupDone: !!s.setupCompletedAt, twoFa: r.twofa,
    });
  }
  return out;
}

/** Lembar tambahan ekspor per sekolah: pengguna (tanpa hash), ruangan, log aktivitas */
export async function schoolExtraSheets(schoolId: string) {
  return withSchool(schoolId, async (tx) => {
    const us = [...(await tx.execute(sql`select u.username, u.name, u.nip, u.email, u.is_active, u.last_login_at, u.totp_enabled_at is not null as twofa,
      (select string_agg(role::text, ', ') from user_roles r where r.user_id = u.id) roles from users u order by u.name`))] as unknown as Record<string, unknown>[];
    const rs = [...(await tx.execute(sql`select r.name, r.code, b.name as building, r.floor, r.pic_name from rooms r left join buildings b on b.id = r.building_id order by r.name`))] as unknown as Record<string, unknown>[];
    const logs = [...(await tx.execute(sql`select created_at, user_name, action, entity from activity_logs order by id desc limit 2000`))] as unknown as Record<string, unknown>[];
    const str = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v));
    return [
      { name: "Pengguna", rows: [["Pengguna"], [], ["Username", "Nama", "NIP", "Email", "Peran", "Aktif", "2FA", "Terakhir masuk"], ...us.map((u) => [str(u.username), str(u.name), str(u.nip), str(u.email), str(u.roles), u.is_active ? "ya" : "tidak", u.twofa ? "ya" : "tidak", str(u.last_login_at)] as Cell[])] },
      { name: "Ruangan", rows: [["Ruangan"], [], ["Nama", "Kode", "Gedung", "Lantai", "Penanggung jawab"], ...rs.map((r) => [str(r.name), str(r.code), str(r.building), str(r.floor), str(r.pic_name)] as Cell[])] },
      { name: "Log aktivitas", rows: [["Log aktivitas (2.000 terakhir)"], [], ["Waktu", "Pengguna", "Aksi", "Data"], ...logs.map((l) => [str(l.created_at), str(l.user_name), str(l.action), str(l.entity)] as Cell[])] },
    ];
  });
}
