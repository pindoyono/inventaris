import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, lt, ne, sql } from "drizzle-orm";
import { withSchool } from "@/lib/tenant";
import { activityLogs, assets, loans, stockBalances, supplyItems } from "@/db/schema";
import { Alert } from "@/components/ui";
import { hasAnyRole, ROLE_LABEL, type Role } from "@/lib/roles";
import { pageSchoolUser } from "@/lib/server/guard";
import { pendingForUser } from "@/lib/server/requests";
import { pendingProposals } from "@/lib/server/proposals";
import { kirStatus } from "@/lib/server/kir";
import { todayWita } from "@/lib/server/ledger";
import { fmtNum, fmtRp } from "@/lib/decimal";

export const metadata: Metadata = { title: "Dasbor" };
const fmtTs = new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Makassar" });

type Tile = { label: string; value: string; sub?: string; href: string; tone?: "warn" | "bad" };

export default async function DasborPage({ searchParams }: PageProps<"/dasbor">) {
  const { akses } = await searchParams;
  const s = await pageSchoolUser();
  const manager = hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const d = await withSchool(s.schoolId, async (tx) => {
    const base = { pending: await pendingForUser(tx, s), proposals: await pendingProposals(tx, s) };
    if (!manager) return { ...base, tiles: [] as Tile[], recent: [] };
    const now = new Date();
    const [a] = await tx
      .select({
        n: count(),
        intraV: sql<string>`coalesce(sum(${assets.acqPrice}) filter (where ${assets.isIntra}), 0)`,
        ekstraV: sql<string>`coalesce(sum(${assets.acqPrice}) filter (where not ${assets.isIntra}), 0)`,
        rb: sql<number>`count(*) filter (where ${assets.condition} = 'RUSAK_BERAT')::int`,
        hilang: sql<number>`count(*) filter (where ${assets.status} = 'HILANG')::int`,
        pinjam: sql<number>`count(*) filter (where ${assets.status} = 'DIPINJAM')::int`,
      })
      .from(assets)
      .where(ne(assets.status, "DIHAPUS"));
    const [stock] = await tx.select({ v: sql<string>`coalesce(sum(${stockBalances.value}), 0)` }).from(stockBalances);
    const low = await tx
      .select({ id: supplyItems.id })
      .from(supplyItems)
      .leftJoin(stockBalances, eq(stockBalances.itemId, supplyItems.id))
      .where(and(eq(supplyItems.isActive, true), sql`${supplyItems.minStock} > 0`))
      .groupBy(supplyItems.id)
      .having(sql`coalesce(sum(${stockBalances.qty}), 0) <= ${supplyItems.minStock}`);
    const [late] = await tx.select({ n: count() }).from(loans).where(and(eq(loans.status, "DIPINJAM"), lt(loans.dueAt, now)));
    const kir = (await kirStatus(tx, todayWita())).filter((r) => r.reasons.length).length;
    const recent = await tx.select().from(activityLogs).orderBy(desc(activityLogs.id)).limit(8);
    const tiles: Tile[] = [
      { label: "Nilai aset intrakomptabel", value: `Rp${fmtRp(a.intraV)}`, sub: `+ Rp${fmtRp(a.ekstraV)} ekstrakomptabel · ${fmtNum(a.n)} unit`, href: "/aset" },
      { label: "Nilai persediaan", value: `Rp${fmtRp(stock.v)}`, sub: "FIFO, semua gudang", href: "/persediaan" },
      { label: "Stok menipis", value: String(low.length), sub: low.length ? "di bawah stok minimum" : "semua aman", href: "/persediaan?f=menipis", tone: low.length ? "warn" : undefined },
      { label: "Peminjaman terlambat", value: String(late.n), sub: `${a.pinjam} unit sedang dipinjam`, href: "/peminjaman?tab=terlambat", tone: late.n ? "bad" : undefined },
      { label: "Aset rusak berat", value: String(a.rb), sub: a.hilang ? `${a.hilang} unit berstatus hilang` : "pertimbangkan usulan penghapusan", href: "/aset?kondisi=RUSAK_BERAT", tone: a.rb || a.hilang ? "warn" : undefined },
      { label: "KIR perlu diperbarui", value: String(kir), sub: kir ? "ruangan" : "semua ruangan mutakhir", href: "/laporan/kir/status", tone: kir ? "warn" : undefined },
    ];
    return { ...base, tiles, recent };
  });
  const toneCls = { warn: "border-amber-300", bad: "border-red-300" } as const;
  const toneTxt = { warn: "Perlu perhatian", bad: "Segera tindak lanjuti" } as const;

  return (
    <div className="space-y-6">
      {akses === "ditolak" && <Alert>Anda tidak memiliki akses ke halaman tersebut.</Alert>}
      <div>
        <h1 className="text-xl font-semibold">Selamat datang, {s.userName}</h1>
        <p className="text-sm text-slate-600">Peran: {s.roles.map((r) => ROLE_LABEL[r as Role] ?? r).join(", ")} · diperbarui otomatis</p>
      </div>
      {d.pending > 0 && (
        <Link href="/permintaan?tab=tugas" className="block rounded-lg border border-teal-600 bg-teal-50 p-4 hover:bg-teal-100">
          <span className="text-2xl font-semibold text-teal-900">{d.pending}</span> <span className="text-teal-900">permintaan barang menunggu tindakan Anda →</span>
        </Link>
      )}
      {d.proposals > 0 && (
        <Link href="/usulan?tab=tugas" className="block rounded-lg border border-violet-500 bg-violet-50 p-4 hover:bg-violet-100">
          <span className="text-2xl font-semibold text-violet-900">{d.proposals}</span> <span className="text-violet-900">usulan kebutuhan menunggu verifikasi/persetujuan Anda →</span>
        </Link>
      )}
      {d.tiles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.tiles.map((t) => (
            <Link key={t.label} href={t.href} className={`rounded-lg border bg-white p-4 hover:border-teal-600 ${t.tone ? toneCls[t.tone] : "border-slate-200"}`}>
              <div className="text-sm text-slate-600">{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{t.value}</div>
              {t.sub && <div className="text-xs text-slate-500">{t.sub}</div>}
              {t.tone && <div className={`mt-1 text-xs font-medium ${t.tone === "bad" ? "text-red-700" : "text-amber-800"}`}>⚠ {toneTxt[t.tone]}</div>}
            </Link>
          ))}
        </div>
      )}
      {d.recent.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Aktivitas terbaru</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {d.recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span><b>{r.action}</b> {r.entity.replaceAll("_", " ")} <span className="text-slate-500">· {r.userName}</span></span>
                <span className="text-slate-500">{fmtTs.format(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!manager && (
        <div className="grid gap-3 sm:grid-cols-3">
          {hasAnyRole(s.roles, ["PENGUSUL"]) && <Link href="/permintaan/baru" className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">Minta barang persediaan →</Link>}
          {hasAnyRole(s.roles, ["PENGUSUL"]) && <Link href="/usulan/baru" className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">Usulkan kebutuhan →</Link>}
          {hasAnyRole(s.roles, ["PEMINJAM"]) && <Link href="/peminjaman/baru" className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">Ajukan peminjaman →</Link>}
        </div>
      )}
    </div>
  );
}
