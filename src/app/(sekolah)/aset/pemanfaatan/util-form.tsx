"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fmtRp } from "@/lib/decimal";
import { UTIL_FORM_LABEL, UTIL_KIND_LABEL } from "@/lib/utilization-shared";
import { saveUtilizationAction, searchUtilizableAssets, type UtilPayload } from "./actions";

type Found = Awaited<ReturnType<typeof searchUtilizableAssets>>[number];
type Picked = Pick<Found, "id" | "name" | "bmdCode" | "regNo" | "acqPrice"> & { room: string | null; portion: string };
export type UtilInitial = Omit<UtilPayload, "lines"> & { lines: Picked[] };

export function UtilizationForm({ initial, edit, today }: { initial: UtilInitial; edit: boolean; today: string }) {
  const [f, setF] = useState<UtilInitial>(initial);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [searching, startSearch] = useTransition();
  const set = <K extends keyof UtilInitial>(k: K, v: UtilInitial[K]) => setF((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => startSearch(async () => setFound(await searchUtilizableAssets(q))), 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = () =>
    start(async () => {
      const r = await saveUtilizationAction({ ...f, lines: f.lines.map((l) => ({ assetId: l.id, portion: l.portion })) });
      if (r?.errors) setErr(r.errors._form ?? Object.values(r.errors)[0]);
    });

  return (
    <div className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <Card title="Jenis">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jenis kegiatan">
            <Select value={f.kind} onChange={(e) => { set("kind", e.target.value as UtilInitial["kind"]); if (e.target.value !== "PEMANFAATAN") set("form", ""); else if (!f.form) set("form", "SEWA"); }}>
              {Object.entries(UTIL_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          {f.kind === "PEMANFAATAN" && (
            <Field label="Bentuk pemanfaatan">
              <Select value={f.form ?? "SEWA"} onChange={(e) => set("form", e.target.value as "SEWA")}>
                {Object.entries(UTIL_FORM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Tahun anggaran RKBMD"><Input value={String(f.planYear)} onChange={(e) => set("planYear", e.target.value as unknown as number)} inputMode="numeric" /></Field>
          <Field label="Mitra/pihak pengguna"><Input value={f.partner ?? ""} onChange={(e) => set("partner", e.target.value)} placeholder="mis. Koperasi Sekolah / CV Kantin Sehat" /></Field>
          <div className="sm:col-span-2"><Field label="Peruntukan"><Input value={f.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="mis. kantin sekolah, menara telekomunikasi, gudang dinas" /></Field></div>
          <Field label="Rencana jangka waktu"><Input value={f.term ?? ""} onChange={(e) => set("term", e.target.value)} placeholder="mis. 1 tahun" /></Field>
          <Field label="Nilai kontribusi/sewa (Rp)"><Input value={f.contribution ?? ""} onChange={(e) => set("contribution", e.target.value)} inputMode="decimal" placeholder="0 untuk pinjam pakai" /></Field>
          <div className="sm:col-span-2"><Field label="Catatan"><Textarea rows={2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} /></Field></div>
        </div>
      </Card>
      {!edit && (
        <Card>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={!!f.running} onChange={(e) => set("running", e.target.checked)} className="mt-0.5 size-4 accent-teal-700" />
            <span>Sudah berjalan <span className="text-slate-500">(mencatat pemanfaatan yang sudah ada; bila tanpa nomor persetujuan akan tercatat “tanpa persetujuan” — Format C.11)</span></span>
          </label>
          {f.running && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal mulai"><Input type="date" max={today} value={f.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} /></Field>
              <Field label="Tanggal berakhir"><Input type="date" value={f.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} /></Field>
              <Field label="No. perjanjian"><Input value={f.agreementNo ?? ""} onChange={(e) => set("agreementNo", e.target.value)} /></Field>
              <Field label="Tgl. perjanjian"><Input type="date" value={f.agreementDate ?? ""} onChange={(e) => set("agreementDate", e.target.value)} /></Field>
              <Field label="No. surat persetujuan"><Input value={f.approvalNo ?? ""} onChange={(e) => set("approvalNo", e.target.value)} /></Field>
              <Field label="Tgl. persetujuan"><Input type="date" value={f.approvalDate ?? ""} onChange={(e) => set("approvalDate", e.target.value)} /></Field>
            </div>
          )}
        </Card>
      )}
      <Card title="Barang">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari barang: nama, kode, no. register…" />
        {q.trim().length >= 2 && (
          <ul className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-sm">
            {searching && <li className="px-3 py-2 text-slate-500">Mencari…</li>}
            {!searching && found.length === 0 && <li className="px-3 py-2 text-slate-500">Tidak ditemukan.</li>}
            {found.filter((x) => !f.lines.some((l) => l.id === x.id)).map((x) => (
              <li key={x.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => set("lines", [...f.lines, { ...x, portion: "" }])}>
                {x.name} <span className="font-mono text-xs text-slate-500">{x.bmdCode}.{String(x.regNo).padStart(6, "0")}</span><span className="block text-xs text-slate-500">{x.room ?? "—"} · Rp{fmtRp(x.acqPrice)}</span>
              </button></li>
            ))}
          </ul>
        )}
        <ul className="mt-3 space-y-2 text-sm">
          {f.lines.length === 0 && <li className="text-slate-500">Belum ada barang dipilih.</li>}
          {f.lines.map((l, i) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
              <span className="flex-1">{l.name} <span className="font-mono text-xs text-slate-500">{l.bmdCode}.{String(l.regNo).padStart(6, "0")}</span></span>
              <input value={l.portion} onChange={(e) => set("lines", f.lines.map((x, j) => (j === i ? { ...x, portion: e.target.value } : x)))} placeholder="Bagian/luas (opsional)" className="w-48 rounded-md border border-slate-300 px-2 py-1" />
              <button type="button" className="text-red-600 hover:underline" onClick={() => set("lines", f.lines.filter((_, j) => j !== i))}>Hapus</button>
            </li>
          ))}
        </ul>
      </Card>
      <Button type="button" disabled={pending || !f.lines.length} onClick={submit}>{pending ? "Menyimpan…" : "Simpan"}</Button>
    </div>
  );
}
