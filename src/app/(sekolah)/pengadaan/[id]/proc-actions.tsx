"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { procurementActAction } from "../actions";

type Line = { id: string; kind: "PERSEDIAAN" | "ASET"; label: string; itemId: string | null; left: string };
type Opts = { warehouses: { id: string; name: string; isDefault: boolean }[]; rooms: { id: string; name: string }[]; items: { id: string; name: string; nusp: string }[] };

export function ProcActions({ id, status, today, orderDate, opts, lines }: { id: string; status: string; today: string; orderDate: string; opts: Opts; lines: Line[] }) {
  const open = lines.filter((l) => Number(l.left) > 0);
  const [date, setDate] = useState(today);
  const [wh, setWh] = useState(opts.warehouses.find((w) => w.isDefault)?.id ?? opts.warehouses[0]?.id ?? "");
  const [rows, setRows] = useState(Object.fromEntries(open.map((l) => [l.id, { qty: l.left, itemId: l.itemId ?? "", roomId: "", condition: "BAIK" }])));
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const run = (input: Parameters<typeof procurementActAction>[1], c: string) => {
    if (!confirm(c)) return;
    start(async () => { const r = await procurementActAction(id, input); setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok }); });
  };
  const sel = "rounded-md border border-slate-300 px-2 py-1";
  return (
    <section className="space-y-3 rounded-lg border border-teal-600 bg-white p-4 text-sm">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      {status === "DRAF" && (
        <div className="flex gap-2"><Button type="button" disabled={pending} onClick={() => run({ action: "PESAN" }, "Tandai sudah dipesan ke penyedia?")}>Tandai dipesan</Button><Button type="button" variant="secondary" disabled={pending} onClick={() => run({ action: "BATAL" }, "Batalkan pengadaan?")}>Batalkan</Button></div>
      )}
      {(status === "DIPESAN" || status === "DITERIMA_SEBAGIAN") && open.length > 0 && (
        <>
          <h2 className="font-semibold">Terima barang</h2>
          <div className="flex flex-wrap gap-2">
            <label>Tanggal terima <input type="date" value={date} min={orderDate} max={today} onChange={(e) => setDate(e.target.value)} className={sel} /></label>
            {open.some((l) => l.kind === "PERSEDIAAN") && <label>Gudang <select value={wh} onChange={(e) => setWh(e.target.value)} className={sel}>{opts.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
          </div>
          {open.map((l) => {
            const r = rows[l.id];
            const upd = (p: Partial<typeof r>) => setRows({ ...rows, [l.id]: { ...r, ...p } });
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                <span className="min-w-40 flex-1">{l.label} <span className="text-xs text-slate-500">(sisa {l.left})</span></span>
                <input value={r.qty} onChange={(e) => upd({ qty: e.target.value })} inputMode="decimal" className={`${sel} w-20 text-right`} />
                {l.kind === "PERSEDIAAN" && !l.itemId && (
                  <select value={r.itemId} onChange={(e) => upd({ itemId: e.target.value })} className={sel}><option value="">Pilih NUSP…</option>{opts.items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</select>
                )}
                {l.kind === "ASET" && (
                  <>
                    <select value={r.roomId} onChange={(e) => upd({ roomId: e.target.value })} className={sel}><option value="">Ruangan…</option>{opts.rooms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                    <select value={r.condition} onChange={(e) => upd({ condition: e.target.value })} className={sel}>{Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </>
                )}
              </div>
            );
          })}
          <p className="text-xs text-slate-500">Persediaan tanpa NUSP: tambahkan dulu barangnya di menu Persediaan bila belum ada.</p>
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={() => run({ action: "TERIMA", date, warehouseId: wh, lines: open.map((l) => ({ lineId: l.id, qty: rows[l.id].qty, itemId: rows[l.id].itemId || undefined, roomId: rows[l.id].roomId || undefined, condition: rows[l.id].condition })) }, "Catat penerimaan barang? Persediaan dibukukan dan aset dicatat.")}>{pending ? "Memproses…" : "Catat penerimaan"}</Button>
            {status === "DIPESAN" && <Button type="button" variant="secondary" disabled={pending} onClick={() => run({ action: "BATAL" }, "Batalkan pengadaan?")}>Batalkan</Button>}
          </div>
        </>
      )}
      {status === "DITERIMA" && <p>Semua barang sudah diterima.</p>}
    </section>
  );
}
