"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { conditionAction, idleAction, moveAssetsAction } from "../actions";

export function QuickActions({ id, roomId, condition, rooms, today, idle }: { id: string; roomId: string | null; condition: string; rooms: { id: string; name: string }[]; today: string; idle: boolean }) {
  const [plan, setPlan] = useState("PENGGUNAAN");
  const [room, setRoom] = useState(roomId ?? "");
  const [cond, setCond] = useState(condition);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; errors?: Record<string, string> }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
      if (!r.errors) setNote("");
    });
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="font-semibold">Perbarui lokasi / kondisi</h2>
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1"><span className="text-slate-600">Tanggal</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="block w-full rounded-md border border-slate-300 px-2 py-1.5" /></label>
        <label className="space-y-1"><span className="text-slate-600">Keterangan</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="block w-full rounded-md border border-slate-300 px-2 py-1.5" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={room} onChange={(e) => setRoom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5">
          <option value="">Pilih ruangan…</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <Button type="button" variant="secondary" disabled={pending || !room || room === roomId} onClick={() => run(() => moveAssetsAction({ ids: [id], roomId: room, date, note }))}>Pindahkan</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={cond} onChange={(e) => setCond(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5">
          {Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <Button type="button" variant="secondary" disabled={pending || cond === condition} onClick={() => run(() => conditionAction({ ids: [id], condition: cond, date, note }))}>Simpan kondisi</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {idle ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => idleAction({ id, idle: false }))}>Tandai digunakan kembali</Button>
        ) : (
          <>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5" title="Rencana atas barang tidak digunakan (Format C.3)">
              <option value="PENGGUNAAN">Rencana: dialihkan penggunaannya</option>
              <option value="PEMANFAATAN">Rencana: dimanfaatkan (sewa, dsb.)</option>
              <option value="PEMINDAHTANGANAN">Rencana: dipindahtangankan</option>
            </select>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => idleAction({ id, idle: true, plan, note }))}>Tidak digunakan untuk tusi</Button>
          </>
        )}
      </div>
    </div>
  );
}
