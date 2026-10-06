import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { loadRequestOptions } from "../data";
import { RequestForm } from "../request-form";

export const metadata: Metadata = { title: "Nota Permintaan Baru" };

export default async function PermintaanBaruPage() {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS", "PENGUSUL", "KEPSEK", "VERIFIKATOR"]);
  const opts = await withSchool(s.schoolId, (tx) => loadRequestOptions(tx, s));
  return (
    <div className="max-w-4xl">
      <PageTitle title="Nota permintaan barang" back={{ href: "/permintaan", label: "Permintaan" }} />
      <RequestForm opts={opts} today={todayWita()} initial={{ unitId: opts.units.length === 1 ? opts.units[0].id : "", date: todayWita(), purpose: "", lines: [] }} />
    </div>
  );
}
