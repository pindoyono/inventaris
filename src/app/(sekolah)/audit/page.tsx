import type { Metadata } from "next";
import Link from "next/link";
import { count, eq, inArray } from "drizzle-orm";
import { assetInventories, disposals, maintenances, stockOpnames } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Audit" };

export default async function AuditPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const c = await withSchool(s.schoolId, async (tx) => ({
    opname: (await tx.select({ n: count() }).from(stockOpnames).where(inArray(stockOpnames.status, ["DRAF", "DIAJUKAN"])))[0].n,
    inv: (await tx.select({ n: count() }).from(assetInventories).where(eq(assetInventories.status, "DRAF")))[0].n,
    disp: (await tx.select({ n: count() }).from(disposals).where(inArray(disposals.status, ["DRAF", "DIAJUKAN", "DIKIRIM"])))[0].n,
    maint: (await tx.select({ n: count() }).from(maintenances).where(eq(maintenances.status, "BERJALAN")))[0].n,
  }));
  const t = todayWita();
  const m = Number(t.slice(5, 7));
  const nearEnd = m === 6 || m === 12;
  const CARDS = [
    ["/audit/opname", "Stock opname persediaan", "Hitung fisik per gudang tiap semester (Permendagri 47/2021 Ps. 39). Selisih & barang rusak dibukukan setelah disetujui Kepala Sekolah.", c.opname, "berjalan"],
    ["/audit/inventarisasi", "Inventarisasi aset", "Cocokkan KIR dengan fisik per ruangan: ditemukan/tidak, kondisi, barang belum tercatat.", c.inv, "berjalan"],
    ["/audit/penghapusan", "Usulan penghapusan", "Usulan ke Dinas/BPKAD; barang dihapus setelah SK kepala daerah (Permendagri 19/2016 jo. 7/2024).", c.disp, "dalam proses"],
    ["/audit/pemeliharaan", "Pemeliharaan", "Kartu pemeliharaan per aset: rutin, perbaikan, peningkatan; biaya & sumber dana BOSP.", c.maint, "sedang dikerjakan"],
    ["/audit/rusak-usang", "Daftar persediaan rusak/usang", "Persediaan yang dikeluarkan karena rusak berat/usang (Ps. 38).", 0, ""],
  ] as const;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Audit & pemeliharaan" />
      {nearEnd && <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">Akhir semester: lakukan stock opname semua gudang dan perbarui KIR (inventarisasi ruangan).</p>}
      <div className="space-y-3">
        {CARDS.map(([href, title, desc, n, label]) => (
          <Link key={href} href={href} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">
            <span className="flex justify-between gap-2"><span className="font-medium">{title}</span>{n > 0 && <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">{n} {label}</span>}</span>
            <span className="mt-1 block text-sm text-slate-600">{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
