"use client";

import { useState, useTransition } from "react";
import { QrScanner, tokenFromText } from "@/components/qr-scanner";
import { lookupQr, type ScannedAsset } from "@/lib/server/qr-lookup";

/** Tombol "Pindai QR" yang membuka kamera (modal) dan mengembalikan aset hasil pindai; bisa pindai berulang */
export function ScanButton({ onAsset, label = "Pindai QR" }: { onAsset: (a: ScannedAsset) => string | void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const onResult = (text: string) => {
    const token = tokenFromText(text);
    if (!token) return setMsg("Bukan QR label Inventaris.");
    start(async () => {
      const a = await lookupQr(token);
      if (!a) return setMsg("Label bukan milik sekolah ini.");
      setMsg(onAsset(a) || `✓ ${a.name} (${String(a.regNo).padStart(6, "0")})`);
    });
  };
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setMsg(""); }} className="rounded-md border border-teal-600 bg-white px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50">📷 {label}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal>
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4">
            <div className="flex justify-between"><b>Pindai label barang</b><button type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:underline">Selesai</button></div>
            <QrScanner onResult={onResult} paused={busy} />
            {msg && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">{msg}</p>}
            <p className="text-xs text-slate-500">Bisa memindai beberapa label berturut-turut, lalu tekan Selesai.</p>
          </div>
        </div>
      )}
    </>
  );
}
