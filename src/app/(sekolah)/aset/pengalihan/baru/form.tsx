"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fmtRp } from "@/lib/decimal";
import { createTransferAction, searchTransferableAssets } from "../actions";

type Found = Awaited<ReturnType<typeof searchTransferableAssets>>[number];

export function TransferForm({ today, destinations }: { today: string; destinations: { id: string; label: string }[] }) {
  const [f, setF] = useState({ toSchoolId: destinations[0]?.id ?? "", toName: "", date: today, reason: "", approvalNo: "", approvalDate: "", note: "" });
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [searching, startSearch] = useTransition();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => startSearch(async () => setFound(await searchTransferableAssets(q))), 250);
    return () => clearTimeout(t);
  }, [q]);
  const submit = () => start(async () => {
    const r = await createTransferAction({ ...f, assetIds: picked.map((p) => p.id) });
    if (r?.errors) setErr(r.errors._form ?? Object.values(r.errors)[0]);
  });
  return (
    <div className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <Card title="Penerima">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Sekolah penerima" hint={destinations.length ? "Sekolah aktif di bawah Pengguna Barang yang sama" : "Belum ada sekolah lain di bawah Pengguna Barang yang sama di aplikasi ini"}>
              <Select value={f.toSchoolId} onChange={set("toSchoolId")}>
                {destinations.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                <option value="">Penerima di luar aplikasi (OPD/sekolah lain)…</option>
              </Select>
            </Field>
          </div>
          {!f.toSchoolId && <div className="sm:col-span-2"><Field label="Nama penerima"><Input value={f.toName} onChange={set("toName")} placeholder="mis. SMP Negeri 3 / Dinas Pendidikan" /></Field></div>}
          <Field label="Tanggal"><Input type="date" max={today} value={f.date} onChange={set("date")} /></Field>
          <Field label="Nomor surat persetujuan Pengguna Barang"><Input value={f.approvalNo} onChange={set("approvalNo")} placeholder="boleh diisi saat penyerahan" /></Field>
          <div className="sm:col-span-2"><Field label="Alasan"><Input value={f.reason} onChange={set("reason")} placeholder="mis. pemerataan sarana, kelebihan barang" /></Field></div>
          <div className="sm:col-span-2"><Field label="Catatan"><Textarea rows={2} value={f.note} onChange={set("note")} /></Field></div>
        </div>
      </Card>
      <Card title="Barang">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari barang: nama, kode, no. register…" />
        {q.trim().length >= 2 && (
          <ul className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-sm">
            {searching && <li className="px-3 py-2 text-slate-500">Mencari…</li>}
            {!searching && found.filter((x) => !picked.some((p) => p.id === x.id)).length === 0 && <li className="px-3 py-2 text-slate-500">Tidak ada.</li>}
            {found.filter((x) => !picked.some((p) => p.id === x.id)).map((x) => (
              <li key={x.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => setPicked([...picked, x])}>{x.name} <span className="font-mono text-xs text-slate-500">{x.bmdCode}.{String(x.regNo).padStart(6, "0")}</span><span className="block text-xs text-slate-500">{x.room ?? "—"} · Rp{fmtRp(x.acqPrice)}</span></button></li>
            ))}
          </ul>
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {picked.length === 0 && <li className="text-slate-500">Belum ada barang dipilih.</li>}
          {picked.map((p) => <li key={p.id} className="flex justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5"><span>{p.name} <span className="font-mono text-xs text-slate-500">{p.bmdCode}.{String(p.regNo).padStart(6, "0")}</span></span><button type="button" className="text-red-600 hover:underline" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}>Hapus</button></li>)}
        </ul>
      </Card>
      <Button type="button" disabled={pending || !picked.length} onClick={submit}>{pending ? "Menyimpan…" : "Simpan draf"}</Button>
    </div>
  );
}
