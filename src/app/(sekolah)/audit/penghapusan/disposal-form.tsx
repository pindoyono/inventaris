"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { fmtRp } from "@/lib/decimal";
import { saveDisposalAction, searchDisposableAssets } from "../actions";

type Found = Awaited<ReturnType<typeof searchDisposableAssets>>[number];
type Reason = "RUSAK_BERAT" | "USANG" | "KECURIAN" | "HILANG" | "TERBAKAR_SUSUT" | "KAHAR" | "INVENTARISASI";
const REASONS: Record<Reason, string> = {
  RUSAK_BERAT: "Rusak berat", USANG: "Usang/tidak dapat digunakan", KECURIAN: "Hilang karena kecurian", HILANG: "Hilang/tidak ditemukan",
  TERBAKAR_SUSUT: "Terbakar/susut/kedaluwarsa", KAHAR: "Keadaan kahar (bencana)", INVENTARISASI: "Tindak lanjut hasil inventarisasi",
};
type Line = Found & { reason: Reason; followUp: "PEMUSNAHAN" | "PEMINDAHTANGANAN"; policeLetter: string; note: string };

export function DisposalForm({ initial, today }: { initial: { id?: string; date: string; note: string; lines: Line[] }; today: string }) {
  const [d, setD] = useState(initial);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setFound(await searchDisposableAssets(q))), 250);
    return () => clearTimeout(t);
  }, [q]);
  // Pembaruan fungsional: aman bila beberapa penambahan berjalan bersamaan
  const add = (list: Found[]) =>
    setD((cur) => ({
      ...cur,
      lines: [
        ...cur.lines,
        ...list
          .filter((f) => !cur.lines.some((l) => l.id === f.id))
          .map((f) => ({ ...f, reason: (f.status === "HILANG" ? "HILANG" : f.condition === "RUSAK_BERAT" ? "RUSAK_BERAT" : "USANG") as Reason, followUp: "PEMUSNAHAN" as const, policeLetter: "", note: "" })),
      ],
    }));
  const preset = (p: "RUSAK_BERAT" | "HILANG") => start(async () => add(await searchDisposableAssets("", p)));
  const upd = (i: number, patch: Partial<Line>) => setD({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  function submit() {
    start(async () => {
      const r = await saveDisposalAction({ id: d.id, date: d.date, note: d.note, lines: d.lines.map((l) => ({ assetId: l.id, reason: l.reason, followUp: l.followUp, policeLetter: l.policeLetter, note: l.note })) });
      if (r?.errors) setErr(r.errors._form ?? Object.values(r.errors)[0]);
    });
  }
  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      <Card title="Usulan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal"><Input type="date" value={d.date} max={today} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Keterangan (opsional)"><Textarea rows={2} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></Field></div>
        </div>
      </Card>
      <Card title="Barang yang diusulkan">
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => preset("RUSAK_BERAT")}>+ Semua yang rusak berat</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => preset("HILANG")}>+ Semua yang berstatus hilang</Button>
        </div>
        <div className="relative mb-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama/merk/no. register…" />
          {q.trim().length >= 2 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {found.filter((f) => !d.lines.some((l) => l.id === f.id)).map((f) => (
                <li key={f.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { add([f]); setQ(""); }}>
                  {f.name} <span className="font-mono text-xs text-slate-500">reg. {String(f.regNo).padStart(6, "0")}</span>
                  <span className="block text-xs text-slate-500">{f.room ?? "—"} · {CONDITION_LABEL[f.condition]}{f.status !== "DIGUNAKAN" ? ` · ${f.status.toLowerCase().replaceAll("_", " ")}` : ""}</span>
                </button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3">
          {d.lines.length === 0 && <p className="text-center text-sm text-slate-500">Belum ada barang.</p>}
          {d.lines.map((l, i) => (
            <div key={l.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span><strong>{l.name}</strong>{l.brand ? ` · ${l.brand}` : ""} <span className="font-mono text-xs text-slate-500">{l.bmdCode} · {String(l.regNo).padStart(6, "0")}</span>
                  <span className="block text-xs text-slate-500">Perolehan {l.acqDate.slice(0, 4)} · Rp{fmtRp(l.acqPrice)} · {l.room ?? "—"} · {CONDITION_LABEL[l.condition]}</span></span>
                <button type="button" className="text-red-600 hover:underline" onClick={() => setD({ ...d, lines: d.lines.filter((_, j) => j !== i) })}>Hapus</button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <select value={l.reason} onChange={(e) => upd(i, { reason: e.target.value as Reason })} className="rounded-md border border-slate-300 px-2 py-1">
                  {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {(l.reason === "RUSAK_BERAT" || l.reason === "USANG") && (
                  <select value={l.followUp} onChange={(e) => upd(i, { followUp: e.target.value as Line["followUp"] })} className="rounded-md border border-slate-300 px-2 py-1" title="Tindak lanjut (Permendagri 7/2024 Format C.23)">
                    <option value="PEMUSNAHAN">Diusulkan pemusnahan</option>
                    <option value="PEMINDAHTANGANAN">Diusulkan pemindahtanganan (dijual/dihibahkan)</option>
                  </select>
                )}
                {l.reason === "KECURIAN" && <input value={l.policeLetter} onChange={(e) => upd(i, { policeLetter: e.target.value })} placeholder="No. surat keterangan kepolisian (wajib)" className="rounded-md border border-slate-300 px-2 py-1" />}
                <input value={l.note} onChange={(e) => upd(i, { note: e.target.value })} placeholder="Keterangan" className="rounded-md border border-slate-300 px-2 py-1" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Button type="button" disabled={pending || !d.lines.length} onClick={submit}>{pending ? "Menyimpan…" : "Simpan draf usulan"}</Button>
    </div>
  );
}
