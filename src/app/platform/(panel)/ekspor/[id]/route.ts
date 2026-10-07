import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformLogs, schools } from "@/db/schema";
import { AccessError, requirePlatformAdmin, withSchool } from "@/lib/tenant";
import { workbookResponse } from "@/lib/server/csv";
import { kibSheets, persediaanSheet } from "@/lib/server/ekspor";
import { schoolExtraSheets } from "@/lib/server/platform-stats";
import { clientIp } from "@/lib/server/request";
import { todayWita } from "@/lib/server/ledger";

/** Ekspor seluruh data inti satu sekolah (pengelola platform) */
export async function GET(_req: Request, { params }: RouteContext<"/platform/ekspor/[id]">) {
  let admin;
  try { admin = await requirePlatformAdmin(); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 403 }); throw e; }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Tidak ditemukan", { status: 404 });
  const [s] = await db.select().from(schools).where(eq(schools.id, id));
  if (!s) return new Response("Tidak ditemukan", { status: 404 });
  const sheets = await withSchool(id, async (tx) => [...(await kibSheets(tx, id)), await persediaanSheet(tx)]);
  const extra = await schoolExtraSheets(id);
  await db.insert(platformLogs).values({ adminId: admin.adminId, action: "EKSPOR_DATA", schoolId: id, detail: { sheets: sheets.length + extra.length }, ip: await clientIp() });
  return workbookResponse(`Data ${s.npsn} ${s.shortName} ${todayWita()}`, [...sheets, ...extra]);
}
