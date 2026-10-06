import type { Metadata } from "next";
import { pageSchoolUser } from "@/lib/server/guard";
import { PageTitle } from "@/components/ui";
import { ScanPage } from "./scan-page";

export const metadata: Metadata = { title: "Pindai QR" };

export default async function PindaiPage() {
  await pageSchoolUser();
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Pindai label barang" desc="Arahkan kamera ke QR pada label kode register. Halaman barang terbuka otomatis." />
      <ScanPage />
    </div>
  );
}
