import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { activityLogs } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Log Aktivitas" };

const PER_PAGE = 50;
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Makassar" });

export default async function LogPage({ searchParams }: PageProps<"/log">) {
  const s = await pageSchoolUser(["ADMIN", "KEPSEK"]);
  const sp = await searchParams;
  const before = typeof sp.sebelum === "string" && /^\d+$/.test(sp.sebelum) ? Number(sp.sebelum) : null;
  const entity = typeof sp.entitas === "string" && /^[a-z_-]{1,40}$/.test(sp.entitas) ? sp.entitas : "";

  const rows = await withSchool(s.schoolId, (tx) => {
    const conds: SQL[] = [];
    if (before) conds.push(lt(activityLogs.id, before));
    if (entity) conds.push(eq(activityLogs.entity, entity));
    return tx.select().from(activityLogs).where(and(...conds)).orderBy(desc(activityLogs.id)).limit(PER_PAGE + 1);
  });
  const hasMore = rows.length > PER_PAGE;
  const list = rows.slice(0, PER_PAGE);

  return (
    <div>
      <PageTitle title="Log aktivitas" desc="Catatan perubahan data sekolah. Log tidak dapat diubah atau dihapus." />
      {entity && (
        <p className="mb-3 text-sm">
          Filter: <strong>{entity}</strong> · <Link href="/log" className="text-teal-700 hover:underline">hapus filter</Link>
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Waktu</th>
              <th className="px-3 py-2 font-medium">Pengguna</th>
              <th className="px-3 py-2 font-medium">Tindakan</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Rincian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {list.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Belum ada aktivitas.</td></tr>}
            {list.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{fmt.format(l.createdAt)}</td>
                <td className="px-3 py-2">{l.userName ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{l.action}</td>
                <td className="px-3 py-2"><Link href={`?entitas=${l.entity}`} className="text-teal-700 hover:underline">{l.entity}</Link></td>
                <td className="px-3 py-2">
                  {(l.before != null || l.after != null) && (
                    <details>
                      <summary className="cursor-pointer text-slate-600">lihat</summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {l.before != null && <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">Sebelum: {JSON.stringify(l.before, null, 1)}</pre>}
                        {l.after != null && <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">Sesudah: {JSON.stringify(l.after, null, 1)}</pre>}
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <Link href={`?${new URLSearchParams({ ...(entity ? { entitas: entity } : {}), sebelum: String(list.at(-1)!.id) })}`} className="mt-4 inline-block text-sm text-teal-700 hover:underline">
          Lebih lama →
        </Link>
      )}
    </div>
  );
}
