"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { CONDITION_LABEL, STATUS_LABEL } from "@/lib/assets-shared";
import { fmtRp } from "@/lib/decimal";
import { conditionAction, moveAssetsAction } from "./actions";

type Row = {
  id: string; bmdCode: string; regNo: number; name: string; brand: string | null; kib: string; acqDate: string; acqPrice: string;
  isIntra: boolean; condition: keyof typeof CONDITION_LABEL; status: keyof typeof STATUS_LABEL; room: string | null;
};
const COND_CLASS = { BAIK: "text-emerald-700", RUSAK_RINGAN: "text-amber-700", RUSAK_BERAT: "text-red-700" };

export function AssetTable({ rows, rooms, canEdit, today }: { rows: Row[]; rooms: { id: string; name: string }[]; canEdit: boolean; today: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"" | "pindah" | "kondisi">("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function apply() {
    start(async () => {
      const ids = [...sel];
      const res = mode === "pindah" ? await moveAssetsAction({ ids, roomId: target, date, note }) : await conditionAction({ ids, condition: target, date, note });
      if (res.errors) setMsg({ err: Object.values(res.errors)[0] });
      else { setMsg({ ok: res.ok }); setSel(new Set()); setMode(""); setTarget(""); setNote(""); }
    });
  }

  return (
    <div className="space-y-3">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      {canEdit && sel.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-end gap-2 rounded-lg border border-teal-600 bg-teal-50 p-3 text-sm">
          <span className="font-medium">{sel.size} dipilih</span>
          <select value={mode} onChange={(e) => { setMode(e.target.value as typeof mode); setTarget(""); }} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
            <option value="">Aksi…</option>
            <option value="pindah">Pindah ruangan</option>
            <option value="kondisi">Ubah kondisi</option>
          </select>
          {mode && (
            <>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
                <option value="">{mode === "pindah" ? "Ruangan tujuan…" : "Kondisi…"}</option>
                {mode === "pindah"
                  ? rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)
                  : Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Keterangan (opsional)" className="min-w-40 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5" />
              <Button type="button" disabled={pending || !target} onClick={apply}>{pending ? "Memproses…" : "Terapkan"}</Button>
            </>
          )}
          <a href={`/cetak/label?${[...sel].map((id) => `id=${id}`).join("&")}`} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-white px-2 py-1.5 hover:bg-slate-50">Cetak label</a>
          <button type="button" onClick={() => setSel(new Set())} className="text-slate-600 hover:underline">Batal pilih</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {canEdit && <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Pilih semua" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4 accent-teal-700" /></th>}
              <th className="px-3 py-2 font-medium">Kode barang · No. reg</th>
              <th className="px-3 py-2 font-medium">Nama / merk</th>
              <th className="px-3 py-2 font-medium">Ruangan</th>
              <th className="px-3 py-2 font-medium">Kondisi</th>
              <th className="px-3 py-2 text-right font-medium">Tahun</th>
              <th className="px-3 py-2 text-right font-medium">Harga (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Belum ada aset yang cocok.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={sel.has(r.id) ? "bg-teal-50" : ""}>
                {canEdit && <td className="px-3 py-2"><input type="checkbox" aria-label={`Pilih ${r.name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-teal-700" /></td>}
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.bmdCode} · {String(r.regNo).padStart(6, "0")}</td>
                <td className="px-3 py-2">
                  <Link href={`/aset/${r.id}`} className="font-medium text-teal-800 hover:underline">{r.name}</Link>
                  {r.brand && <span className="text-slate-500"> · {r.brand}</span>}
                  {!r.isIntra && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-600">ekstra</span>}
                  {r.status !== "DIGUNAKAN" && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">{STATUS_LABEL[r.status]}</span>}
                </td>
                <td className="px-3 py-2">{r.room ?? <span className="text-slate-400">—</span>}</td>
                <td className={`px-3 py-2 ${COND_CLASS[r.condition]}`}>{CONDITION_LABEL[r.condition]}</td>
                <td className="px-3 py-2 text-right">{r.acqDate.slice(0, 4)}</td>
                <td className="px-3 py-2 text-right">{fmtRp(r.acqPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
