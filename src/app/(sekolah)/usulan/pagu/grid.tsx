"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { fmtRp } from "@/lib/decimal";
import { saveBudgetAction } from "../actions";

export function BudgetGrid({ year, units, sources, values, used }: { year: number; units: { id: string; name: string }[]; sources: { id: string; name: string }[]; values: Record<string, string>; used: Record<string, string> }) {
  const [v, setV] = useState(values);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  if (!units.length) return <Alert tone="warning">Belum ada unit. Tambahkan di Data Dasar.</Alert>;
  return (
    <div className="space-y-3">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="text-sm">
          <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Unit</th>{sources.map((f) => <th key={f.id} className="px-3 py-2 font-medium whitespace-nowrap">{f.name}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 whitespace-nowrap">{u.name}</td>
                {sources.map((f) => {
                  const k = `${u.id}|${f.id}`;
                  return (
                    <td key={f.id} className="px-3 py-2">
                      <input value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} inputMode="decimal" placeholder="—" className="w-32 rounded-md border border-slate-300 px-2 py-1 text-right" />
                      {used[k] && Number(used[k]) > 0 && <span className="block text-xs text-slate-500">terpakai Rp{fmtRp(used[k])}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" disabled={pending} onClick={() => start(async () => { const r = await saveBudgetAction(year, v); setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok }); })}>{pending ? "Menyimpan…" : "Simpan pagu"}</Button>
    </div>
  );
}
