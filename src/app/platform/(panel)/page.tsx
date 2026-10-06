import type { Metadata } from "next";
import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformLogs, regions, schools } from "@/db/schema";
import { LEVEL_LABEL } from "@/lib/validations";
import { Alert } from "@/components/ui";
import { StatusForm } from "./status-form";

export const metadata: Metadata = { title: "Pengelola Platform", robots: { index: false } };

const STATUSES = [
  ["PENDING", "Menunggu"],
  ["ACTIVE", "Aktif"],
  ["REJECTED", "Ditolak"],
  ["SUSPENDED", "Nonaktif"],
] as const;
type Status = (typeof STATUSES)[number][0];

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export default async function PlatformPage({ searchParams }: PageProps<"/platform">) {
  const sp = await searchParams;
  const status: Status = STATUSES.some(([s]) => s === sp.status) ? (sp.status as Status) : "PENDING";

  const regency = alias(regions, "regency");
  const [counts, list, logs] = await Promise.all([
    db.select({ status: schools.status, n: count() }).from(schools).groupBy(schools.status),
    db
      .select({ s: schools, regencyName: regency.name, provinceName: regions.name })
      .from(schools)
      .innerJoin(regency, eq(regency.code, schools.regencyCode))
      .innerJoin(regions, eq(regions.code, schools.provinceCode))
      .where(eq(schools.status, status))
      .orderBy(desc(schools.createdAt))
      .limit(200),
    db
      .select({ l: platformLogs, schoolName: schools.shortName })
      .from(platformLogs)
      .leftJoin(schools, eq(schools.id, platformLogs.schoolId))
      .orderBy(desc(platformLogs.createdAt))
      .limit(15),
  ]);
  const n = Object.fromEntries(counts.map((c) => [c.status, c.n]));

  return (
    <div className="space-y-6">
      {typeof sp.hasil === "string" && <Alert tone="success">{sp.hasil.slice(0, 300)}</Alert>}
      <nav className="flex flex-wrap gap-2">
        {STATUSES.map(([s, label]) => (
          <Link
            key={s}
            href={`/platform?status=${s}`}
            className={`rounded-full px-3 py-1 text-sm ${s === status ? "bg-teal-700 text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}
          >
            {label} ({n[s] ?? 0})
          </Link>
        ))}
      </nav>

      {list.length === 0 && <p className="text-sm text-slate-500">Tidak ada sekolah dengan status ini.</p>}

      <div className="space-y-3">
        {list.map(({ s, regencyName, provinceName }) => (
          <article key={s.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <h2 className="text-base font-semibold">{s.name}</h2>
                <p className="text-slate-600">
                  NPSN <span className="font-mono">{s.npsn}</span> ·{" "}
                  <a
                    href={`https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/${s.npsn}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 hover:underline"
                  >
                    cek di Referensi Data ↗
                  </a>
                </p>
                <p className="text-slate-600">
                  {LEVEL_LABEL[s.level]} · {regencyName}, {provinceName} · kepemilikan {s.ownershipCode === "12" ? "kab/kota" : "provinsi"}
                </p>
                {s.address && <p className="text-slate-600">{s.address}</p>}
                <p className="text-slate-600">
                  PJ: {s.contactName} · {s.contactPhone}
                  {s.contactEmail ? ` · ${s.contactEmail}` : ""}
                </p>
                <p className="text-xs text-slate-500">Mendaftar {fmt.format(s.createdAt)}</p>
                {s.statusNote && <p className="text-xs text-amber-700">Catatan: {s.statusNote}</p>}
              </div>
              <StatusForm schoolId={s.id} status={s.status} />
            </div>
          </article>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Riwayat tindakan terakhir</h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
          {logs.length === 0 && <li className="px-4 py-2 text-slate-500">Belum ada.</li>}
          {logs.map(({ l, schoolName }) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
              <span>
                <strong>{l.action}</strong> {schoolName ?? "—"}
                {(l.detail as { note?: string } | null)?.note ? ` — ${(l.detail as { note: string }).note}` : ""}
              </span>
              <span className="text-slate-500">{fmt.format(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
