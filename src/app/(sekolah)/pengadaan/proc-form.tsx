"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fmtRp, mulDec, normalizeIdNumber, parseDec } from "@/lib/decimal";
import { saveProcurementAction, type ProcPayload } from "./actions";

type Opt = { id: string; name: string };
type Line = { proposalLineId: string; kind: "PERSEDIAAN" | "ASET"; itemId: string; bmdCode: string; description: string; brand: string; qty: string; unitPrice: string; max?: string; lockCode?: boolean };
const safe = (v: string) => { try { return parseDec(normalizeIdNumber(v || "0")); } catch { return null; } };

export function ProcForm({ initial, vendors, sources, components, items, today, fromProposal }: {
  initial: Omit<ProcPayload, "lines"> & { lines: Line[] }; vendors: Opt[]; sources: Opt[]; components: (Opt & { sourceId: string })[]; items: (Opt & { nusp: string })[]; today: string; fromProposal: string | null;
}) {
  const [d, setD] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p });
  const upd = (i: number, p: Partial<Line>) => set({ lines: d.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const total = d.lines.reduce((a, l) => { const q = safe(l.qty), p = safe(l.unitPrice); return q !== null && p !== null ? a + mulDec(q, p) : a; }, 0n);
  const submit = (order: boolean) => start(async () => {
    const r = await saveProcurementAction({ ...d, lines: d.lines.map((l) => ({ proposalLineId: l.proposalLineId || null, kind: l.kind, itemId: l.itemId || null, bmdCode: l.bmdCode || null, description: l.description, brand: l.brand, qty: l.qty, unitPrice: l.unitPrice })) }, order);
    if (r?.errors) setErr(r.errors._form ?? Object.values(r.errors)[0]);
  });
  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      {fromProposal && <Alert tone="info">Dari usulan {fromProposal}. Jumlah terisi sisa yang disetujui; harga diisi sesuai penawaran/nota.</Alert>}
      <Card title="Pengadaan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal pesan"><Input type="date" max={today} value={d.orderDate} onChange={(e) => set({ orderDate: e.target.value })} /></Field>
          <Field label="Penyedia" hint={vendors.length ? undefined : "Tambahkan penyedia di Data Dasar"}><Select value={d.vendorId ?? ""} onChange={(e) => set({ vendorId: e.target.value })}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
          <Field label="Nomor nota/kuitansi/faktur"><Input value={d.refNumber ?? ""} onChange={(e) => set({ refNumber: e.target.value })} /></Field>
          <Field label="Tanggal nota"><Input type="date" max={today} value={d.refDate ?? ""} onChange={(e) => set({ refDate: e.target.value })} /></Field>
          <Field label="Sumber dana"><Select value={d.fundingSourceId ?? ""} onChange={(e) => set({ fundingSourceId: e.target.value, fundingComponentId: "" })}><option value="">—</option>{sources.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
          <Field label="Komponen dana"><Select value={d.fundingComponentId ?? ""} onChange={(e) => set({ fundingComponentId: e.target.value })} disabled={!d.fundingSourceId}><option value="">—</option>{components.filter((c) => c.sourceId === d.fundingSourceId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Pajak (Rp, dicatat)" hint="PPN/PPh yang tertera di nota; tidak mengubah harga satuan"><Input value={d.taxAmount ?? ""} onChange={(e) => set({ taxAmount: e.target.value })} inputMode="decimal" /></Field>
          <div className="sm:col-span-2"><Field label="Catatan"><Textarea rows={2} value={d.note ?? ""} onChange={(e) => set({ note: e.target.value })} /></Field></div>
        </div>
      </Card>
      <Card title="Barang" actions={<span className="text-sm text-slate-600">Total: <b>Rp{fmtRp(total)}</b></span>}>
        <div className="space-y-3">
          {d.lines.map((l, i) => (
            <div key={i} className="space-y-2 rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">#{i + 1} {l.kind === "ASET" ? "Aset" : "Persediaan"}</span>
                {l.kind === "ASET" && <span className="font-mono text-xs text-slate-500">{l.bmdCode || "kode belum dipilih"}</span>}
                {l.max && <span className="text-xs text-slate-500">maks. {l.max}</span>}
                <span className="flex-1" />
                <button type="button" className="text-red-600 hover:underline" onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}>Hapus</button>
              </div>
              {l.kind === "PERSEDIAAN" && (
                <Select value={l.itemId} onChange={(e) => upd(i, { itemId: e.target.value, description: items.find((x) => x.id === e.target.value)?.name ?? l.description })}>
                  <option value="">Barang persediaan (NUSP) — boleh dipilih saat diterima</option>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.nusp})</option>)}
                </Select>
              )}
              {l.kind === "ASET" && !l.lockCode && <Input value={l.bmdCode} onChange={(e) => upd(i, { bmdCode: e.target.value })} placeholder="Kode barang aset, mis. 1.3.2.10.01.02.002" />}
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem_6rem_9rem]">
                <Input value={l.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Uraian barang" />
                <Input value={l.brand} onChange={(e) => upd(i, { brand: e.target.value })} placeholder="Merk/tipe" />
                <Input value={l.qty} onChange={(e) => upd(i, { qty: e.target.value })} inputMode="decimal" placeholder="Jumlah" />
                <Input value={l.unitPrice} onChange={(e) => upd(i, { unitPrice: e.target.value })} inputMode="decimal" placeholder="Harga satuan" />
              </div>
            </div>
          ))}
          {!fromProposal && (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => set({ lines: [...d.lines, { proposalLineId: "", kind: "PERSEDIAAN", itemId: "", bmdCode: "", description: "", brand: "", qty: "1", unitPrice: "" }] })}>+ Persediaan</Button>
              <Button type="button" variant="secondary" onClick={() => set({ lines: [...d.lines, { proposalLineId: "", kind: "ASET", itemId: "", bmdCode: "", description: "", brand: "", qty: "1", unitPrice: "" }] })}>+ Aset tetap</Button>
            </div>
          )}
        </div>
      </Card>
      <div className="flex gap-3">
        <Button type="button" disabled={pending || !d.lines.length} onClick={() => submit(true)}>{pending ? "Menyimpan…" : "Simpan & tandai dipesan"}</Button>
        <Button type="button" variant="secondary" disabled={pending || !d.lines.length} onClick={() => submit(false)}>Simpan draf</Button>
      </div>
    </div>
  );
}
