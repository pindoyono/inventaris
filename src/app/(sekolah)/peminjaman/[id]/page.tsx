import { Attachments } from "@/components/lampiran/attachments";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq } from "drizzle-orm";
import { assets, loanLines, loans, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { Alert, PageTitle } from "@/components/ui";
import { loanScope } from "../scope";
import { LoanActions } from "./loan-actions";

export const metadata: Metadata = { title: "Peminjaman" };
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });
const LABEL = { DIAJUKAN: "Diajukan", DIPINJAM: "Dipinjam", SELESAI: "Selesai", DITOLAK: "Ditolak", DIBATALKAN: "Dibatalkan" } as const;

export default async function PeminjamanDetailPage({ params }: PageProps<"/peminjaman/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR", "PEMINJAM"]);
  const handler = alias(users, "handler");
  const receiver = alias(users, "receiver");
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx.select({ l: loans, handedBy: handler.name }).from(loans).leftJoin(handler, eq(handler.id, loans.handedBy)).where(and(eq(loans.id, id), loanScope(s)));
    if (!h) return null;
    const lines = await tx
      .select({ x: loanLines, name: assets.name, brand: assets.brand, bmdCode: assets.bmdCode, regNo: assets.regNo, condition: assets.condition, receivedBy: receiver.name })
      .from(loanLines)
      .innerJoin(assets, eq(assets.id, loanLines.assetId))
      .leftJoin(receiver, eq(receiver.id, loanLines.returnedTo))
      .where(eq(loanLines.loanId, id))
      .orderBy(asc(assets.name), asc(assets.regNo));
    return { ...h, lines };
  });
  if (!data) notFound();
  const { l, lines } = data;
  const late = l.status === "DIPINJAM" && l.dueAt < new Date();
  const petugas = hasAnyRole(s.roles, ["ADMIN", "PETUGAS"]);
  const own = l.borrowerUserId === s.userId || l.createdBy === s.userId;

  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle title={`Peminjaman ${l.number}`} back={{ href: "/peminjaman", label: "Peminjaman" }} />
      {late && <Alert>Terlambat dikembalikan sejak {fmt.format(l.dueAt)} WITA.</Alert>}
      {l.status === "DITOLAK" && <Alert>Ditolak: {l.lastReason}</Alert>}
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
          <dt className="text-slate-500">Status</dt><dd>{LABEL[l.status]}</dd>
          <dt className="text-slate-500">Peminjam</dt><dd>{l.borrowerName}{l.borrowerInfo ? ` · ${l.borrowerInfo}` : ""}</dd>
          {l.purpose && (<><dt className="text-slate-500">Keperluan</dt><dd>{l.purpose}</dd></>)}
          {l.loanedAt && (<><dt className="text-slate-500">Diserahkan</dt><dd>{fmt.format(l.loanedAt)} WITA · {data.handedBy ?? "—"}</dd></>)}
          <dt className="text-slate-500">Batas kembali</dt><dd className={late ? "font-medium text-red-700" : ""}>{fmt.format(l.dueAt)} WITA</dd>
        </dl>
      </section>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 font-medium">Kondisi pinjam</th><th className="px-3 py-2 font-medium">Kondisi kembali</th><th className="px-3 py-2 font-medium">Dikembalikan</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map(({ x, name, brand, bmdCode, regNo, receivedBy }) => (
              <tr key={x.id}>
                <td className="px-3 py-2">
                  {petugas ? <Link href={`/aset/${x.assetId}`} className="text-teal-800 hover:underline">{name}</Link> : name}{brand ? ` · ${brand}` : ""}
                  <span className="block font-mono text-xs text-slate-500">{bmdCode} · {String(regNo).padStart(6, "0")}</span>
                </td>
                <td className="px-3 py-2">{x.conditionOut ? CONDITION_LABEL[x.conditionOut] : "—"}</td>
                <td className="px-3 py-2">{x.conditionIn ? CONDITION_LABEL[x.conditionIn] : "—"}{x.returnNote && <span className="block text-xs text-slate-500">{x.returnNote}</span>}</td>
                <td className="px-3 py-2 text-slate-600">{x.returnedAt ? `${fmt.format(x.returnedAt)} · ${receivedBy ?? ""}` : x.outAt ? "belum" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoanActions
        id={l.id}
        status={l.status}
        petugas={petugas}
        own={own}
        lines={lines.map(({ x, name, regNo, condition }) => ({ id: x.id, assetId: x.assetId, label: `${name} · ${String(regNo).padStart(6, "0")}`, out: !!x.outAt && !x.returnedAt, condition }))}
      />
      <Attachments schoolId={s.schoolId} entity="peminjaman" entityId={l.id} path={`/peminjaman/${l.id}`} canEdit={petugas} title="Foto kondisi barang" />
      {l.loanedAt && <a href={`/cetak/peminjaman/${l.id}`} target="_blank" rel="noreferrer" className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Cetak kartu peminjaman</a>}
    </div>
  );
}
