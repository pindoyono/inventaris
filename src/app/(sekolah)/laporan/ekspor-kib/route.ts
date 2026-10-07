import { AccessError, requireSchoolUser, withSchool } from "@/lib/tenant";
import { workbookResponse } from "@/lib/server/csv";
import { kibSheets, persediaanSheet } from "@/lib/server/ekspor";
import { todayWita } from "@/lib/server/ledger";

/** Ekspor KIB A–F, ATB & persediaan per register dalam satu .xlsx (rekonsiliasi dengan aplikasi BMD Pemda) */
export async function GET() {
  let s;
  try { s = await requireSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 403 }); throw e; }
  const sheets = await withSchool(s.schoolId, async (tx) => [...(await kibSheets(tx, s.schoolId)), await persediaanSheet(tx)]);
  return workbookResponse(`KIB lengkap ${s.npsn} ${todayWita()}`, sheets);
}
