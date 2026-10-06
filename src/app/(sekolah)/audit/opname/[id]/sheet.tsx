"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { fmtNum, normalizeIdNumber, parseDec } from "@/lib/decimal";
import { opnameAction } from "../../actions";

type Line = { id: string; name: string; nusp: string; uom: string; systemQty: string; physicalQty: string | null; damagedQty: string; surplusPrice: string | null; note: string | null };
const n = (v: string | null) => (v === null ? "" : String(Number(v)));
const dec = (v: string) => { try { return v.trim() === "" ? null : parseDec(normalizeIdNumber(v)); } catch { return undefined; } };

export function OpnameSheet({ id, status, role, lines, items }: { id: string; status: string; role: "petugas" | "kepsek" | "lihat"; lines: Line[]; items: { id: string; name: string; nusp: string }[] }) {
  const editable = status === "DRAF" && role === "petugas";
  const [rows, setRows] = useState(lines.map((l) => ({ ...l, p: n(l.physicalQty), d: l.damagedQty === "0.00" ? "" : n(l.damagedQty), price: n(l.surplusPrice), memo: l.note ?? "" })));
  const [addId, setAddId] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const run = (input: Parameters<typeof opnameAction>[1], confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const r = await opnameAction(id, input);
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
    });
  };
  const counts = () => rows.map((r) => ({ lineId: r.id, physicalQty: r.p, damagedQty: r.d, surplusPrice: r.price, note: r.memo }));
  const diffOf = (r: (typeof rows)[number]) => {
    const p = dec(r.p), d = dec(r.d) ?? 0n;
    if (p === null || p === undefined || d === undefined) return null;
    return p + d - parseDec(r.systemQty);
  };

  return (
    <div className="space-y-3">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 text-right font-medium">Sistem</th>
              <th className="px-3 py-2 font-medium">Fisik (baik)</th><th className="px-3 py-2 font-medium">Rusak/usang</th>
              <th className="px-3 py-2 text-right font-medium">Selisih</th><th className="px-3 py-2 font-medium">Harga kelebihan</th><th className="px-3 py-2 font-medium">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Gudang kosong. Tambahkan barang bila ada yang ditemukan.</td></tr>}
            {rows.map((r, i) => {
              const df = diffOf(r);
              const upd = (k: "p" | "d" | "price" | "memo") => (e: { target: { value: string } }) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.name}<span className="block font-mono text-xs text-slate-500">{r.nusp}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtNum(r.systemQty)} {r.uom}</td>
                  <td className="px-3 py-2">{editable ? <input value={r.p} onChange={upd("p")} inputMode="decimal" className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right" /> : n(r.physicalQty) || "—"}</td>
                  <td className="px-3 py-2">{editable ? <input value={r.d} onChange={upd("d")} inputMode="decimal" placeholder="0" className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right" /> : n(r.damagedQty)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${df === null ? "" : df > 0n ? "text-emerald-700" : df < 0n ? "text-red-700" : "text-slate-500"}`}>{df === null ? "—" : `${df > 0n ? "+" : ""}${fmtNum(df)}`}</td>
                  <td className="px-3 py-2">{editable && df !== null && df > 0n ? <input value={r.price} onChange={upd("price")} inputMode="decimal" placeholder="harga terakhir" className="w-28 rounded-md border border-slate-300 px-2 py-1" /> : r.price ? fmtNum(r.price) : ""}</td>
                  <td className="px-3 py-2">{editable ? <input value={r.memo} onChange={upd("memo")} className="w-40 rounded-md border border-slate-300 px-2 py-1" /> : r.memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={addId} onChange={(e) => setAddId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Tambah barang yang ditemukan (saldo sistem 0)…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <Button type="button" variant="secondary" disabled={!addId || pending} onClick={() => run({ action: "TAMBAH_BARANG", itemId: addId })}>Tambah</Button>
          <span className="flex-1" />
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run({ action: "SIMPAN", counts: counts() })}>Simpan hasil hitung</Button>
          <Button type="button" disabled={pending} onClick={() => run({ action: "AJUKAN", counts: counts() }, "Ajukan hasil opname ke Kepala Sekolah?")}>Ajukan</Button>
          <Button type="button" variant="danger" disabled={pending} onClick={() => run({ action: "BATAL" }, "Batalkan stock opname? Gudang dibuka kembali tanpa penyesuaian.")}>Batalkan</Button>
        </div>
      )}
      {status === "DIAJUKAN" && role === "kepsek" && (
        <div className="space-y-2 rounded-lg border border-teal-600 bg-white p-4 text-sm">
          <p>Setujui untuk membukukan selisih: kelebihan → penyesuaian tambah, kekurangan → penyesuaian kurang (FIFO), rusak/usang → daftar persediaan rusak/usang.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => run({ action: "SETUJUI" }, "Setujui hasil stock opname dan bukukan penyesuaian?")}>Setujui</Button>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan bila dikembalikan" className="min-w-48 flex-1 rounded-md border border-slate-300 px-2 py-1.5" />
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run({ action: "KEMBALIKAN", reason }, "Kembalikan ke Petugas untuk dihitung ulang?")}>Kembalikan</Button>
          </div>
        </div>
      )}
    </div>
  );
}
