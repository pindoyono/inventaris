"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { loanAction } from "../actions";

type Line = { id: string; assetId: string; label: string; out: boolean; condition: keyof typeof CONDITION_LABEL };

export function LoanActions({ id, status, petugas, own, lines }: { id: string; status: string; petugas: boolean; own: boolean; lines: Line[] }) {
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [reason, setReason] = useState("");
  const [cond, setCond] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.id, l.condition])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<string>>(new Set(lines.filter((l) => l.out).map((l) => l.id)));
  const [pending, start] = useTransition();
  const run = (input: Parameters<typeof loanAction>[1], confirmText: string) => {
    if (!confirm(confirmText)) return;
    start(async () => {
      const r = await loanAction(id, input);
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
    });
  };
  const out = lines.filter((l) => l.out);

  if (status === "DIAJUKAN" && (petugas || own))
    return (
      <section className="space-y-3 rounded-lg border border-teal-600 bg-white p-4 text-sm">
        {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
        {msg.err && <Alert>{msg.err}</Alert>}
        {petugas && (
          <>
            <h2 className="font-semibold">Serahkan barang</h2>
            {lines.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span>{l.label}</span>
                <select value={cond[l.id]} onChange={(e) => setCond({ ...cond, [l.id]: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1">
                  {Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            ))}
            <Button type="button" disabled={pending} onClick={() => run({ action: "SERAHKAN", conditions: Object.fromEntries(lines.map((l) => [l.assetId, cond[l.id]])) }, "Serahkan barang kepada peminjam?")}>Serahkan</Button>
          </>
        )}
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={petugas && !own ? "Alasan penolakan" : "Alasan (opsional)"} className="block w-full rounded-md border border-slate-300 px-2 py-1.5" />
          <Button type="button" variant={petugas && !own ? "danger" : "secondary"} disabled={pending} onClick={() => run({ action: petugas && !own ? "TOLAK" : "BATAL", reason }, petugas && !own ? "Tolak pengajuan?" : "Batalkan pengajuan?")}>
            {petugas && !own ? "Tolak" : "Batalkan pengajuan"}
          </Button>
        </div>
      </section>
    );

  if (status === "DIPINJAM" && petugas && out.length)
    return (
      <section className="space-y-3 rounded-lg border border-teal-600 bg-white p-4 text-sm">
        <h2 className="font-semibold">Terima pengembalian</h2>
        {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
        {msg.err && <Alert>{msg.err}</Alert>}
        {out.map((l) => (
          <div key={l.id} className="grid items-center gap-2 sm:grid-cols-[auto_1fr_10rem_1fr]">
            <input type="checkbox" checked={sel.has(l.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} className="size-4 accent-teal-700" />
            <span>{l.label}</span>
            <select value={cond[l.id]} onChange={(e) => setCond({ ...cond, [l.id]: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1">
              {Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={notes[l.id] ?? ""} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} placeholder="Catatan (mis. lensa tergores)" className="rounded-md border border-slate-300 px-2 py-1" />
          </div>
        ))}
        <Button type="button" disabled={pending || !sel.size} onClick={() => run({ action: "KEMBALI", returns: [...sel].map((lineId) => ({ lineId, condition: cond[lineId], note: notes[lineId] })) }, `Terima ${sel.size} barang kembali?`)}>
          Terima {sel.size} barang kembali
        </Button>
      </section>
    );

  return msg.ok ? <Alert tone="success">{msg.ok}</Alert> : null;
}
