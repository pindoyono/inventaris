import type { Metadata } from "next";
import Link from "next/link";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { loadRegisterParts } from "@/lib/server/register";
import { kibData } from "@/lib/server/reports";
import { ACQUISITION_LABEL, KIB_ATTRS, KIB_LABEL } from "@/lib/assets-shared";
import { fmtRp } from "@/lib/decimal";
import { ReportHeader, td, th } from "../shared";
import { str } from "../params";

export const metadata: Metadata = { title: "KIB" };

export default async function KibPage({ searchParams }: PageProps<"/laporan/kib">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const sp = await searchParams;
  const gol = str(sp.gol) in KIB_LABEL ? str(sp.gol) : "B";
  const ekstra = str(sp.ekstra) === "1";
  const { kib, parts } = await withSchool(s.schoolId, async (tx) => ({ kib: await kibData(tx, gol, ekstra), parts: await loadRegisterParts(tx, s.schoolId) }));
  const attrs = KIB_ATTRS[gol] ?? [];
  const qs = new URLSearchParams({ gol, ...(ekstra ? { ekstra: "1" } : {}) });

  return (
    <div>
      <ReportHeader parts={parts} title={`Kartu Inventaris Barang (${KIB_LABEL[gol].replace(" — ", ") ")}`} subtitle={ekstra ? "Termasuk barang ekstrakomptabel" : "Intrakomptabel"} csv={`/laporan/kib/csv?${qs}`}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {Object.keys(KIB_LABEL).map((g) => (
            <Link key={g} href={`?gol=${g}${ekstra ? "&ekstra=1" : ""}`} className={`rounded-full px-3 py-1 ${g === gol ? "bg-slate-800 text-white" : "border border-slate-300 bg-white"}`}>{g}</Link>
          ))}
          <Link href={`?gol=${gol}${ekstra ? "" : "&ekstra=1"}`} className="ml-2 text-teal-700 hover:underline">{ekstra ? "Hanya intrakomptabel" : "Sertakan ekstrakomptabel"}</Link>
        </div>
      </ReportHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white text-sm">
          <thead className="bg-slate-50 text-center">
            <tr>
              <th className={th}>No</th><th className={th}>Kode Barang</th><th className={th}>Jenis/Nama Barang</th><th className={th}>Nomor Register</th><th className={th}>Merk/Tipe</th>
              {attrs.map((a) => <th key={a.key} className={th}>{a.label}</th>)}
              <th className={th}>Tahun</th><th className={th}>Asal-usul</th><th className={th}>Jumlah</th><th className={th}>Harga (Rp)</th><th className={th}>Ket.</th>
            </tr>
          </thead>
          <tbody>
            {kib.rows.length === 0 && <tr><td colSpan={10 + attrs.length} className={`${td} py-6 text-center text-slate-500`}>Tidak ada barang pada golongan ini.</td></tr>}
            {kib.rows.map((r, i) => (
              <tr key={i}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} font-mono text-xs whitespace-nowrap`}>{r.bmdCode}</td>
                <td className={td}>{r.codeName}{r.name.toLowerCase() !== r.codeName.toLowerCase() && <span className="block text-xs text-slate-500">{r.name}</span>}</td>
                <td className={`${td} font-mono text-xs`}>{r.regNos}</td>
                <td className={td}>{r.brand ?? "-"}</td>
                {attrs.map((a) => <td key={a.key} className={td}>{r.attrs[a.key] ?? "-"}</td>)}
                <td className={`${td} text-center`}>{r.year}</td>
                <td className={td}>{ACQUISITION_LABEL[r.acquisition] ?? r.acquisition}</td>
                <td className={`${td} text-right`}>{r.qty}</td>
                <td className={`${td} text-right`}>{fmtRp(r.total)}</td>
                <td className={`${td} text-xs`}>{[r.ekstra ? "Ekstrakomptabel" : "", r.note ?? ""].filter(Boolean).join("; ")}</td>
              </tr>
            ))}
          </tbody>
          {kib.rows.length > 0 && (
            <tfoot className="font-medium"><tr><td colSpan={7 + attrs.length} className={`${td} text-right`}>Jumlah</td><td className={`${td} text-right`}>{kib.units}</td><td className={`${td} text-right`}>{fmtRp(kib.total)}</td><td className={td} /></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
