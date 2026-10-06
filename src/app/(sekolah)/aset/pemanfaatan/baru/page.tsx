import type { Metadata } from "next";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { UtilizationForm } from "../util-form";

export const metadata: Metadata = { title: "Catat pemanfaatan" };

export default async function PemanfaatanBaruPage() {
  await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const today = todayWita();
  return (
    <div className="max-w-3xl">
      <PageTitle title="Catat pemanfaatan / penggunaan pihak lain" desc="Mulai dari rencana (masuk RKBMD Pemanfaatan, Format A.1), atau catat yang sudah berjalan." back={{ href: "/aset/pemanfaatan", label: "Pemanfaatan" }} />
      <UtilizationForm edit={false} today={today} initial={{ kind: "PEMANFAATAN", form: "SEWA", planYear: Number(today.slice(0, 4)) + 1, partner: "", purpose: "", term: "", contribution: "", note: "", lines: [], running: false }} />
    </div>
  );
}
