import type { Metadata } from "next";
import Link from "next/link";
import { RequestForm } from "./forms";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function LupaSandiPage() {
  return (
    <main className="mx-auto w-full max-w-sm space-y-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Lupa kata sandi</h1>
        <p className="mt-1 text-sm text-slate-600">Tautan atur ulang dikirim ke email yang tercatat pada akun Anda.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs"><RequestForm /></div>
      <p className="text-center text-sm"><Link href="/login" className="font-medium text-teal-700 hover:underline">← Kembali ke halaman masuk</Link></p>
    </main>
  );
}
