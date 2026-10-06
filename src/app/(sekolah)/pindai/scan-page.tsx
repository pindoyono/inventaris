"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QrScanner, tokenFromText } from "@/components/qr-scanner";
import { lookupQr } from "@/lib/server/qr-lookup";

export function ScanPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const onResult = (text: string) => {
    const token = tokenFromText(text);
    if (!token) return setMsg("Bukan QR label Inventaris.");
    start(async () => {
      const a = await lookupQr(token);
      if (!a) return setMsg("Label ini bukan milik sekolah Anda atau barang tidak ditemukan.");
      setMsg(`Ditemukan: ${a.name} (${String(a.regNo).padStart(6, "0")})`);
      router.push(`/aset/${a.id}`);
    });
  };
  return (
    <div className="space-y-4">
      <QrScanner onResult={onResult} paused={busy} />
      {msg && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">{msg}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/aset?q=${encodeURIComponent(q.trim())}`); }} className="flex gap-2 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Atau ketik no. register / nama barang" className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2" />
        <button className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white">Cari</button>
      </form>
      <p className="text-xs text-slate-500">Label rusak? <Link href="/aset" className="underline">Cari di daftar aset</Link>. Kamera memerlukan HTTPS dan izin browser.</p>
    </div>
  );
}
