import { Attachments } from "@/components/lampiran/attachments";
import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assetEvents, assets, bmdCodes, fundingComponents, fundingSources, localBmdCodes, maintenances, rooms, units, vendors } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { loadRegisterParts, qrSvg } from "@/lib/server/register";
import { ACQUISITION_LABEL, CONDITION_LABEL, KIB_ATTRS, KIB_LABEL, registerCode, STATUS_LABEL } from "@/lib/assets-shared";
import { fmtRp } from "@/lib/decimal";
import { PageTitle } from "@/components/ui";
import { RegisterLabel } from "@/components/register-label";
import { QuickActions } from "./quick-actions";

export const metadata: Metadata = { title: "Aset" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const EVENT_LABEL = { DICATAT: "Dicatat", PINDAH: "Pindah ruangan", KONDISI: "Ubah kondisi", STATUS: "Ubah status", UBAH_DATA: "Ubah data" } as const;

export default async function AsetDetailPage({ params }: PageProps<"/aset/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser();
  const fromRoom = alias(rooms, "from_room");
  const toRoom = alias(rooms, "to_room");

  const data = await withSchool(s.schoolId, async (tx) => {
    const [r] = await tx
      .select({ a: assets, room: rooms.name, unit: units.name, vendor: vendors.name, fs: fundingSources.name, fc: fundingComponents.name })
      .from(assets)
      .leftJoin(rooms, eq(rooms.id, assets.roomId))
      .leftJoin(units, eq(units.id, assets.unitId))
      .leftJoin(vendors, eq(vendors.id, assets.vendorId))
      .leftJoin(fundingSources, eq(fundingSources.id, assets.fundingSourceId))
      .leftJoin(fundingComponents, eq(fundingComponents.id, assets.fundingComponentId))
      .where(eq(assets.id, id));
    if (!r) return null;
    const events = await tx
      .select({ e: assetEvents, from: fromRoom.name, to: toRoom.name })
      .from(assetEvents)
      .leftJoin(fromRoom, eq(fromRoom.id, assetEvents.fromRoomId))
      .leftJoin(toRoom, eq(toRoom.id, assetEvents.toRoomId))
      .where(eq(assetEvents.assetId, id))
      .orderBy(desc(assetEvents.id));
    const roomOpts = await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name));
    const maint = await tx.select().from(maintenances).where(eq(maintenances.assetId, id)).orderBy(desc(maintenances.startDate));
    const [loc] = await tx.select({ name: localBmdCodes.name }).from(localBmdCodes).where(eq(localBmdCodes.code, r.a.bmdCode));
    return { ...r, events, roomOpts, maint, parts: await loadRegisterParts(tx, s.schoolId), localName: loc?.name };
  });
  if (!data) notFound();
  const { a, parts } = data;
  const [off] = await db.select({ name: bmdCodes.name }).from(bmdCodes).where(eq(bmdCodes.code, a.bmdCode));
  const codeName = off?.name ?? data.localName ?? "";
  const reg = registerCode(parts, a);
  const qr = await qrSvg(a.qrToken);
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);

  return (
    <div className="space-y-6">
      <PageTitle title={a.name} desc={a.brand ?? undefined} back={{ href: "/aset", label: "Aset" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <dl className="grid grid-cols-[11rem_1fr] gap-y-1.5">
              <dt className="text-slate-500">Kode register</dt>
              <dd className="font-mono">{reg.top}<br /><strong>{reg.bottom}</strong>{reg.provisional && <span className="ml-2 rounded bg-red-100 px-1.5 font-sans text-xs text-red-700">SEMENTARA</span>}</dd>
              <dt className="text-slate-500">Kode barang</dt><dd>{a.bmdCode} — {codeName}</dd>
              <dt className="text-slate-500">Golongan</dt><dd>{KIB_LABEL[a.kib]} · {a.isIntra ? "Intrakomptabel" : "Ekstrakomptabel"}</dd>
              <dt className="text-slate-500">Perolehan</dt><dd>{fmtDate(a.acqDate)} · {ACQUISITION_LABEL[a.acquisition] ?? a.acquisition} · Rp{fmtRp(a.acqPrice)}</dd>
              {data.vendor && (<><dt className="text-slate-500">Penyedia</dt><dd>{data.vendor}</dd></>)}
              {a.refNumber && (<><dt className="text-slate-500">No. nota/BAST</dt><dd>{a.refNumber}</dd></>)}
              {data.fs && (<><dt className="text-slate-500">Sumber dana</dt><dd>{data.fs}{data.fc ? ` — ${data.fc}` : ""}</dd></>)}
              <dt className="text-slate-500">Ruangan</dt><dd>{data.room ?? "Belum ditempatkan"}</dd>
              {data.unit && (<><dt className="text-slate-500">Unit</dt><dd>{data.unit}</dd></>)}
              <dt className="text-slate-500">Kondisi</dt><dd>{CONDITION_LABEL[a.condition]}</dd>
              <dt className="text-slate-500">Status</dt><dd>{STATUS_LABEL[a.status]}{a.idle && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">tidak digunakan untuk tusi · rencana {a.idlePlan?.toLowerCase()}{a.idleNote ? ` · ${a.idleNote}` : ""}</span>}</dd>
              {(KIB_ATTRS[a.kib] ?? []).filter((x) => a.attrs[x.key]).map((x) => (
                <Fragment key={x.key}><dt className="text-slate-500">{x.label}</dt><dd>{a.attrs[x.key]}</dd></Fragment>
              ))}
              {a.note && (<><dt className="text-slate-500">Catatan</dt><dd>{a.note}</dd></>)}
            </dl>
            {canEdit && <Link href={`/aset/${a.id}/ubah`} className="mt-3 inline-block text-teal-700 hover:underline">Ubah data barang</Link>}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Kartu pemeliharaan</h2>
              <span className="flex gap-3 text-sm">
                {data.maint.length > 0 && <a href={`/cetak/pemeliharaan/${a.id}`} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">Cetak kartu</a>}
                {canEdit && a.status === "DIGUNAKAN" && <Link href={`/audit/pemeliharaan/baru?aset=${a.id}`} className="text-teal-700 hover:underline">+ Catat pemeliharaan</Link>}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
              {data.maint.length === 0 && <li className="px-4 py-2 text-slate-500">Belum ada.</li>}
              {data.maint.map((m) => (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span>{m.description}{m.status === "BERJALAN" && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">sedang dikerjakan</span>}
                    <span className="block text-xs text-slate-500">{{ RUTIN: "Rutin", PERBAIKAN: "Perbaikan", PENINGKATAN: "Peningkatan" }[m.kind]}{m.executor ? ` · ${m.executor}` : ""} · {CONDITION_LABEL[m.conditionBefore]}{m.conditionAfter ? ` → ${CONDITION_LABEL[m.conditionAfter]}` : ""}</span></span>
                  <span className="text-slate-500">{fmtDate(m.startDate)} · Rp{fmtRp(m.cost)}</span>
                </li>
              ))}
            </ul>
          </section>

          <Attachments schoolId={s.schoolId} entity="aset" entityId={a.id} path={`/aset/${a.id}`} canEdit={canEdit} title="Foto & dokumen" />

          <section>
            <h2 className="mb-2 font-semibold">Riwayat</h2>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
              {data.events.map(({ e, from, to }) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span>
                    <strong>{EVENT_LABEL[e.kind]}</strong>
                    {e.kind === "PINDAH" && ` dari ${from ?? "—"} ke ${to ?? "—"}`}
                    {e.kind === "DICATAT" && to && ` di ${to}`}
                    {e.kind === "KONDISI" && ` ${e.fromCondition ? CONDITION_LABEL[e.fromCondition] : ""} → ${e.toCondition ? CONDITION_LABEL[e.toCondition] : ""}`}
                    {e.note && <span className="text-slate-600"> — {e.note}</span>}
                  </span>
                  <span className="text-slate-500">{fmtDate(e.date)} · {e.createdByName ?? "—"}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">Pratinjau label</h2>
            <RegisterLabel pemda={parts.pemdaName} school={parts.schoolName} top={reg.top} bottom={reg.bottom} name={a.name} provisional={reg.provisional} qr={qr} />
            <p className="mt-2 text-xs text-slate-500">QR membuka halaman barang ini.</p>
            {canEdit && <a href={`/cetak/label?id=${a.id}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">Cetak label</a>}
          </section>
          {canEdit && a.status !== "DIHAPUS" && <QuickActions id={a.id} roomId={a.roomId} condition={a.condition} rooms={data.roomOpts} today={todayWita()} idle={a.idle} />}
        </div>
      </div>
    </div>
  );
}
