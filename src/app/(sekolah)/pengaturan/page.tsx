import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { schools } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { setupStatus } from "./status";
import { CompleteButton } from "./forms";

export const metadata: Metadata = { title: "Penyiapan" };

export default async function PengaturanPage() {
  const s = await pageSchoolUser(["ADMIN"]);
  const { steps, completedAt } = await withSchool(s.schoolId, async (tx) => {
    const [school] = await tx.select({ completedAt: schools.setupCompletedAt }).from(schools).where(eq(schools.id, s.schoolId));
    return { ...(await setupStatus(tx)), completedAt: school.completedAt };
  });
  const ready = steps.every((x) => !x.required || x.done);

  return (
    <div className="max-w-3xl">
      <PageTitle title="Penyiapan sekolah" desc="Lengkapi langkah berikut sebelum mulai mencatat barang. Semua bisa diubah kembali kapan saja." />
      <ol className="space-y-3">
        {steps.map((st, i) => (
          <li key={st.key}>
            <Link href={st.href} className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${st.done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                {st.done ? "✓" : i + 1}
              </span>
              <span className="space-y-0.5">
                <span className="block font-medium">
                  {st.title} {!st.required && <span className="text-xs font-normal text-slate-500">(opsional)</span>}
                </span>
                <span className="block text-sm text-slate-600">{st.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        {completedAt ? (
          <p className="text-sm text-emerald-700">Penyiapan sudah ditandai selesai.</p>
        ) : (
          <CompleteButton disabled={!ready} />
        )}
      </div>
    </div>
  );
}
