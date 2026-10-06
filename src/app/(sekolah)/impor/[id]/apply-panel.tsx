"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { applyImport, type ApplyResult } from "../actions";

export function ApplyPanel({ id, status, valid, bad, result }: { id: string; status: string; valid: number; bad: number; result: { created?: number; detail?: string[] } | null }) {
  const [res, setRes] = useState<ApplyResult | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok)
    return (
      <div className="space-y-3">
        <Alert tone="success">{res.ok} {res.detail?.join(" · ")}</Alert>
        {res.passwords && res.passwords.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-amber-900">Password awal (hanya ditampilkan sekali — salin atau cetak sekarang). Pengguna wajib menggantinya saat pertama masuk.</p>
            <table className="mt-2 font-mono text-xs"><tbody>{res.passwords.map((p) => <tr key={p.username}><td className="pr-6">{p.username}</td><td>{p.password}</td></tr>)}</tbody></table>
            <button type="button" onClick={() => window.print()} className="mt-2 text-amber-900 underline">Cetak daftar ini</button>
          </div>
        )}
        <Link href="/impor" className="text-sm text-teal-700 hover:underline">← Impor lainnya</Link>
      </div>
    );
  if (status === "SELESAI")
    return <Alert tone="success">Impor ini sudah diproses: {result?.created ?? 0} data dibuat. {result?.detail?.join(" · ")}</Alert>;
  return (
    <div className="space-y-2">
      {res?.errors && <Alert>{Object.values(res.errors)[0]}</Alert>}
      {bad > 0 && <Alert tone="warning">{bad} baris bermasalah akan dilewati. Perbaiki di Excel lalu unggah ulang bila ingin semuanya masuk.</Alert>}
      <Button type="button" disabled={pending || valid === 0} onClick={() => { if (confirm(`Impor ${valid} baris valid?`)) start(async () => setRes(await applyImport(id))); }}>
        {pending ? "Mengimpor…" : `Impor ${valid} baris valid`}
      </Button>
    </div>
  );
}
