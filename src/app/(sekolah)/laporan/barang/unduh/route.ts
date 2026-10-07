import { AccessError, requireSchoolUser, withSchool } from "@/lib/tenant";
import { tableResponse } from "@/lib/server/csv";
import { todayWita } from "@/lib/server/ledger";
import { buildDoc, docToRows, isFormat, needsSemester } from "@/lib/server/laporan-docs";
import { parsePeriod } from "@/lib/period";

export async function GET(req: Request) {
  let s;
  try { s = await requireSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 403 }); throw e; }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  if (!isFormat(sp.format)) return new Response("Format tidak dikenal", { status: 400 });
  const p = parsePeriod(sp, todayWita());
  if (needsSemester(sp.format) && p.kind === "bulan") return new Response("Penyusutan per semester/tahun", { status: 400 });
  const ekstra = sp.jenis === "ekstra";
  const format = sp.format;
  const doc = await withSchool(s.schoolId, (tx) => buildDoc(tx, s.schoolId, p, format, ekstra));
  return tableResponse(`${format} ${doc.title} ${p.label}.csv`, docToRows(doc, [doc.title, doc.asOf ? `Keadaan per ${p.to}` : p.label, doc.ket]), sp.xlsx === "0" ? null : "xlsx");
}
