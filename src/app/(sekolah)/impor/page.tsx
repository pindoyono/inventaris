import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { importJobs } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { IMPORT_SPECS, type ImportKind } from "@/lib/server/impor/spec";
import { PageTitle } from "@/components/ui";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Impor Excel" };
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });
const ORDER: ImportKind[] = ["ruangan", "pengguna", "aset", "persediaan"];

export default async function ImporPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const jobs = await withSchool(s.schoolId, (tx) => tx.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(20));
  const kinds = ORDER.filter((k) => k !== "pengguna" || hasAnyRole(s.roles, ["ADMIN"]));
  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle title="Impor data dari Excel" desc="Unduh template, isi (atau tempel dari KIB/KIR lama), lalu unggah. Data dicek per baris dan ditampilkan dulu sebelum disimpan." />
      <ol className="grid gap-3 sm:grid-cols-2">
        {kinds.map((k, i) => (
          <li key={k} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="font-medium">{i + 1}. {IMPORT_SPECS[k].title}</div>
            <p className="mt-1 text-slate-600">{IMPORT_SPECS[k].desc}</p>
            <a href={`/impor/template/${k}`} className="mt-2 inline-block font-medium text-teal-700 hover:underline">Unduh template .xlsx</a>
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-600">Urutan yang disarankan: ruangan → pengguna → aset → persediaan (aset merujuk nama ruangan; pengguna merujuk unit).</p>
      <UploadForm kinds={kinds.map((k) => ({ k, title: IMPORT_SPECS[k].title }))} />
      {jobs.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Riwayat impor</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <Link href={`/impor/${j.id}`} className="text-teal-800 hover:underline">{IMPORT_SPECS[j.kind as ImportKind]?.title} · {j.fileName}</Link>
                <span className="text-slate-500">{j.status === "SELESAI" ? `selesai · ${(j.result as { created?: number })?.created ?? 0} dibuat` : `pratinjau · ${j.rows.length} baris`} · {fmt.format(j.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
