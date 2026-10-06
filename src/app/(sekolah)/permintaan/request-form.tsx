"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fmtNum } from "@/lib/decimal";
import type { FieldErrors } from "@/lib/validations";
import { saveRequestAction, type RequestPayload } from "./actions";
import type { RequestOptions } from "./data";

type Line = { itemId: string; qty: string; note: string };

export function RequestForm({ opts, today, initial }: { opts: RequestOptions; today: string; initial: { id?: string; unitId: string; date: string; purpose: string; lines: Line[] } }) {
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const byId = new Map(opts.items.map((i) => [i.id, i]));
  const matches = q.trim()
    ? opts.items.filter((i) => !d.lines.some((l) => l.itemId === i.id) && `${i.nusp} ${i.name} ${i.spec ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
    : [];
  const setLine = (i: number, k: keyof Line, v: string) => setD({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });

  function submit(andSubmit: boolean) {
    start(async () => {
      const res = await saveRequestAction(d as RequestPayload, andSubmit);
      setErrors(res?.errors ?? {});
    });
  }
  const e = errors;

  if (!opts.units.length)
    return <Alert tone="warning">Akun Anda belum ditetapkan ke unit mana pun. Minta Admin Sekolah menambahkan unit pada akun Anda (menu Pengguna).</Alert>;

  return (
    <div className="space-y-6">
      {Object.keys(e).length > 0 && <Alert>{e._form ?? Object.values(e)[0]}</Alert>}
      <Card title="Nota permintaan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unit peminta" error={e.unitId}>
            <Select value={d.unitId} onChange={(ev) => setD({ ...d, unitId: ev.target.value })}>
              <option value="">Pilih unit…</option>
              {opts.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Tanggal" error={e.date}>
            <Input type="date" value={d.date} max={today} onChange={(ev) => setD({ ...d, date: ev.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Keperluan (opsional)" hint="Mis. persiapan ujian semester, praktik kelas XI TKJ">
              <Textarea rows={2} value={d.purpose} onChange={(ev) => setD({ ...d, purpose: ev.target.value })} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Barang yang diminta">
        <div className="relative mb-4">
          <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Ketik nama barang untuk menambah…" />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {matches.map((i) => (
                <li key={i.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setD({ ...d, lines: [...d.lines, { itemId: i.id, qty: "", note: "" }] }); setQ(""); }}>
                    {i.name}{i.spec ? ` — ${i.spec}` : ""} <span className="text-xs text-slate-500">· tersedia {fmtNum(i.stock)} {i.uom}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {opts.items.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada barang persediaan yang terdaftar.</p>}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-600">
            <tr><th className="py-1 font-medium">Barang</th><th className="px-2 py-1 text-right font-medium">Tersedia</th><th className="px-2 py-1 font-medium">Jumlah</th><th className="px-2 py-1 font-medium">Keterangan</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.lines.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Belum ada barang.</td></tr>}
            {d.lines.map((l, i) => {
              const it = byId.get(l.itemId);
              return (
                <tr key={l.itemId}>
                  <td className="py-2">{it?.name ?? "(nonaktif)"}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{fmtNum(it?.stock ?? "0")} {it?.uom}</td>
                  <td className="px-2 py-2"><div className="flex items-center gap-1"><Input className="w-24" inputMode="decimal" value={l.qty} onChange={(ev) => setLine(i, "qty", ev.target.value)} /><span className="text-xs text-slate-500">{it?.uom}</span></div></td>
                  <td className="px-2 py-2"><Input value={l.note} onChange={(ev) => setLine(i, "note", ev.target.value)} /></td>
                  <td className="py-2 text-right"><button type="button" className="text-red-600 hover:underline" onClick={() => setD({ ...d, lines: d.lines.filter((_, j) => j !== i) })}>Hapus</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending || !d.lines.length} onClick={() => submit(true)}>{pending ? "Memproses…" : "Ajukan"}</Button>
        <Button type="button" variant="secondary" disabled={pending || !d.lines.length} onClick={() => submit(false)}>Simpan draf</Button>
      </div>
    </div>
  );
}
