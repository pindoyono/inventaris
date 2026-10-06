import type { Metadata } from "next";
import { schoolSettings } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { ClosingForm } from "./closing-form";

export const metadata: Metadata = { title: "Tutup Buku" };

export default async function TutupBukuPage() {
  const s = await pageSchoolUser(["ADMIN", "KEPSEK"]);
  const [st] = await withSchool(s.schoolId, (tx) => tx.select({ closed: schoolSettings.booksClosedUntil }).from(schoolSettings));
  const today = todayWita();
  const y = Number(today.slice(0, 4));
  // Saran: akhir semester terakhir yang sudah lewat (Permendagri 47/2021: opname & laporan per semester)
  const suggest = today > `${y}-06-30` ? `${y}-06-30` : `${y - 1}-12-31`;
  return (
    <div className="max-w-2xl">
      <PageTitle
        title="Tutup periode"
        desc="Setelah laporan semester dicetak dan diserahkan, tutup buku agar transaksi bertanggal pada periode itu tidak bisa ditambah atau dibatalkan."
        back={{ href: "/pengaturan", label: "Penyiapan" }}
      />
      <ClosingForm current={st.closed} suggest={suggest} today={today} />
    </div>
  );
}
