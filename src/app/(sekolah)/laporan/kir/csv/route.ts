import { AccessError, requireSchoolUser, withSchool } from "@/lib/tenant";
import { todayWita } from "@/lib/server/ledger";
import { kirData } from "@/lib/server/reports";
import { csvResponse } from "@/lib/server/csv";
import { periodFrom } from "../../params";

export async function GET(req: Request) {
  let s;
  try { s = await requireSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]); } catch (e) { if (e instanceof AccessError) return new Response("Tidak berwenang", { status: 403 }); throw e; }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const per = periodFrom(sp, todayWita());
  const roomId = /^[0-9a-f-]{36}$/.test(sp.ruang ?? "") ? sp.ruang : null;
  if (!roomId) return new Response("Ruangan tidak valid", { status: 400 });
  const k = await withSchool(s.schoolId, (tx) => kirData(tx, roomId, per.asOf));
  if (!k) return new Response("Tidak ditemukan", { status: 404 });
  return csvResponse(`KIR ${k.room.name} ${per.label}.csv`, [
    [`Kartu Inventaris Ruangan — ${k.room.name} — ${per.label} (posisi ${per.asOf})`],
    ["No", "Kode Barang", "Nomor Register", "Nama Barang", "Merk/Tipe", "Tahun", "Jumlah", "Harga Perolehan (Rp)", "Baik", "Rusak Ringan", "Rusak Berat", "Keterangan"],
    ...k.rows.map((r, i) => [i + 1, r.bmdCode, r.regNos, r.name, r.brand ?? "", r.year, r.qty, r.total, r.baik, r.rr, r.rb, r.ekstra ? `${r.ekstra} ekstrakomptabel` : ""]),
    ["", "", "", "Jumlah", "", "", k.units, k.total],
  ]);
}
