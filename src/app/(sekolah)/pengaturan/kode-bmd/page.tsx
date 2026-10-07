import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fundingSources, schoolSettings, schools } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { BmdForm } from "../forms";
import { UsefulLifeForm } from "./useful-life-form";
import { DEFAULT_USEFUL_LIFE } from "@/lib/depreciation-shared";
import { codeTitles } from "@/lib/server/bmd-ledger";

export const metadata: Metadata = { title: "Kode BMD & Kapitalisasi" };

export default async function KodeBmdPage() {
  const s = await pageSchoolUser(["ADMIN"]);
  const { st, funds } = await withSchool(s.schoolId, async (tx) => ({
    st: (await tx.select().from(schoolSettings))[0],
    funds: await tx.select({ name: fundingSources.name, upb: fundingSources.kodeUpb }).from(fundingSources).where(eq(fundingSources.isActive, true)).orderBy(asc(fundingSources.name)),
  }));
  const [sc] = await db.select().from(schools).where(eq(schools.id, s.schoolId));
  const { default: capDefault, ...caps } = st.capitalization;
  const titles = await codeTitles(Object.keys(DEFAULT_USEFUL_LIFE));
  const lifeRows = Object.entries(DEFAULT_USEFUL_LIFE).map(([code, def]) => ({ code, name: titles.get(code) ?? code, def, value: st.usefulLife[code] ?? null }));
  return (
    <div className="max-w-3xl">
      <PageTitle title="Kode lokasi, label & kapitalisasi" back={{ href: "/pengaturan", label: "Penyiapan" }} />
      <BmdForm
        v={{
          kodeProvinsi: st.kodeProvinsi ?? "",
          kodeKab: st.kodeKab ?? "",
          kodeBidang: st.kodeBidang ?? "",
          kodeUnit: st.kodeUnit ?? "",
          kodeSubUnit: st.kodeSubUnit ?? "",
          kodeUpb: st.kodeUpb,
          labelQr: st.labelQr,
          labelLogo: st.labelLogo,
          capDefault: String(capDefault ?? 2_000_000),
          caps: Object.fromEntries(Object.entries(caps).map(([k, n]) => [k, String(n)])),
          ownershipCode: sc.ownershipCode,
          provinceCode: sc.provinceCode,
          regencyCode: sc.regencyCode,
          schoolName: sc.name,
          funds,
        }}
      />
      <div className="mt-6"><UsefulLifeForm rows={lifeRows} /></div>
    </div>
  );
}
