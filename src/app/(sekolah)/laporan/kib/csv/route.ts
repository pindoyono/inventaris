import { AccessError, requireSchoolUser, withSchool } from "@/lib/tenant";
import { kibData } from "@/lib/server/reports";
import { tableResponse } from "@/lib/server/csv";
import { ACQUISITION_LABEL, KIB_ATTRS, KIB_LABEL } from "@/lib/assets-shared";

export async function GET(req: Request) {
  let s;
  try { s = await requireSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 403 }); throw e; }
  const sp = new URL(req.url).searchParams;
  const gol = (sp.get("gol") ?? "B") in KIB_LABEL ? sp.get("gol") ?? "B" : "B";
  const ekstra = sp.get("ekstra") === "1";
  const kib = await withSchool(s.schoolId, (tx) => kibData(tx, gol, ekstra));
  const attrs = KIB_ATTRS[gol] ?? [];
  return tableResponse(`KIB ${gol}${ekstra ? " (dengan ekstrakomptabel)" : ""}.csv`, [
    [KIB_LABEL[gol]],
    ["No", "Kode Barang", "Jenis/Nama Barang", "Nama di sekolah", "Nomor Register", "Merk/Tipe", ...attrs.map((a) => a.label), "Tahun", "Asal-usul", "Jumlah", "Harga (Rp)", "Intra/Ekstra", "Keterangan"],
    ...kib.rows.map((r, i) => [i + 1, r.bmdCode, r.codeName, r.name, r.regNos, r.brand ?? "", ...attrs.map((a) => r.attrs[a.key] ?? ""), r.year, ACQUISITION_LABEL[r.acquisition] ?? r.acquisition, r.qty, r.total, r.ekstra ? "Ekstrakomptabel" : "Intrakomptabel", r.note ?? ""]),
    ["", "", "Jumlah", "", "", "", ...attrs.map(() => ""), "", "", kib.units, kib.total],
  ], new URL(req.url).searchParams.get("format"));
}
