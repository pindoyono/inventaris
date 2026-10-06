import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { importJobs } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { IMPORT_SPECS, type ImportKind } from "@/lib/server/impor/spec";
import { PageTitle } from "@/components/ui";
import { ApplyPanel } from "./apply-panel";

export const metadata: Metadata = { title: "Pratinjau Impor" };

export default async function ImporDetailPage({ params, searchParams }: PageProps<"/impor/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const [job] = await withSchool(s.schoolId, (tx) => tx.select().from(importJobs).where(eq(importJobs.id, id)));
  if (!job) notFound();
  const spec = IMPORT_SPECS[job.kind as ImportKind];
  const bad = job.rows.filter((r) => r.errors.length);
  const show = sp.semua === "1" ? job.rows : bad.length ? bad : job.rows;
  const cols = spec.cols.filter((c) => job.rows.some((r) => r.data[c.key]));
  const result = job.result as { created?: number; detail?: string[]; valid?: number; skipped?: number } | null;
  return (
    <div className="space-y-4">
      <PageTitle title={`Impor ${spec.title.toLowerCase()}`} desc={`${job.fileName} · ${job.rows.length} baris: ${job.rows.length - bad.length} valid, ${bad.length} bermasalah`} back={{ href: "/impor", label: "Impor" }} />
      <ApplyPanel id={job.id} status={job.status} valid={job.rows.length - bad.length} bad={bad.length} result={result} />
      <div className="flex gap-3 text-sm">
        <a href="?" className={sp.semua === "1" ? "text-teal-700 hover:underline" : "font-medium"}>{bad.length ? "Baris bermasalah" : "Semua baris"}</a>
        {bad.length > 0 && <a href="?semua=1" className={sp.semua === "1" ? "font-medium" : "text-teal-700 hover:underline"}>Semua baris</a>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-2 py-1.5 font-medium">Baris</th><th className="px-2 py-1.5 font-medium">Status</th>{cols.map((c) => <th key={c.key} className="px-2 py-1.5 font-medium whitespace-nowrap">{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {show.slice(0, 500).map((r) => (
              <tr key={r.row} className={r.errors.length ? "bg-red-50" : ""}>
                <td className="px-2 py-1">{r.row}</td>
                <td className="px-2 py-1">{r.errors.length ? <span className="text-red-700">{r.errors.join("; ")}</span> : <span className="text-emerald-700">OK</span>}</td>
                {cols.map((c) => <td key={c.key} className="px-2 py-1 whitespace-nowrap">{c.key === "password" && r.data[c.key] ? "••••" : r.data[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {show.length > 500 && <p className="text-xs text-slate-500">Menampilkan 500 dari {show.length} baris.</p>}
    </div>
  );
}
