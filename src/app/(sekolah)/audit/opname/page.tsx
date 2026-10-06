import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { stockOpnames, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { PageTitle } from "@/components/ui";
import { StartForm } from "../start-forms";

export const metadata: Metadata = { title: "Stock Opname" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const OPNAME_LABEL = { DRAF: "Penghitungan", DIAJUKAN: "Menunggu persetujuan", DISETUJUI: "Disetujui", DIBATALKAN: "Dibatalkan" } as const;

export default async function OpnamePage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const { list, whs } = await withSchool(s.schoolId, async (tx) => ({
    list: await tx.select({ o: stockOpnames, wh: warehouses.name }).from(stockOpnames).innerJoin(warehouses, eq(warehouses.id, stockOpnames.warehouseId)).orderBy(desc(stockOpnames.createdAt)).limit(100),
    whs: await tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.isActive, true)).orderBy(asc(warehouses.name)),
  }));
  return (
    <div className="max-w-4xl space-y-4">
      <PageTitle title="Stock opname persediaan" desc="Selama penghitungan, gudang dibekukan: penerimaan, penyaluran, dan mutasi di gudang itu ditunda sampai opname disetujui atau dibatalkan." back={{ href: "/audit", label: "Audit" }} />
      {hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]) && <StartForm kind="opname" options={whs} />}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Nomor</th><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Gudang</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Belum ada stock opname.</td></tr>}
            {list.map(({ o, wh }) => (
              <tr key={o.id}>
                <td className="px-3 py-2"><Link href={`/audit/opname/${o.id}`} className="font-medium text-teal-800 hover:underline">{o.number}</Link></td>
                <td className="px-3 py-2">{fmtDate(o.date)}</td><td className="px-3 py-2">{wh}</td><td className="px-3 py-2">{OPNAME_LABEL[o.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
