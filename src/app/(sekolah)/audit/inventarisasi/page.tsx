import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { assetInventories, rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { PageTitle } from "@/components/ui";
import { StartForm } from "../start-forms";

export const metadata: Metadata = { title: "Inventarisasi Aset" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const LABEL = { DRAF: "Pemeriksaan", SELESAI: "Selesai", DIBATALKAN: "Dibatalkan" } as const;

export default async function InventarisasiPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const { list, rms } = await withSchool(s.schoolId, async (tx) => ({
    list: await tx.select({ v: assetInventories, room: rooms.name }).from(assetInventories).innerJoin(rooms, eq(rooms.id, assetInventories.roomId)).orderBy(desc(assetInventories.createdAt)).limit(100),
    rms: await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name)),
  }));
  return (
    <div className="max-w-4xl space-y-4">
      <PageTitle title="Inventarisasi aset" desc="Periksa fisik barang per ruangan terhadap KIR. Tidak ditemukan → berstatus Hilang (tetap tercatat sampai ada SK penghapusan)." back={{ href: "/audit", label: "Audit" }} />
      {hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) && <StartForm kind="inventarisasi" options={rms} />}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Nomor</th><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Ruangan</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Belum ada inventarisasi.</td></tr>}
            {list.map(({ v, room }) => (
              <tr key={v.id}><td className="px-3 py-2"><Link href={`/audit/inventarisasi/${v.id}`} className="font-medium text-teal-800 hover:underline">{v.number}</Link></td><td className="px-3 py-2">{fmtDate(v.date)}</td><td className="px-3 py-2">{room}</td><td className="px-3 py-2">{LABEL[v.status]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
