import type { Metadata } from "next";
import Link from "next/link";
import { checkResetToken } from "@/lib/server/password-reset";
import { Alert } from "@/components/ui";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Atur ulang kata sandi", referrer: "no-referrer" };

export default async function ResetPage({ params }: PageProps<"/lupa-sandi/[token]">) {
  const { token } = await params;
  const ok = await checkResetToken(token);
  return (
    <main className="mx-auto w-full max-w-sm space-y-6 px-4 py-16">
      <h1 className="text-center text-xl font-semibold">Atur ulang kata sandi</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
        {ok ? <ResetForm token={token} /> : <div className="space-y-3"><Alert>Tautan tidak berlaku — kedaluwarsa (30 menit) atau sudah dipakai.</Alert><Link href="/lupa-sandi" className="block text-center font-medium text-teal-700 hover:underline">Minta tautan baru</Link></div>}
      </div>
    </main>
  );
}
