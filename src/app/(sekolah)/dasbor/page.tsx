import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";
import { withSchool } from "@/lib/tenant";
import { rooms, units, users, warehouses } from "@/db/schema";
import { Alert, Card } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { pageSchoolUser } from "@/lib/server/guard";
import { pendingForUser } from "@/lib/server/requests";

export const metadata: Metadata = { title: "Dasbor" };

export default async function DasborPage({ searchParams }: PageProps<"/dasbor">) {
  const { akses } = await searchParams;
  const s = await pageSchoolUser();
  const stats = await withSchool(s.schoolId, async (tx) => {
    const [[u], [r], [un], [w]] = await Promise.all([
      tx.select({ n: count() }).from(users),
      tx.select({ n: count() }).from(rooms),
      tx.select({ n: count() }).from(units),
      tx.select({ n: count() }).from(warehouses),
    ]);
    return { users: u.n, rooms: r.n, units: un.n, warehouses: w.n, pending: await pendingForUser(tx, s) };
  });

  return (
    <div className="space-y-6">
      {akses === "ditolak" && <Alert>Anda tidak memiliki akses ke halaman tersebut.</Alert>}
      <div>
        <h1 className="text-xl font-semibold">Selamat datang, {s.userName}</h1>
        <p className="text-sm text-slate-600">Peran: {s.roles.map((r) => ROLE_LABEL[r as Role] ?? r).join(", ")}</p>
      </div>
      {stats.pending > 0 && (
        <Link href="/permintaan?tab=tugas" className="block rounded-lg border border-teal-600 bg-teal-50 p-4 hover:bg-teal-100">
          <span className="text-2xl font-semibold text-teal-900">{stats.pending}</span>{" "}
          <span className="text-teal-900">permintaan barang menunggu tindakan Anda →</span>
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Pengguna", stats.users, "/pengguna"],
          ["Unit", stats.units, "/data-dasar/unit"],
          ["Ruangan", stats.rooms, "/data-dasar/ruangan"],
          ["Gudang", stats.warehouses, "/data-dasar/gudang"],
        ].map(([label, n, href]) => (
          <Link key={label} href={String(href)} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600">
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-sm text-slate-600">{label}</div>
          </Link>
        ))}
      </div>
      <Card title="Tahap pengembangan">
        <p className="text-sm text-slate-600">
          Tersedia: penyiapan & data dasar, persediaan FIFO, permintaan unit, aset per unit & label, peminjaman, audit (opname, inventarisasi, penghapusan, pemeliharaan), laporan, dan cetak dokumen sesuai format BMD.
        </p>
      </Card>
    </div>
  );
}
