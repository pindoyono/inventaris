import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Pendaftaran Terkirim" };

export default async function TerkirimPage({ searchParams }: PageProps<"/daftar/terkirim">) {
  const { npsn } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Pendaftaran terkirim</h1>
      <Alert tone="success">
        Pendaftaran sekolah{typeof npsn === "string" ? ` dengan NPSN ${npsn}` : ""} sudah kami terima dan sedang menunggu
        pemeriksaan pengelola platform.
      </Alert>
      <p className="text-sm text-slate-600">
        Pengelola akan memeriksa NPSN dan status sekolah negeri, lalu menghubungi penanggung jawab bila perlu. Setelah
        disetujui, admin sekolah dapat masuk dengan NPSN, username, dan password yang tadi dibuat.
      </p>
      <Link href="/login" className="inline-block text-sm font-medium text-teal-700 hover:underline">Ke halaman masuk →</Link>
    </main>
  );
}
