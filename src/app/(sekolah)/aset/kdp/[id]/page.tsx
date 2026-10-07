import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assets, assetValueChanges, constructions, fundingSources, rooms, vendors } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { todayWita } from "@/lib/server/ledger";
import { fmtRp, parseDec } from "@/lib/decimal";
import { ATR_FOLLOW_UP_LABEL, CONSTRUCTION_KIND_LABEL, CONSTRUCTION_STATUS_LABEL } from "@/lib/construction-shared";
import { PageTitle } from "@/components/ui";
import { kodeBarang } from "@/lib/assets-shared";
import { Attachments } from "@/components/lampiran/attachments";
import { loadAssetFormOptions } from "../../data";
import { ConstructionActions } from "./actions-panel";

export const metadata: Metadata = { title: "KDP / renovasi" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");

export default async function KdpDetailPage({ params }: PageProps<"/aset/kdp/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const canEdit = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [r] = await tx
      .select({ c: constructions, a: assets, vendor: vendors.name, fs: fundingSources.name })
      .from(constructions)
      .innerJoin(assets, eq(assets.id, constructions.assetId))
      .leftJoin(vendors, eq(vendors.id, constructions.vendorId))
      .leftJoin(fundingSources, eq(fundingSources.id, assets.fundingSourceId))
      .where(eq(constructions.id, id));
    if (!r) return null;
    const pays = await tx.select().from(assetValueChanges).where(eq(assetValueChanges.assetId, r.a.id)).orderBy(asc(assetValueChanges.date), asc(assetValueChanges.id));
    const roomOpts = await tx.select({ id: rooms.id, name: rooms.name }).from(rooms).orderBy(asc(rooms.name));
    const favorites = canEdit ? (await loadAssetFormOptions(tx)).favorites : [];
    return { ...r, pays, roomOpts, favorites };
  });
  if (!data) notFound();
  const { c, a } = data;
  const paid = data.pays.filter((p) => p.kind === "PEMBAYARAN_KDP").reduce((x, p) => x + parseDec(p.amount), 0n);
  const contract = parseDec(c.contractValue);
  return (
    <div className="space-y-6">
      <PageTitle title={a.name} desc={CONSTRUCTION_KIND_LABEL[c.kind]} back={{ href: "/aset/kdp", label: "KDP & renovasi" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <dl className="grid grid-cols-[11rem_1fr] gap-y-1.5">
              <dt className="text-slate-500">Status</dt><dd>{CONSTRUCTION_STATUS_LABEL[c.status]} · progres {c.progress}%{c.stopReason ? ` · ${c.stopReason}` : ""}</dd>
              <dt className="text-slate-500">Aset</dt><dd><Link href={`/aset/${a.id}`} className="text-teal-700 hover:underline"><span className="font-mono">{kodeBarang(a.bmdCode)}.{String(a.regNo).padStart(6, "0")}</span></Link>{c.status === "SELESAI" && c.kind === "KDP" && " (sudah direklasifikasi)"}</dd>
              {c.ownerName && (<><dt className="text-slate-500">Pemilik aset</dt><dd>{c.ownerName}</dd></>)}
              <dt className="text-slate-500">Kontrak</dt><dd>{c.contractNo ?? "—"}{c.contractDate ? ` tgl ${fmtDate(c.contractDate)}` : ""} · Rp{fmtRp(c.contractValue)}</dd>
              {data.vendor && (<><dt className="text-slate-500">Penyedia</dt><dd>{data.vendor}</dd></>)}
              {data.fs && (<><dt className="text-slate-500">Sumber dana</dt><dd>{data.fs}</dd></>)}
              <dt className="text-slate-500">Mulai / target</dt><dd>{fmtDate(c.startDate)} / {fmtDate(c.targetDate)}</dd>
              {c.finishedDate && (<><dt className="text-slate-500">Selesai (BAST)</dt><dd>{fmtDate(c.finishedDate)} · {c.bastNo}</dd></>)}
              {a.attrs.letak && (<><dt className="text-slate-500">Letak</dt><dd>{a.attrs.letak}</dd></>)}
              <dt className="text-slate-500">Nilai tercatat</dt><dd><strong>Rp{fmtRp(a.acqPrice)}</strong>{contract > 0n && <span className="text-slate-500"> · dibayar {Number((paid * 100n) / contract)}% dari kontrak</span>}</dd>
              {c.kind === "ATR" && (<><dt className="text-slate-500">Tindak lanjut</dt><dd>{c.atrFollowUp ? ATR_FOLLOW_UP_LABEL[c.atrFollowUp] : "—"}</dd></>)}
            </dl>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Pembayaran & perubahan nilai</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Uraian</th><th className="px-3 py-2 font-medium">Dokumen</th><th className="px-3 py-2 text-right font-medium">Nilai (Rp)</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.pays.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Belum ada pembayaran.</td></tr>}
                  {data.pays.map((p) => <tr key={p.id}><td className="px-3 py-2">{fmtDate(p.date)}</td><td className="px-3 py-2">{p.note ?? p.kind}</td><td className="px-3 py-2">{p.docNo ?? "—"}</td><td className="px-3 py-2 text-right">{fmtRp(p.amount)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>
          <Attachments schoolId={s.schoolId} entity="kdp" entityId={c.id} path={`/aset/kdp/${c.id}`} canEdit={canEdit} title="Kontrak, BAST & foto progres" />
        </div>
        {canEdit && <ConstructionActions id={c.id} kind={c.kind} status={c.status} progress={c.progress} targetDate={c.targetDate ?? ""} atrFollowUp={c.atrFollowUp ?? ""} today={todayWita()} rooms={data.roomOpts} favorites={data.favorites} name={a.name} />}
      </div>
    </div>
  );
}
