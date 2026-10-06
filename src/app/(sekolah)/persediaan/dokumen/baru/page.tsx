import type { Metadata } from "next";
import { withSchool } from "@/lib/tenant";
import { pageSchoolUser } from "@/lib/server/guard";
import { todayWita } from "@/lib/server/ledger";
import { PageTitle } from "@/components/ui";
import { loadDocOptions } from "../../data";
import { DocForm } from "../doc-form";
import { FORM_KINDS, KIND_LABEL, type FormKind } from "../labels";

export const metadata: Metadata = { title: "Dokumen Stok Baru" };

export default async function DokumenBaruPage({ searchParams }: PageProps<"/persediaan/dokumen/baru">) {
  const s = await pageSchoolUser(["ADMIN", "PETUGAS"]);
  const { jenis } = await searchParams;
  const kind: FormKind = FORM_KINDS.includes(jenis as FormKind) ? (jenis as FormKind) : "PENERIMAAN";
  const opts = await withSchool(s.schoolId, loadDocOptions);
  const today = todayWita();
  const wh = opts.warehouses.find((w) => w.isDefault) ?? opts.warehouses[0];
  return (
    <div className="max-w-4xl">
      <PageTitle title={`${KIND_LABEL[kind]} baru`} back={{ href: "/persediaan/dokumen", label: "Dokumen stok" }} />
      <DocForm
        today={today}
        opts={opts}
        initial={{ kind, date: today, warehouseId: wh?.id ?? "", acquisition: kind === "PENERIMAAN" ? "PEMBELIAN" : null, lines: [] }}
      />
    </div>
  );
}
