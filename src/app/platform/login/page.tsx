import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = { title: "Masuk Pengelola Platform", robots: { index: false } };

export default function PlatformLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Pengelola platform</h1>
        <p className="mt-1 text-sm text-slate-600">Khusus pengelola Inventaris.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
        <LoginForm kind="platform" />
      </div>
    </main>
  );
}
