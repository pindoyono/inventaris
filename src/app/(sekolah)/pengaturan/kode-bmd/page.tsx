import type { Metadata } from "next";
import { schoolSettings } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { BmdForm } from "../forms";

export const metadata: Metadata = { title: "Kode BMD & Kapitalisasi" };

export default async function KodeBmdPage() {
  const s = await pageSchoolUser(["ADMIN"]);
  const st = await withSchool(s.schoolId, async (tx) => (await tx.select().from(schoolSettings))[0]);
  const { default: capDefault, ...caps } = st.capitalization;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Kode BMD & batas kapitalisasi" back={{ href: "/pengaturan", label: "Penyiapan" }} />
      <BmdForm
        v={{
          kodePengguna: st.kodePengguna ?? "",
          kodeKuasaPengguna: st.kodeKuasaPengguna ?? "",
          kodeSubKuasa: st.kodeSubKuasa,
          capDefault: String(capDefault ?? 2_000_000),
          caps: Object.fromEntries(Object.entries(caps).map(([k, n]) => [k, String(n)])),
        }}
      />
    </div>
  );
}
