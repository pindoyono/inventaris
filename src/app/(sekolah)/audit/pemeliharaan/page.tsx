import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { assets, maintenances } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { MAINT_KIND_LABEL } from "@/lib/server/maintenance";
import { fmtRp } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { FinishMaintenance } from "./finish";

export const metadata: Metadata = { title: "Pemeliharaan" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");

export default async function PemeliharaanPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const list = await withSchool(s.schoolId, (tx) =>
    tx
      .select({ m: maintenances, name: assets.name, regNo: assets.regNo, condition: assets.condition })
      .from(maintenances)
      .innerJoin(assets, eq(assets.id, maintenances.assetId))
      .orderBy(desc(maintenances.startDate), desc(maintenances.createdAt))
      .limit(200),
  );
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const running = list.filter((x) => x.m.status === "BERJALAN");
  const total = list.filter((x) => x.m.startDate.slice(0, 4) === todayWita().slice(0, 4)).reduce((a, x) => a + Number(x.m.cost), 0);
  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle
        title="Pemeliharaan"
        desc={`Kartu pemeliharaan per aset (Permendagri 47/2021 Ps. 40). Biaya tahun ini: Rp${fmtRp(total.toFixed(2))}. Catat pemeliharaan dari halaman aset atau tombol di bawah.`}
        back={{ href: "/audit", label: "Audit" }}
      />
      {canEdit && <Link href="/audit/pemeliharaan/baru" className="inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Catat pemeliharaan</Link>}
      {running.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Sedang dikerjakan</h2>
          <ul className="space-y-2">
            {running.map(({ m, name, regNo, condition }) => (
              <li key={m.id} className="rounded-lg border border-amber-300 bg-white p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span><Link href={`/aset/${m.assetId}`} className="font-medium text-teal-800 hover:underline">{name}</Link> <span className="font-mono text-xs text-slate-500">{String(regNo).padStart(6, "0")}</span> — {m.description}
                    <span className="block text-xs text-slate-500">{MAINT_KIND_LABEL[m.kind]} · mulai {fmtDate(m.startDate)}{m.executor ? ` · ${m.executor}` : ""}</span></span>
                </div>
                {canEdit && <FinishMaintenance id={m.id} today={todayWita()} cost={String(Number(m.cost))} condition={condition} upgrade={m.kind === "PENINGKATAN"} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 font-medium">Jenis</th><th className="px-3 py-2 font-medium">Uraian</th><th className="px-3 py-2 font-medium">Pelaksana</th><th className="px-3 py-2 text-right font-medium">Biaya (Rp)</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Belum ada catatan pemeliharaan.</td></tr>}
            {list.map(({ m, name, regNo }) => (
              <tr key={m.id}>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(m.startDate)}{m.endDate && m.endDate !== m.startDate ? ` – ${fmtDate(m.endDate)}` : ""}</td>
                <td className="px-3 py-2"><Link href={`/aset/${m.assetId}`} className="text-teal-800 hover:underline">{name}</Link> <span className="font-mono text-xs text-slate-500">{String(regNo).padStart(6, "0")}</span></td>
                <td className="px-3 py-2">{MAINT_KIND_LABEL[m.kind]}</td>
                <td className="px-3 py-2">{m.description}{m.status === "BERJALAN" && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">berjalan</span>}</td>
                <td className="px-3 py-2">{m.executor ?? "—"}</td>
                <td className="px-3 py-2 text-right">{fmtRp(m.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
