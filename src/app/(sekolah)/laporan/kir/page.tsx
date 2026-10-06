import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { loadRegisterParts } from "@/lib/server/register";
import { kirData } from "@/lib/server/reports";
import { fmtRp } from "@/lib/decimal";
import { ReportHeader, td, th } from "../shared";
import { PeriodForm } from "../period-form";
import { periodFrom, str } from "../params";

export const metadata: Metadata = { title: "KIR" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function KirPage({ searchParams }: PageProps<"/laporan/kir">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const sp = await searchParams;
  const per = periodFrom(sp, todayWita());
  const data = await withSchool(s.schoolId, async (tx) => {
    const roomList = await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name));
    const roomId = roomList.some((r) => r.id === str(sp.ruang)) ? str(sp.ruang) : roomList[0]?.id;
    return { roomList, roomId, kir: roomId ? await kirData(tx, roomId, per.asOf) : null, parts: await loadRegisterParts(tx, s.schoolId) };
  });
  const k = data.kir;
  const qs = new URLSearchParams({ ruang: data.roomId ?? "", tahun: String(per.year), semester: per.sem });

  return (
    <div>
      <ReportHeader parts={data.parts} title="Kartu Inventaris Ruangan (KIR)" subtitle={`${per.label} · posisi per ${fmtDate(per.asOf)}`} csv={k ? `/laporan/kir/csv?${qs}` : undefined} print={k ? `/cetak/kir?${qs}` : undefined}>
        <PeriodForm year={per.year} sem={per.sem}>
          <select name="ruang" defaultValue={data.roomId} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
            {data.roomList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </PeriodForm>
      </ReportHeader>
      {!k ? (
        <p className="text-sm text-slate-500">Belum ada ruangan. Tambahkan di Data Dasar.</p>
      ) : (
        <>
          <p className="mb-2 text-sm">
            Ruangan: <strong>{k.room.name}</strong>{k.room.building ? ` (${k.room.building}${k.room.floor ? `, lantai ${k.room.floor}` : ""})` : ""} · Penanggung jawab: {k.room.picName ?? "—"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white text-sm">
              <thead className="bg-slate-50 text-center">
                <tr>
                  <th rowSpan={2} className={th}>No</th><th rowSpan={2} className={th}>Kode Barang</th><th rowSpan={2} className={th}>Nomor Register</th>
                  <th rowSpan={2} className={th}>Nama Barang</th><th rowSpan={2} className={th}>Merk/Tipe</th><th rowSpan={2} className={th}>Tahun</th>
                  <th rowSpan={2} className={th}>Jumlah</th><th rowSpan={2} className={th}>Harga Perolehan (Rp)</th><th colSpan={3} className={th}>Kondisi</th><th rowSpan={2} className={th}>Ket.</th>
                </tr>
                <tr><th className={th}>B</th><th className={th}>RR</th><th className={th}>RB</th></tr>
              </thead>
              <tbody>
                {k.rows.length === 0 && <tr><td colSpan={12} className={`${td} py-6 text-center text-slate-500`}>Tidak ada barang di ruangan ini pada tanggal tersebut.</td></tr>}
                {k.rows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} font-mono text-xs whitespace-nowrap`}>{r.bmdCode}</td>
                    <td className={`${td} font-mono text-xs`}>{r.regNos}</td>
                    <td className={td}>{r.name}{r.codeName && r.codeName.toLowerCase() !== r.name.toLowerCase() && <span className="block text-xs text-slate-500">{r.codeName}</span>}</td>
                    <td className={td}>{r.brand ?? "-"}</td>
                    <td className={`${td} text-center`}>{r.year}</td>
                    <td className={`${td} text-right`}>{r.qty}</td>
                    <td className={`${td} text-right`}>{fmtRp(r.total)}</td>
                    <td className={`${td} text-center`}>{r.baik || ""}</td>
                    <td className={`${td} text-center`}>{r.rr || ""}</td>
                    <td className={`${td} text-center`}>{r.rb || ""}</td>
                    <td className={`${td} text-xs`}>{r.ekstra ? (r.ekstra === r.qty ? "Ekstrakomptabel" : `${r.ekstra} ekstrakomptabel`) : ""}</td>
                  </tr>
                ))}
              </tbody>
              {k.rows.length > 0 && (
                <tfoot className="font-medium">
                  <tr><td colSpan={6} className={`${td} text-right`}>Jumlah</td><td className={`${td} text-right`}>{k.units}</td><td className={`${td} text-right`}>{fmtRp(k.total)}</td>
                    <td className={`${td} text-center`}>{k.rows.reduce((a, r) => a + r.baik, 0)}</td><td className={`${td} text-center`}>{k.rows.reduce((a, r) => a + r.rr, 0)}</td><td className={`${td} text-center`}>{k.rows.reduce((a, r) => a + r.rb, 0)}</td><td className={td} /></tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">B = Baik, RR = Rusak Ringan, RB = Rusak Berat. KIR dibuat rangkap 2 dan diperbarui tiap semester serta setiap ada perpindahan barang.</p>
        </>
      )}
    </div>
  );
}
