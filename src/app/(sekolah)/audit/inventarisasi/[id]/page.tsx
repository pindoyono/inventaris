import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { assetInventories, assetInventoryLines, assets, rooms } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { hasAnyRole } from "@/lib/roles";
import { PageTitle } from "@/components/ui";
import { InventorySheet } from "./sheet";

export const metadata: Metadata = { title: "Inventarisasi Aset" };
const fmtDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export default async function InventarisasiDetailPage({ params }: PageProps<"/audit/inventarisasi/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [h] = await tx.select({ v: assetInventories, room: rooms.name }).from(assetInventories).innerJoin(rooms, eq(rooms.id, assetInventories.roomId)).where(eq(assetInventories.id, id));
    if (!h) return null;
    const lines = await tx
      .select({ l: assetInventoryLines, name: assets.name, brand: assets.brand, bmdCode: assets.bmdCode, regNo: assets.regNo, status: assets.status })
      .from(assetInventoryLines).leftJoin(assets, eq(assets.id, assetInventoryLines.assetId))
      .where(eq(assetInventoryLines.inventoryId, id)).orderBy(asc(assets.bmdCode), asc(assets.regNo));
    return { ...h, lines };
  });
  if (!data) notFound();
  const { v } = data;
  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle title={`Inventarisasi ${v.number}`} desc={`${data.room} · ${fmtDate(v.date)}${v.note ? ` · ${v.note}` : ""}`} back={{ href: "/audit/inventarisasi", label: "Inventarisasi" }} />
      <InventorySheet
        id={v.id}
        editable={v.status === "DRAF" && hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])}
        status={v.status}
        lines={data.lines.map(({ l, name, brand, bmdCode, regNo, status }) => ({
          id: l.id, assetId: l.assetId, label: l.assetId ? `${name}${brand ? ` · ${brand}` : ""}` : l.extraName!, code: l.assetId ? `${bmdCode} · ${String(regNo).padStart(6, "0")}` : `belum tercatat · ${l.extraQty} unit`,
          assetStatus: status, recorded: l.conditionRecorded, found: l.found, condition: l.conditionFound, note: l.note,
        }))}
      />
      <a href={`/cetak/inventarisasi/${v.id}`} target="_blank" rel="noreferrer" className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">{v.status === "DRAF" ? "Cetak lembar kerja" : "Cetak laporan hasil inventarisasi"}</a>
    </div>
  );
}
