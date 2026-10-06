import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { assets, constructions, vendors } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { fmtRp, parseDec } from "@/lib/decimal";
import { CONSTRUCTION_STATUS_LABEL } from "@/lib/construction-shared";
import { PageTitle } from "@/components/ui";
import { AsetTabs } from "../tabs";

export const metadata: Metadata = { title: "KDP & Renovasi" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");
const CLS = { BERJALAN: "bg-sky-100 text-sky-800", DIHENTIKAN: "bg-red-100 text-red-800", SELESAI: "bg-emerald-100 text-emerald-800" } as const;

export default async function KdpPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const rows = await withSchool(s.schoolId, (tx) =>
    tx
      .select({ c: constructions, name: assets.name, code: assets.bmdCode, value: assets.acqPrice, vendor: vendors.name })
      .from(constructions)
      .innerJoin(assets, eq(assets.id, constructions.assetId))
      .leftJoin(vendors, eq(vendors.id, constructions.vendorId))
      .orderBy(desc(constructions.startDate)),
  );
  const open = rows.filter((r) => r.c.status !== "SELESAI");
  const kdpOpen = open.filter((r) => r.c.kind === "KDP").reduce((a, r) => a + parseDec(r.value), 0n);
  const btn = "rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800";
  return (
    <div>
      <PageTitle title="Aset tetap" desc="Konstruksi dalam pengerjaan (KIB F) dan renovasi atas aset milik pihak lain (aset tetap renovasi). Nilai bertambah dari setiap pembayaran; KDP yang selesai direklasifikasi ke aset definitif." />
      <AsetTabs active="/aset/kdp" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{open.length} pekerjaan belum selesai · nilai KDP berjalan <strong>Rp{fmtRp(kdpOpen)}</strong></p>
        {canEdit && (
          <div className="flex gap-2">
            <Link href="/aset/kdp/baru?jenis=KDP" className={btn}>+ Catat KDP</Link>
            <Link href="/aset/kdp/baru?jenis=ATR" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">+ Catat renovasi aset pihak lain</Link>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2 font-medium">Pekerjaan</th><th className="px-3 py-2 font-medium">Jenis</th><th className="px-3 py-2 font-medium">Kontrak</th><th className="px-3 py-2 font-medium">Mulai / target</th><th className="px-3 py-2 text-right font-medium">Progres</th><th className="px-3 py-2 text-right font-medium">Nilai tercatat (Rp)</th><th className="px-3 py-2 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Belum ada KDP atau renovasi.</td></tr>}
            {rows.map(({ c, name, code, value, vendor }) => (
              <tr key={c.id}>
                <td className="px-3 py-2"><Link href={`/aset/kdp/${c.id}`} className="font-medium text-teal-800 hover:underline">{name}</Link><span className="block font-mono text-xs text-slate-500">{code}</span></td>
                <td className="px-3 py-2">{c.kind === "KDP" ? "KDP" : `Renovasi · ${c.ownerName}`}</td>
                <td className="px-3 py-2">{c.contractNo ?? "—"}{vendor && <span className="block text-xs text-slate-500">{vendor} · Rp{fmtRp(c.contractValue)}</span>}</td>
                <td className="px-3 py-2">{fmtDate(c.startDate)}<span className="block text-xs text-slate-500">target {fmtDate(c.targetDate)}</span></td>
                <td className="px-3 py-2 text-right">{c.progress}%</td>
                <td className="px-3 py-2 text-right">{fmtRp(value)}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${CLS[c.status]}`}>{CONSTRUCTION_STATUS_LABEL[c.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
