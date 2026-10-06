"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { finishMaintenanceAction } from "../actions";

export function FinishMaintenance({ id, today, cost, condition }: { id: string; today: string; cost: string; condition: string }) {
  const [date, setDate] = useState(today);
  const [cond, setCond] = useState(condition === "RUSAK_BERAT" ? "RUSAK_RINGAN" : "BAIK");
  const [c, setC] = useState(cost === "0" ? "" : cost);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
      <span className="text-slate-600">Selesai:</span>
      <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
      <select value={cond} onChange={(e) => setCond(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1">
        {Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>Kondisi: {l}</option>)}
      </select>
      <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Biaya (Rp)" inputMode="decimal" className="w-32 rounded-md border border-slate-300 px-2 py-1" />
      <Button type="button" disabled={pending} onClick={() => start(async () => { const r = await finishMaintenanceAction(id, { endDate: date, conditionAfter: cond, cost: c }); setMsg(r.errors ? Object.values(r.errors)[0] : r.ok ?? ""); })}>Tandai selesai</Button>
      {msg && <span className="text-xs text-slate-600">{msg}</span>}
    </div>
  );
}
