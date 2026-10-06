import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { assets, rooms, utilizationLines, utilizations } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { fmtRp } from "@/lib/decimal";
import { UTIL_FORM_LABEL, UTIL_KIND_LABEL, UTIL_STATUS_LABEL } from "@/lib/utilization-shared";
import { PageTitle } from "@/components/ui";
import { Attachments } from "@/components/lampiran/attachments";
import { UtilizationSteps } from "./steps";

export const metadata: Metadata = { title: "Pemanfaatan" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");

export default async function PemanfaatanDetailPage({ params }: PageProps<"/aset/pemanfaatan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [u] = await tx.select().from(utilizations).where(eq(utilizations.id, id));
    if (!u) return null;
    const lines = await tx
      .select({ id: assets.id, name: assets.name, bmdCode: assets.bmdCode, regNo: assets.regNo, acqPrice: assets.acqPrice, room: rooms.name, portion: utilizationLines.portion })
      .from(utilizationLines).innerJoin(assets, eq(assets.id, utilizationLines.assetId)).leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(eq(utilizationLines.utilizationId, id));
    return { u, lines };
  });
  if (!data) notFound();
  const { u } = data;
  const title = u.form ? `${UTIL_FORM_LABEL[u.form]}${u.partner ? ` — ${u.partner}` : ""}` : UTIL_KIND_LABEL[u.kind];
  return (
    <div className="space-y-6">
      <PageTitle title={title} desc={`${UTIL_KIND_LABEL[u.kind]} · ${u.purpose}`} back={{ href: "/aset/pemanfaatan", label: "Pemanfaatan" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <dl className="grid grid-cols-[11rem_1fr] gap-y-1.5">
              <dt className="text-slate-500">Status</dt><dd>{UTIL_STATUS_LABEL[u.status]}{u.withoutApproval && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-800">tanpa persetujuan Pengelola/Kepala Daerah</span>}{u.lastReason ? ` · ${u.lastReason}` : ""}</dd>
              <dt className="text-slate-500">RKBMD tahun</dt><dd>{u.planYear}</dd>
              <dt className="text-slate-500">Mitra</dt><dd>{u.partner ?? "—"}</dd>
              <dt className="text-slate-500">Rencana jangka waktu</dt><dd>{u.term ?? "—"}</dd>
              <dt className="text-slate-500">Persetujuan</dt><dd>{u.approvalNo ? `${u.approvalNo} tgl ${fmtDate(u.approvalDate)}` : "—"}</dd>
              <dt className="text-slate-500">Perjanjian</dt><dd>{u.agreementNo ? `${u.agreementNo}${u.agreementDate ? ` tgl ${fmtDate(u.agreementDate)}` : ""}` : "—"}</dd>
              <dt className="text-slate-500">Pelaksanaan</dt><dd>{u.startDate ? `${fmtDate(u.startDate)} s.d. ${u.endDate ? fmtDate(u.endDate) : "…"}` : "—"}{u.endedDate ? ` · selesai ${fmtDate(u.endedDate)}` : ""}</dd>
              <dt className="text-slate-500">Kontribusi/sewa</dt><dd>Rp{fmtRp(u.contribution)}</dd>
              {u.note && (<><dt className="text-slate-500">Catatan</dt><dd>{u.note}</dd></>)}
            </dl>
            {canEdit && u.status === "RENCANA" && <Link href={`/aset/pemanfaatan/${u.id}/ubah`} className="mt-3 inline-block text-teal-700 hover:underline">Ubah rencana</Link>}
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Barang</h2>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
              {data.lines.map((l) => (
                <li key={l.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span><Link href={`/aset/${l.id}`} className="text-teal-800 hover:underline">{l.name}</Link> <span className="font-mono text-xs text-slate-500">{l.bmdCode}.{String(l.regNo).padStart(6, "0")}</span>{l.portion && <span className="block text-xs text-slate-500">{l.portion}</span>}</span>
                  <span className="text-slate-500">{l.room ?? "—"} · Rp{fmtRp(l.acqPrice)}</span>
                </li>
              ))}
            </ul>
          </section>
          <Attachments schoolId={s.schoolId} entity="pemanfaatan" entityId={u.id} path={`/aset/pemanfaatan/${u.id}`} canEdit={canEdit} title="Surat persetujuan, perjanjian & bukti setor" />
        </div>
        {canEdit && <UtilizationSteps id={u.id} status={u.status} today={todayWita()} partner={u.partner ?? ""} contribution={u.contribution} />}
      </div>
    </div>
  );
}
