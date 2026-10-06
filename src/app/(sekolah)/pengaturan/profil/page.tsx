import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { schoolSettings, schools } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { ProfileForm } from "../forms";

export const metadata: Metadata = { title: "Profil & Kop" };

export default async function ProfilPage() {
  const s = await pageSchoolUser(["ADMIN"]);
  const p = await withSchool(s.schoolId, async (tx) => {
    const [school] = await tx.select().from(schools).where(eq(schools.id, s.schoolId));
    const [st] = await tx.select().from(schoolSettings);
    return {
      name: school.name, shortName: school.shortName, address: school.address,
      pemdaName: st.pemdaName, dinasName: st.dinasName, addressFull: st.addressFull,
      logoPemdaFile: st.logoPemdaFile, logoSchoolFile: st.logoSchoolFile,
      kepsekName: st.kepsekName, kepsekNip: st.kepsekNip, pengurusName: st.pengurusName, pengurusNip: st.pengurusNip,
      penggunaName: st.penggunaName, penggunaNip: st.penggunaNip,
    };
  });
  return (
    <div className="max-w-3xl">
      <PageTitle title="Profil & kop dokumen" back={{ href: "/pengaturan", label: "Penyiapan" }} />
      <ProfileForm p={p} />
    </div>
  );
}
