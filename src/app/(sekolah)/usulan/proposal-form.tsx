"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { fmtRp, mulDec, normalizeIdNumber, parseDec } from "@/lib/decimal";
import { PRIORITY_LABEL } from "@/lib/proposals-shared";
import { saveProposalAction, type ProposalPayload } from "./actions";
import { searchAssetCodes } from "../aset/actions";
import type { ProposalOptions } from "./data";

type Line = { kind: "PERSEDIAAN" | "ASET"; itemId: string; bmdCode: string; codeName: string; description: string; uom: string; qty: string; estPrice: string; reason: string; priority: number };
const blank = (kind: Line["kind"]): Line => ({ kind, itemId: "", bmdCode: "", codeName: "", description: "", uom: kind === "ASET" ? "Unit" : "Buah", qty: "1", estPrice: "", reason: "", priority: 2 });
const safe = (v: string) => { try { return parseDec(normalizeIdNumber(v || "0")); } catch { return null; } };

export function ProposalForm({ opts, initial }: { opts: ProposalOptions; initial: Omit<ProposalPayload, "lines"> & { lines: Line[] } }) {
  const [d, setD] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof d>) => setD({ ...d, ...patch });
  const upd = (i: number, patch: Partial<Line>) => set({ lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const total = d.lines.reduce((a, l) => { const q = safe(l.qty), p = safe(l.estPrice); return q !== null && p !== null ? a + mulDec(q, p) : a; }, 0n);
  function submit(andSubmit: boolean) {
    start(async () => {
      const r = await saveProposalAction({ ...d, lines: d.lines.map((l) => ({ kind: l.kind, itemId: l.itemId || null, bmdCode: l.bmdCode || null, description: l.description, uom: l.uom, qty: l.qty, estPrice: l.estPrice, reason: l.reason, priority: l.priority })) }, andSubmit);
      if (r?.errors) setErr(r.errors._form ?? Object.values(r.errors)[0]);
    });
  }
  if (!opts.units.length) return <Alert tone="warning">Akun Anda belum ditetapkan ke unit. Minta Admin menambahkan unit pada akun Anda.</Alert>;
  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      <Card title="Usulan">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Judul / keperluan"><Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="mis. Kebutuhan praktik jaringan semester genap" /></Field></div>
          <Field label="Unit"><Select value={d.unitId} onChange={(e) => set({ unitId: e.target.value })}><option value="">Pilih unit…</option>{opts.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Tahun anggaran"><Input type="number" value={String(d.year)} onChange={(e) => set({ year: Number(e.target.value) })} /></Field>
          <Field label="Sumber dana"><Select value={d.fundingSourceId ?? ""} onChange={(e) => set({ fundingSourceId: e.target.value, fundingComponentId: "" })}><option value="">—</option>{opts.fundingSources.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
          <Field label="Komponen penggunaan dana"><Select value={d.fundingComponentId ?? ""} onChange={(e) => set({ fundingComponentId: e.target.value })} disabled={!d.fundingSourceId}><option value="">—</option>{opts.fundingComponents.filter((c) => c.sourceId === d.fundingSourceId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        </div>
      </Card>
      <Card title="Barang yang diusulkan" actions={<span className="text-sm text-slate-600">Perkiraan total: <b>Rp{fmtRp(total)}</b></span>}>
        <div className="space-y-3">
          {d.lines.map((l, i) => (
            <div key={i} className="space-y-2 rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">#{i + 1}</span>
                <Select value={l.kind} onChange={(e) => upd(i, { ...blank(e.target.value as Line["kind"]), qty: l.qty, estPrice: l.estPrice })} className="w-44"><option value="PERSEDIAAN">Persediaan (habis pakai)</option><option value="ASET">Aset tetap</option></Select>
                <Select value={String(l.priority)} onChange={(e) => upd(i, { priority: Number(e.target.value) })} className="w-36">{[1, 2, 3].map((p) => <option key={p} value={p}>Prioritas {PRIORITY_LABEL[p].toLowerCase()}</option>)}</Select>
                <span className="flex-1" />
                <button type="button" className="text-red-600 hover:underline" onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}>Hapus</button>
              </div>
              {l.kind === "PERSEDIAAN" ? (
                <Select value={l.itemId} onChange={(e) => { const it = opts.items.find((x) => x.id === e.target.value); upd(i, { itemId: e.target.value, description: it?.name ?? l.description, uom: it?.uom ?? l.uom }); }}>
                  <option value="">Barang baru / belum terdaftar (tulis uraian di bawah)</option>
                  {opts.items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.nusp})</option>)}
                </Select>
              ) : (
                <AssetCode value={l.bmdCode ? { code: l.bmdCode, name: l.codeName } : null} onChange={(c) => upd(i, { bmdCode: c?.code ?? "", codeName: c?.name ?? "", description: l.description || c?.name || "" })} />
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_9rem]">
                <Input value={l.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Uraian/spesifikasi barang" />
                <Input value={l.qty} onChange={(e) => upd(i, { qty: e.target.value })} inputMode="decimal" placeholder="Jumlah" />
                <Input value={l.uom} onChange={(e) => upd(i, { uom: e.target.value })} list="uoms" placeholder="Satuan" />
                <Input value={l.estPrice} onChange={(e) => upd(i, { estPrice: e.target.value })} inputMode="decimal" placeholder="Harga satuan (Rp)" />
              </div>
              <Input value={l.reason} onChange={(e) => upd(i, { reason: e.target.value })} placeholder="Alasan/kegunaan (opsional)" />
            </div>
          ))}
          <datalist id="uoms">{opts.uoms.map((u) => <option key={u} value={u} />)}</datalist>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => set({ lines: [...d.lines, blank("PERSEDIAAN")] })}>+ Persediaan</Button>
            <Button type="button" variant="secondary" onClick={() => set({ lines: [...d.lines, blank("ASET")] })}>+ Aset tetap</Button>
          </div>
        </div>
      </Card>
      <div className="flex gap-3">
        <Button type="button" disabled={pending || !d.lines.length} onClick={() => submit(true)}>{pending ? "Memproses…" : "Ajukan"}</Button>
        <Button type="button" variant="secondary" disabled={pending || !d.lines.length} onClick={() => submit(false)}>Simpan draf</Button>
      </div>
    </div>
  );
}

function AssetCode({ value, onChange }: { value: { code: string; name: string } | null; onChange: (c: { code: string; name: string } | null) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ code: string; name: string; parent: string }[]>([]);
  const [, start] = useTransition();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setRes(await searchAssetCodes(q))), 250);
    return () => clearTimeout(t);
  }, [q]);
  if (value) return <div className="flex justify-between rounded-md bg-teal-50 px-3 py-1.5"><span><span className="font-mono text-xs">{value.code}</span> {value.name}</span><button type="button" className="text-teal-800 hover:underline" onClick={() => onChange(null)}>Ganti</button></div>;
  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kode barang aset: ketik laptop, proyektor, meja siswa… (boleh dikosongkan)" />
      {q.trim().length >= 2 && res.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {res.map((c) => <li key={c.code}><button type="button" className="w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => { onChange(c); setQ(""); }}><span className="font-mono text-xs text-slate-500">{c.code}</span> {c.name}</button></li>)}
        </ul>
      )}
    </div>
  );
}
