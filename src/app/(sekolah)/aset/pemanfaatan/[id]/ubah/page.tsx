import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { assets, rooms, utilizationLines, utilizations } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { UtilizationForm } from "../../util-form";

export const metadata: Metadata = { title: "Ubah rencana pemanfaatan" };

export default async function UbahPemanfaatanPage({ params }: PageProps<"/aset/pemanfaatan/[id]/ubah">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const data = await withSchool(s.schoolId, async (tx) => {
    const [u] = await tx.select().from(utilizations).where(eq(utilizations.id, id));
    if (!u || u.status !== "RENCANA") return null;
    const lines = await tx
      .select({ id: assets.id, name: assets.name, bmdCode: assets.bmdCode, regNo: assets.regNo, acqPrice: assets.acqPrice, room: rooms.name, portion: utilizationLines.portion })
      .from(utilizationLines).innerJoin(assets, eq(assets.id, utilizationLines.assetId)).leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(eq(utilizationLines.utilizationId, id));
    return { u, lines };
  });
  if (!data) notFound();
  const { u } = data;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Ubah rencana pemanfaatan" back={{ href: `/aset/pemanfaatan/${id}`, label: "Kembali" }} />
      <UtilizationForm edit today={todayWita()} initial={{
        id, kind: u.kind, form: u.form ?? "", planYear: u.planYear, partner: u.partner ?? "", purpose: u.purpose, term: u.term ?? "", contribution: u.contribution, note: u.note ?? "",
        lines: data.lines.map((l) => ({ ...l, portion: l.portion ?? "" })),
      }} />
    </div>
  );
}
