import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { rooms, schools, transfers } from "@/db/schema";
import { db } from "@/db";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { TRANSFER_STATUS_LABEL } from "@/lib/server/transfers";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { fmtRp, parseDec } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { TransferSteps } from "./steps";

export const metadata: Metadata = { title: "Pengalihan aset" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");

export default async function PengalihanDetail({ params }: PageProps<"/aset/pengalihan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [t] = await tx.select().from(transfers).where(eq(transfers.id, id));
    if (!t) return null;
    const roomOpts = await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name));
    return { t, roomOpts };
  });
  if (!data) notFound();
  const { t } = data;
  const [from] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, t.fromSchoolId));
  const mine = t.fromSchoolId === s.schoolId;
  const total = t.items.reduce((a, i) => a + parseDec(i.acqPrice), 0n);
  return (
    <div className="space-y-6">
      <PageTitle title={`${mine ? "Pengeluaran" : "Penerimaan"} internal ${t.number ?? "(draf)"}`} desc={mine ? `Ke ${t.toName}` : `Dari ${from?.name}`} back={{ href: "/aset/pengalihan", label: "Pengalihan" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <dl className="grid grid-cols-[12rem_1fr] gap-y-1.5">
              <dt className="text-slate-500">Status</dt><dd>{TRANSFER_STATUS_LABEL[t.status]}{t.receiveNote ? ` · ${t.receiveNote}` : ""}</dd>
              <dt className="text-slate-500">Pengirim → penerima</dt><dd>{from?.name} → {t.toName}{!t.toSchoolId && " (di luar aplikasi)"}</dd>
              <dt className="text-slate-500">Alasan</dt><dd>{t.reason}</dd>
              <dt className="text-slate-500">Persetujuan Pengguna Barang</dt><dd>{t.approvalNo ? `${t.approvalNo}${t.approvalDate ? ` tgl ${fmtDate(t.approvalDate)}` : ""}` : "—"}</dd>
              <dt className="text-slate-500">BAST</dt><dd>{t.bastNo ? `${t.bastNo} tgl ${fmtDate(t.bastDate)}` : "—"}</dd>
              {t.note && (<><dt className="text-slate-500">Catatan</dt><dd>{t.note}</dd></>)}
            </dl>
            {mine && t.bastNo && <a href={`/cetak/pengalihan/${t.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Cetak BAST</a>}
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Barang ({t.items.length}) · Rp{fmtRp(total)}</h2>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
              {t.items.map((i) => (
                <li key={i.assetId} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span>{mine ? <Link href={`/aset/${i.assetId}`} className="text-teal-800 hover:underline">{i.name}</Link> : i.newAssetId ? <Link href={`/aset/${i.newAssetId}`} className="text-teal-800 hover:underline">{i.name}</Link> : i.name}
                    <span className="block font-mono text-xs text-slate-500">{i.bmdCode}.{String(i.regNo).padStart(6, "0")} · perolehan {i.acqDate.slice(0, 4)} · {CONDITION_LABEL[i.condition]}</span></span>
                  <span className="text-slate-600">Rp{fmtRp(i.acqPrice)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        {hasAnyRole(s.roles, ["ADMIN", "PETUGAS", "KEPSEK"]) && <TransferSteps id={t.id} status={t.status} mine={mine} external={!t.toSchoolId} approvalNo={t.approvalNo ?? ""} today={todayWita()} rooms={data.roomOpts} canManage={hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])} />}
      </div>
    </div>
  );
}
