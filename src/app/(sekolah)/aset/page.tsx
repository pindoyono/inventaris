import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { assets, rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { CONDITION_LABEL, KIB_LABEL } from "@/lib/assets-shared";
import { fmtRp } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { AssetTable } from "./asset-table";
import { AsetTabs } from "./tabs";

export const metadata: Metadata = { title: "Aset" };
const PER_PAGE = 100;

export default async function AsetPage({ searchParams }: PageProps<"/aset">) {
  const s = await pageSchoolUser();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q").trim().slice(0, 80);
  const ruang = str("ruang");
  const kondisi = str("kondisi") in CONDITION_LABEL ? str("kondisi") : "";
  const kib = str("kib") in KIB_LABEL ? str("kib") : "";
  const jenis = ["intra", "ekstra"].includes(str("jenis")) ? str("jenis") : "";
  const batch = /^[0-9a-f-]{36}$/.test(str("batch")) ? str("batch") : "";
  const page = Math.max(1, Number(str("hal")) || 1);
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);

  const data = await withSchool(s.schoolId, async (tx) => {
    const conds: SQL[] = [ne(assets.status, "DIHAPUS")];
    if (q) {
      const e = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      conds.push(or(ilike(assets.name, e), ilike(assets.brand, e), ilike(assets.bmdCode, e), sql`lpad(${assets.regNo}::text, 6, '0') like ${e}`)!);
    }
    if (ruang === "kosong") conds.push(isNull(assets.roomId));
    else if (/^[0-9a-f-]{36}$/.test(ruang)) conds.push(eq(assets.roomId, ruang));
    if (kondisi) conds.push(eq(assets.condition, kondisi as "BAIK"));
    if (kib) conds.push(eq(assets.kib, kib));
    if (jenis) conds.push(eq(assets.isIntra, jenis === "intra"));
    if (batch) conds.push(eq(assets.batchId, batch));
    const where = and(...conds);
    const [sum] = await tx
      .select({
        n: count(),
        intraN: sql<number>`count(*) filter (where ${assets.isIntra})::int`,
        intraV: sql<string>`coalesce(sum(${assets.acqPrice}) filter (where ${assets.isIntra}), 0)`,
        ekstraV: sql<string>`coalesce(sum(${assets.acqPrice}) filter (where not ${assets.isIntra}), 0)`,
      })
      .from(assets)
      .where(where);
    const rows = await tx
      .select({
        id: assets.id, bmdCode: assets.bmdCode, regNo: assets.regNo, name: assets.name, brand: assets.brand, kib: assets.kib,
        acqDate: assets.acqDate, acqPrice: assets.acqPrice, isIntra: assets.isIntra, condition: assets.condition, status: assets.status, room: rooms.name,
      })
      .from(assets)
      .leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(where)
      .orderBy(asc(assets.bmdCode), asc(assets.regNo))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE);
    const roomOpts = await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name));
    return { sum, rows, roomOpts };
  });
  const pages = Math.ceil(data.sum.n / PER_PAGE);
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries({ q, ruang, kondisi, kib, jenis, batch }).filter(([, v]) => v)), ...o })}`;

  return (
    <div>
      <PageTitle title="Aset tetap" desc="Barang inventaris per unit dengan kode register BMD. Barang di bawah batas kapitalisasi tetap dicatat sebagai ekstrakomptabel." />
      <AsetTabs active="/aset" />
      {batch && (
        <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {data.sum.n} unit baru dicatat. <a href={`/cetak/label?batch=${batch}`} target="_blank" rel="noreferrer" className="font-medium underline">Cetak label</a> · <Link href="/aset" className="underline">Tampilkan semua aset</Link>
        </p>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xl font-semibold">{data.sum.n}</div><div className="text-sm text-slate-600">unit (sesuai filter)</div></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xl font-semibold">Rp{fmtRp(data.sum.intraV)}</div><div className="text-sm text-slate-600">intrakomptabel ({data.sum.intraN} unit)</div></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xl font-semibold">Rp{fmtRp(data.sum.ekstraV)}</div><div className="text-sm text-slate-600">ekstrakomptabel ({data.sum.n - data.sum.intraN} unit)</div></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 flex-wrap gap-2 text-sm">
          <input name="q" defaultValue={q} placeholder="Cari nama, merk, kode, no. register" className="min-w-52 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2" />
          <select name="ruang" defaultValue={ruang} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Semua ruangan</option>
            <option value="kosong">Belum ditempatkan</option>
            {data.roomOpts.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select name="kondisi" defaultValue={kondisi} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Semua kondisi</option>
            {Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select name="kib" defaultValue={kib} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Semua golongan</option>
            {Object.entries(KIB_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select name="jenis" defaultValue={jenis} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Intra & ekstra</option>
            <option value="intra">Intrakomptabel</option>
            <option value="ekstra">Ekstrakomptabel</option>
          </select>
          <button className="rounded-md border border-slate-300 bg-white px-4 py-2">Tampilkan</button>
        </form>
        {canEdit && <Link href="/aset/baru" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">+ Catat aset</Link>}
      </div>
      <AssetTable rows={data.rows} rooms={data.roomOpts} canEdit={canEdit} today={todayWita()} />
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-4 text-sm">
          {page > 1 && <Link href={qs({ hal: String(page - 1) })} className="text-teal-700 hover:underline">← Sebelumnya</Link>}
          <span className="text-slate-500">Halaman {page} dari {pages}</span>
          {page < pages && <Link href={qs({ hal: String(page + 1) })} className="text-teal-700 hover:underline">Berikutnya →</Link>}
        </div>
      )}
    </div>
  );
}
