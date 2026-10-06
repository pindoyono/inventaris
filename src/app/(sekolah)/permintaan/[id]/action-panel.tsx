"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { ACTION_LABEL, type ReqAction } from "@/lib/requests-shared";
import { fmtNum } from "@/lib/decimal";
import { requestActAction } from "../actions";

type Line = { id: string; itemId: string; name: string; uom: string; requested: string; approved: string | null };

export function ActionPanel(props: {
  id: string; actions: ReqAction[]; mode: "LENGKAP" | "RINGKAS"; canEditDraft: boolean; today: string;
  warehouses: { id: string; name: string; isDefault: boolean }[]; stock: Record<string, Record<string, string>>; lines: Line[];
}) {
  const { id, actions, mode, lines } = props;
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [reason, setReason] = useState("");
  const [wh, setWh] = useState(props.warehouses.find((w) => w.isDefault)?.id ?? props.warehouses[0]?.id ?? "");
  const [date, setDate] = useState(props.today);
  const cap = (l: Line) => (mode === "LENGKAP" && l.approved !== null ? l.approved : l.requested);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.id, String(Number(cap(l)))])));
  const [pending, start] = useTransition();
  const needsQty = actions.includes("TERUSKAN") || actions.includes("SALURKAN");
  const distributing = actions.includes("SALURKAN");

  function run(action: ReqAction) {
    const needsReason = action === "TOLAK" || action === "KEMBALIKAN";
    if (needsReason && reason.trim().length < 5) return setMsg({ err: "Tulis alasan (minimal 5 karakter)" });
    if (!confirm(`${ACTION_LABEL[action]}?`)) return;
    start(async () => {
      const res = await requestActAction(id, {
        action, reason: needsReason || action === "BATAL" ? reason : undefined,
        qty: action === "TERUSKAN" || action === "SALURKAN" ? qty : undefined,
        warehouseId: action === "SALURKAN" ? wh : undefined,
        date: action === "SALURKAN" ? date : undefined,
      });
      setMsg(res.errors ? { err: Object.values(res.errors)[0] } : { ok: res.ok });
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-teal-600 bg-white p-4 text-sm">
      <h2 className="font-semibold">Tindakan Anda</h2>
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      {props.canEditDraft && <Link href={`/permintaan/${id}/ubah`} className="block text-teal-700 hover:underline">Ubah isi nota</Link>}

      {needsQty && (
        <div className="space-y-2">
          {distributing && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1"><span className="text-slate-600">Gudang</span>
                <select value={wh} onChange={(e) => setWh(e.target.value)} className="block w-full rounded-md border border-slate-300 px-2 py-1.5">
                  {props.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select></label>
              <label className="space-y-1"><span className="text-slate-600">Tanggal BAST</span>
                <input type="date" value={date} max={props.today} onChange={(e) => setDate(e.target.value)} className="block w-full rounded-md border border-slate-300 px-2 py-1.5" /></label>
            </div>
          )}
          <p className="text-slate-600">{distributing ? "Jumlah disalurkan" : "Jumlah yang diteruskan untuk disetujui"}:</p>
          {lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate" title={l.name}>{l.name}
                <span className="block text-xs text-slate-500">maks {fmtNum(cap(l))}{distributing ? ` · stok ${fmtNum(props.stock[l.itemId]?.[wh] ?? "0")}` : ""}</span>
              </span>
              <input value={qty[l.id]} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} inputMode="decimal" className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right" />
              <span className="w-10 text-xs text-slate-500">{l.uom}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {actions.filter((a) => !["TOLAK", "KEMBALIKAN", "BATAL"].includes(a)).map((a) => (
          <Button key={a} type="button" disabled={pending} onClick={() => run(a)}>{ACTION_LABEL[a]}</Button>
        ))}
      </div>
      {actions.some((a) => ["TOLAK", "KEMBALIKAN", "BATAL"].includes(a)) && (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Alasan (wajib untuk tolak/kembalikan)" className="block w-full rounded-md border border-slate-300 px-2 py-1.5" />
          <div className="flex flex-wrap gap-2">
            {actions.includes("KEMBALIKAN") && <Button type="button" variant="secondary" disabled={pending} onClick={() => run("KEMBALIKAN")}>Kembalikan</Button>}
            {actions.includes("TOLAK") && <Button type="button" variant="danger" disabled={pending} onClick={() => run("TOLAK")}>Tolak</Button>}
            {actions.includes("BATAL") && <Button type="button" variant="secondary" disabled={pending} onClick={() => run("BATAL")}>Batalkan nota</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
