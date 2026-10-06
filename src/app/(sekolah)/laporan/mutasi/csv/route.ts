import { AccessError, requireSchoolUser, withSchool } from "@/lib/tenant";
import { todayWita } from "@/lib/server/ledger";
import { mutasiData } from "@/lib/server/reports";
import { csvResponse } from "@/lib/server/csv";
import { periodFrom } from "../../params";

export async function GET(req: Request) {
  let s;
  try { s = await requireSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 403 }); throw e; }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const per = periodFrom(sp, todayWita());
  const wh = /^[0-9a-f-]{36}$/.test(sp.gudang ?? "") ? sp.gudang : null;
  const m = await withSchool(s.schoolId, (tx) => mutasiData(tx, per.from, per.to, wh));
  return csvResponse(`Mutasi persediaan ${per.label}.csv`, [
    [`Laporan Mutasi Persediaan — ${per.label} (${per.from} s/d ${per.to})`],
    ["No", "NUSP", "Nama Barang", "Satuan", "Saldo Awal Jml", "Saldo Awal Rp", "Masuk Jml", "Masuk Rp", "Keluar Jml", "Keluar Rp", "Saldo Akhir Jml", "Saldo Akhir Rp"],
    ...m.rows.map((r, i) => [i + 1, r.nusp, r.name, r.uom, r.openQ, r.openV, r.inQ, r.inV, r.outQ, r.outV, r.closeQ, r.closeV]),
    ["", "", "Jumlah", "", "", m.totals.openV, "", m.totals.inV, "", m.totals.outV, "", m.totals.closeV],
  ]);
}
