import type { Metadata } from "next";
import { schoolSettings } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { WorkflowForm } from "../forms";

export const metadata: Metadata = { title: "Alur Kerja" };

export default async function AlurKerjaPage() {
  const s = await pageSchoolUser(["ADMIN"]);
  const st = await withSchool(s.schoolId, async (tx) => (await tx.select().from(schoolSettings))[0]);
  return (
    <div className="max-w-3xl">
      <PageTitle title="Alur kerja" back={{ href: "/pengaturan", label: "Penyiapan" }} />
      <WorkflowForm
        v={{
          approvalLevels: st.approvalLevels,
          studentAccounts: st.studentAccounts,
          distributionMode: st.distributionMode,
          loanDefaultDays: st.loanDefaultDays,
          unitLabel: st.unitLabel,
        }}
      />
    </div>
  );
}
