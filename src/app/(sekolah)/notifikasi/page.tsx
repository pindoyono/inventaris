import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { notifications } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { MarkAllRead } from "./mark-all";

export const metadata: Metadata = { title: "Notifikasi" };
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export default async function NotifikasiPage() {
  const s = await pageSchoolUser();
  const rows = await withSchool(s.schoolId, (tx) =>
    tx.select().from(notifications).where(and(eq(notifications.userId, s.userId))).orderBy(desc(notifications.id)).limit(100),
  );
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Notifikasi" desc="Email juga dikirim bila alamat email Anda diisi di akun (minta Admin Sekolah)." />
      {unread > 0 && <MarkAllRead />}
      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Belum ada notifikasi.</li>}
        {rows.map((n) => (
          <li key={n.id}>
            <a href={`/notifikasi/buka/${n.id}`} className={`block px-4 py-3 text-sm hover:bg-slate-50 ${n.readAt ? "text-slate-500" : ""}`}>
              <span className="flex justify-between gap-3">
                <span className={n.readAt ? "" : "font-semibold text-slate-900"}>{!n.readAt && <span className="mr-2 inline-block size-2 rounded-full bg-teal-600" />}{n.title}</span>
                <span className="shrink-0 text-xs text-slate-500">{fmt.format(n.createdAt)}</span>
              </span>
              {n.body && <span className="mt-0.5 block text-slate-600">{n.body}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
