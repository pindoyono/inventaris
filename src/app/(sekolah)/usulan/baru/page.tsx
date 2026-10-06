import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { thisYear } from "@/lib/server/proposals";
import { PageTitle } from "@/components/ui";
import { loadProposalOptions } from "../data";
import { ProposalForm } from "../proposal-form";

export const metadata: Metadata = { title: "Usulan Kebutuhan Baru" };

export default async function UsulanBaruPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const opts = await withSchool(s.schoolId, (tx) => loadProposalOptions(tx, s));
  const bos = opts.fundingSources.find((f) => /BOS Reguler/i.test(f.name));
  return (
    <div className="max-w-4xl">
      <PageTitle title="Usulan kebutuhan barang" desc="Diajukan unit, diverifikasi terhadap pagu, lalu disetujui Kepala Sekolah sebelum diadakan." back={{ href: "/usulan", label: "Usulan" }} />
      <ProposalForm opts={opts} initial={{ unitId: opts.units.length === 1 ? opts.units[0].id : "", year: thisYear(), fundingSourceId: bos?.id ?? "", fundingComponentId: "", title: "", lines: [] }} />
    </div>
  );
}
