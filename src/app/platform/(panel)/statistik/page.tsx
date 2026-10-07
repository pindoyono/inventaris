import type { Metadata } from "next";
import Link from "next/link";
import { pagePlatformAdmin } from "@/lib/server/guard";
import { schoolStats } from "@/lib/server/platform-stats";
import { fmtRp } from "@/lib/decimal";

export const metadata: Metadata = { title: "Statistik sekolah · Pengelola", robots: { index: false } };
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

export default async function StatistikPage() {
  await pagePlatformAdmin();
  const rows = await schoolStats();
  const tot = rows.reduce((a, r) => ({ users: a.users + r.users, assets: a.assets + r.assets, av: a.av + r.assetValue, sv: a.sv + r.supplyValue }), { users: 0, assets: 0, av: 0n, sv: 0n });
  const cell = "px-3 py-2";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Statistik pemakaian sekolah</h1>
        <Link href="/platform" className="text-sm text-teal-700 hover:underline">← Pendaftaran sekolah</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Sekolah aktif", rows.length], ["Pengguna", tot.users], ["Unit aset", tot.assets], ["Nilai aset intra (Rp)", fmtRp(tot.av)]].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xl font-semibold">{v}</div><div className="text-sm text-slate-600">{l}</div></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className={cell}>Sekolah</th><th className={`${cell} text-right`}>Pengguna (aktif 30 hr)</th><th className={`${cell} text-right`}>2FA</th><th className={`${cell} text-right`}>Unit aset</th><th className={`${cell} text-right`}>Nilai aset intra (Rp)</th><th className={`${cell} text-right`}>Persediaan (Rp)</th><th className={`${cell} text-right`}>Dok. stok bln ini</th><th className={`${cell} text-right`}>Menunggu</th><th className={cell}>Aktivitas terakhir</th><th className={cell}>Data</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-500">Belum ada sekolah aktif.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cell}>{r.name}<span className="block font-mono text-xs text-slate-500">{r.npsn}{!r.setupDone && " · penyiapan belum selesai"}</span></td>
                <td className={`${cell} text-right`}>{r.users} ({r.activeUsers30})</td>
                <td className={`${cell} text-right`}>{r.twoFa}</td>
                <td className={`${cell} text-right`}>{r.assets}</td>
                <td className={`${cell} text-right`}>{fmtRp(r.assetValue)}</td>
                <td className={`${cell} text-right`}>{fmtRp(r.supplyValue)}</td>
                <td className={`${cell} text-right`}>{r.docsMonth}</td>
                <td className={`${cell} text-right`}>{r.pending}</td>
                <td className={cell}>{r.lastActivity ? fmt.format(r.lastActivity) : "—"}</td>
                <td className={cell}><a href={`/platform/ekspor/${r.id}`} className="text-teal-700 hover:underline">Ekspor Excel</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Ekspor berisi KIB A–F & ATB per register, persediaan, pengguna (tanpa kata sandi), ruangan, dan log aktivitas — untuk portabilitas data atau pendampingan. Setiap ekspor tercatat di log platform.</p>
    </div>
  );
}
