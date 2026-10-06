import { Attachments } from "@/components/lampiran/attachments";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assets, disposalLines, disposals, rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { loadRegisterParts } from "@/lib/server/register";
import { todayWita } from "@/lib/server/ledger";
import { DISPOSAL_REASON_LABEL } from "@/lib/server/disposal";
import { CONDITION_LABEL, registerCode } from "@/lib/assets-shared";
import { fmtRp, parseDec } from "@/lib/decimal";
import { Alert, PageTitle } from "@/components/ui";
import { DisposalActions } from "./disposal-actions";
import { DisposalForm } from "../disposal-form";

export const metadata: Metadata = { title: "Usulan Penghapusan" };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}` : "—");
const LABEL = { DRAF: "Draf", DIAJUKAN: "Diajukan Kepala Sekolah", DIKIRIM: "Dikirim ke Dinas/BPKAD", SELESAI: "SK terbit", DITOLAK: "Ditolak", DIBATALKAN: "Dibatalkan" } as const;

export default async function UsulanDetailPage({ params, searchParams }: PageProps<"/audit/penghapusan/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [d] = await tx.select().from(disposals).where(eq(disposals.id, id));
    if (!d) return null;
    const lines = await tx
      .select({ l: disposalLines, a: assets, room: rooms.name })
      .from(disposalLines).innerJoin(assets, eq(assets.id, disposalLines.assetId)).leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(eq(disposalLines.disposalId, id)).orderBy(asc(assets.bmdCode), asc(assets.regNo));
    return { d, lines, parts: await loadRegisterParts(tx, s.schoolId) };
  });
  if (!data) notFound();
  const { d, lines, parts } = data;
  const petugas = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const total = lines.reduce((a, x) => a + parseDec(x.a.acqPrice), 0n);

  if (sp.ubah === "1" && d.status === "DRAF" && petugas)
    return (
      <div className="max-w-4xl">
        <PageTitle title="Ubah draf usulan" back={{ href: `/audit/penghapusan/${id}`, label: "Usulan" }} />
        <DisposalForm today={todayWita()} initial={{ id, date: d.date, note: d.note ?? "", lines: lines.map(({ l, a, room }) => ({ id: a.id, name: a.name, brand: a.brand, bmdCode: a.bmdCode, regNo: a.regNo, condition: a.condition, status: a.status, acqDate: a.acqDate, acqPrice: a.acqPrice, room, reason: l.reason, followUp: l.followUp, policeLetter: l.policeLetter ?? "", note: l.note ?? "" })) }} />
      </div>
    );

  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle title={`Usulan penghapusan ${d.number ?? "(draf)"}`} desc={`${LABEL[d.status]} · ${fmtDate(d.date)}${d.note ? ` · ${d.note}` : ""}`} back={{ href: "/audit/penghapusan", label: "Usulan penghapusan" }} />
      {d.status === "DITOLAK" && <Alert>Ditolak: {d.lastReason}</Alert>}
      {(d.letterNumber || d.skNumber) && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          {d.letterNumber && <p>Surat usulan: {d.letterNumber} tanggal {fmtDate(d.letterDate)}</p>}
          {d.skNumber && <p>SK kepala daerah: <strong>{d.skNumber}</strong> tanggal {fmtDate(d.skDate)}{d.skFile && <> · <a href={`/berkas/${d.skFile}`} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">lihat scan SK</a></>}</p>}
        </section>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2 font-medium">Kode register</th><th className="px-3 py-2 font-medium">Nama / merk</th><th className="px-3 py-2 font-medium">Tahun</th><th className="px-3 py-2 font-medium">Kondisi · lokasi</th><th className="px-3 py-2 text-right font-medium">Nilai perolehan</th><th className="px-3 py-2 font-medium">Alasan</th><th className="px-3 py-2 font-medium">Status barang</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map(({ l, a, room }) => {
              const reg = registerCode(parts, a);
              return (
                <tr key={l.id}>
                  <td className="px-3 py-2 font-mono text-xs">{reg.top}<br />{reg.bottom}</td>
                  <td className="px-3 py-2"><Link href={`/aset/${a.id}`} className="text-teal-800 hover:underline">{a.name}</Link>{a.brand ? ` · ${a.brand}` : ""}</td>
                  <td className="px-3 py-2">{a.acqDate.slice(0, 4)}</td>
                  <td className="px-3 py-2">{CONDITION_LABEL[a.condition]} · {room ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{fmtRp(a.acqPrice)}</td>
                  <td className="px-3 py-2">{DISPOSAL_REASON_LABEL[l.reason]}{(l.reason === "RUSAK_BERAT" || l.reason === "USANG") && <span className="block text-xs text-slate-500">{l.followUp === "PEMINDAHTANGANAN" ? "→ pemindahtanganan" : "→ pemusnahan"}</span>}{l.policeLetter && <span className="block text-xs text-slate-500">Surat polisi: {l.policeLetter}</span>}{l.note && <span className="block text-xs text-slate-500">{l.note}</span>}</td>
                  <td className="px-3 py-2 text-xs">{a.status.toLowerCase().replaceAll("_", " ")}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-medium"><tr><td colSpan={4} className="px-3 py-2 text-right">Jumlah {lines.length} barang</td><td className="px-3 py-2 text-right">{fmtRp(total)}</td><td colSpan={2} /></tr></tfoot>
        </table>
      </div>
      <Attachments schoolId={s.schoolId} entity="penghapusan" entityId={d.id} path={`/audit/penghapusan/${d.id}`} canEdit={petugas || hasAnyRole(s.roles, ["KEPSEK"])} title="Foto barang & dokumen pendukung" />
      <DisposalActions
        id={d.id}
        status={d.status}
        petugas={petugas}
        kepsek={hasAnyRole(s.roles, ["KEPSEK"])}
        today={todayWita()}
        lines={lines.map(({ l, a }) => ({ id: l.id, label: `${a.name} · ${String(a.regNo).padStart(6, "0")}` }))}
      />
      {d.number && <a href={`/cetak/penghapusan/${d.id}`} target="_blank" rel="noreferrer" className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Cetak surat usulan & daftar barang</a>}
      {d.number && <a href={`/cetak/penghapusan/${d.id}?format=rkbmd`} target="_blank" rel="noreferrer" className="ml-2 inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Cetak RKBMD rencana penghapusan (Permendagri 7/2024)</a>}
    </div>
  );
}
