"use client";

import { useState, useTransition } from "react";
import { markKirPrinted } from "./kir-actions";

export function KirMark({ roomId, reasons }: { roomId: string; reasons: string[] }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
      {reasons.length ? <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">KIR perlu diperbarui: {reasons.join(", ")}</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">KIR mutakhir</span>}
      <button type="button" disabled={pending} onClick={() => { if (confirm("Tandai KIR ruangan ini sudah dicetak rangkap 2 & ditempel?")) start(async () => { const r = await markKirPrinted(roomId); setMsg(r.errors ? Object.values(r.errors)[0] : r.ok ?? ""); }); }}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50">Tandai sudah dicetak & ditempel</button>
      {msg && <span className="text-slate-600">{msg}</span>}
    </div>
  );
}
