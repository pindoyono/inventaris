import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";
import { withSchool } from "@/lib/tenant";
import { rooms, units, users, warehouses } from "@/db/schema";
import { Alert, Card } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { pageSchoolUser } from "@/lib/server/guard";

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
    return { users: u.n, rooms: r.n, units: un.n, warehouses: w.n };
  });

  return (
    <div className="space-y-6">
      {akses === "ditolak" && <Alert>Anda tidak memiliki akses ke halaman tersebut.</Alert>}
      <div>
        <h1 className="text-xl font-semibold">Selamat datang, {s.userName}</h1>
        <p className="text-sm text-slate-600">Peran: {s.roles.map((r) => ROLE_LABEL[r as Role] ?? r).join(", ")}</p>
      </div>
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
          Fase 0 (fondasi): pendaftaran sekolah, penyiapan, data dasar, pengguna dan peran, serta kode barang. Modul aset,
          persediaan, peminjaman, dan laporan menyusul pada fase berikutnya.
        </p>
      </Card>
    </div>
  );
}
