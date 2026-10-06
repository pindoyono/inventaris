"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { fmtNum, fmtRp, mulDec, normalizeIdNumber, parseDec } from "@/lib/decimal";
import { P_ACTION_LABEL, type PAction } from "@/lib/proposals-shared";
import { proposalActAction } from "../actions";

type Line = { id: string; label: string; qty: string; approved: string | null; price: string; uom: string };

export function ProposalActions({ id, actions, canEdit, budgetLeft, lines }: { id: string; actions: PAction[]; canEdit: boolean; budgetLeft: string | null; lines: Line[] }) {
  const deciding = actions.includes("VERIFIKASI") || actions.includes("SETUJUI");
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.id, String(Number(l.approved ?? l.qty))])));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const total = lines.reduce((a, l) => { try { return a + mulDec(parseDec(normalizeIdNumber(qty[l.id] || "0")), parseDec(l.price)); } catch { return a; } }, 0n);
  const over = budgetLeft !== null && total > BigInt(budgetLeft);
  const run = (a: PAction) => {
    if ((a === "TOLAK" || a === "KEMBALIKAN") && reason.trim().length < 5) return setMsg({ err: "Tulis alasan (minimal 5 karakter)" });
    if (!confirm(`${P_ACTION_LABEL[a]}?`)) return;
    start(async () => {
      const r = await proposalActAction(id, { action: a, reason, qty: deciding ? qty : undefined });
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
    });
  };
  return (
    <section className="space-y-3 rounded-lg border border-teal-600 bg-white p-4 text-sm">
      <h2 className="font-semibold">Tindakan Anda</h2>
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      {canEdit && <Link href={`/usulan/${id}/ubah`} className="text-teal-700 hover:underline">Ubah isi usulan</Link>}
      {deciding && (
        <div className="space-y-1">
          <p className="text-slate-600">Jumlah yang {actions.includes("VERIFIKASI") ? "diverifikasi" : "disetujui"} (boleh dikurangi):</p>
          {lines.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{l.label} <span className="text-xs text-slate-500">(diusulkan {fmtNum(l.qty)} {l.uom} @ Rp{fmtRp(l.price)})</span></span>
              <input value={qty[l.id]} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} inputMode="decimal" className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right" />
            </div>
          ))}
          <p className={over ? "font-medium text-red-700" : "text-slate-600"}>Nilai: Rp{fmtRp(total)}{budgetLeft !== null && <> · sisa pagu Rp{fmtRp(BigInt(budgetLeft))}{over && " — melebihi pagu"}</>}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.filter((a) => !["TOLAK", "KEMBALIKAN", "BATAL"].includes(a)).map((a) => <Button key={a} type="button" disabled={pending || (deciding && over && (a === "VERIFIKASI" || a === "SETUJUI"))} onClick={() => run(a)}>{P_ACTION_LABEL[a]}</Button>)}
      </div>
      {actions.some((a) => ["TOLAK", "KEMBALIKAN", "BATAL"].includes(a)) && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (wajib untuk tolak/kembalikan)" className="min-w-48 flex-1 rounded-md border border-slate-300 px-2 py-1.5" />
          {actions.includes("KEMBALIKAN") && <Button type="button" variant="secondary" disabled={pending} onClick={() => run("KEMBALIKAN")}>Kembalikan</Button>}
          {actions.includes("TOLAK") && <Button type="button" variant="danger" disabled={pending} onClick={() => run("TOLAK")}>Tolak</Button>}
          {actions.includes("BATAL") && <Button type="button" variant="secondary" disabled={pending} onClick={() => run("BATAL")}>Batalkan</Button>}
        </div>
      )}
    </section>
  );
}
