import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { assets, fundingComponents, fundingSources } from "@/db/schema";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { MaintenanceForm } from "./form";

export const metadata: Metadata = { title: "Catat Pemeliharaan" };

export default async function PemeliharaanBaruPage({ searchParams }: PageProps<"/audit/pemeliharaan/baru">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const { aset } = await searchParams;
  const data = await withSchool(s.schoolId, async (tx) => ({
    asset: typeof aset === "string" && /^[0-9a-f-]{36}$/.test(aset) ? (await tx.select({ id: assets.id, name: assets.name, regNo: assets.regNo, status: assets.status }).from(assets).where(eq(assets.id, aset)))[0] ?? null : null,
    fs: await tx.select({ id: fundingSources.id, name: fundingSources.name }).from(fundingSources).where(eq(fundingSources.isActive, true)).orderBy(asc(fundingSources.name)),
    fc: await tx.select({ id: fundingComponents.id, name: fundingComponents.name, sourceId: fundingComponents.fundingSourceId }).from(fundingComponents).where(eq(fundingComponents.isActive, true)).orderBy(asc(fundingComponents.name)),
  }));
  return (
    <div className="max-w-3xl">
      <PageTitle title="Catat pemeliharaan" back={{ href: data.asset ? `/aset/${data.asset.id}` : "/audit/pemeliharaan", label: data.asset ? data.asset.name : "Pemeliharaan" }} />
      <MaintenanceForm today={todayWita()} asset={data.asset} fundingSources={data.fs} fundingComponents={data.fc} />
    </div>
  );
}
