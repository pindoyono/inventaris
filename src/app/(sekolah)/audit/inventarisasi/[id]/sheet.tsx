"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { inventoryAction } from "../../actions";
import { ScanButton } from "@/components/scan-button";

type Cond = keyof typeof CONDITION_LABEL;
type Line = { id: string; assetId: string | null; label: string; code: string; assetStatus: string | null; recorded: Cond | null; found: boolean | null; condition: Cond | null; note: string | null; followUp: "REKLASIFIKASI" | "KOREKSI" | null; followUpDone: boolean };

export function InventorySheet({ id, editable, status, lines }: { id: string; editable: boolean; status: string; lines: Line[] }) {
  const assetLines = lines.filter((l) => l.assetId);
  const extras = lines.filter((l) => !l.assetId);
  const [rows, setRows] = useState(assetLines.map((l) => ({ ...l, cond: l.condition ?? l.recorded ?? "BAIK", memo: l.note ?? "", fu: l.followUp ?? "" })));
  const [newExtras, setNewExtras] = useState<{ name: string; qty: string }[]>([]);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const payload = () => ({
    checks: rows.map((r) => ({ lineId: r.id, found: r.found, condition: r.found ? r.cond : null, note: r.memo, followUp: r.found && r.fu ? (r.fu as "KOREKSI") : null })),
    extras: newExtras.filter((x) => x.name.trim()).map((x) => ({ name: x.name, qty: Number(x.qty) || 1 })),
  });
  const run = (action: "SIMPAN" | "SELESAI" | "BATAL", c?: string) => {
    if (c && !confirm(c)) return;
    start(async () => {
      const r = await inventoryAction(id, { action, ...payload() });
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
      if (!r.errors) setNewExtras([]);
    });
  };
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const checked = rows.filter((r) => r.found !== null).length;

  return (
    <div className="space-y-3">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">{checked} dari {rows.length} barang sudah diperiksa.</p>
        {editable && <ScanButton label="Pindai untuk tandai ditemukan" onAsset={(a) => {
          const i = rows.findIndex((r) => r.assetId === a.id);
          if (i < 0) return `${a.name} (${String(a.regNo).padStart(6, "0")}) tercatat di ${a.room ?? "ruangan lain"} — bukan bagian ruangan ini`;
          setRows((cur) => cur.map((r, j) => (j === i ? { ...r, found: true } : r)));
        }} />}
      </div>
      {editable && rows.length > 0 && (
        <div className="flex gap-2 text-sm">
          <button type="button" className="text-teal-700 hover:underline" onClick={() => setRows(rows.map((r) => (r.found === null ? { ...r, found: true } : r)))}>Tandai sisanya ditemukan</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2 font-medium">Barang</th><th className="px-3 py-2 font-medium">Kondisi tercatat</th><th className="px-3 py-2 font-medium">Ditemukan?</th><th className="px-3 py-2 font-medium">Kondisi fisik</th><th className="px-3 py-2 font-medium">Catatan</th><th className="px-3 py-2 font-medium">Tindak lanjut</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Tidak ada barang tercatat di ruangan ini.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id} className={r.found === false ? "bg-red-50" : r.found ? "" : "bg-amber-50/40"}>
                <td className="px-3 py-2">{r.label}<span className="block font-mono text-xs text-slate-500">{r.code}{r.assetStatus && r.assetStatus !== "DIGUNAKAN" ? ` · ${r.assetStatus.toLowerCase().replaceAll("_", " ")}` : ""}</span></td>
                <td className="px-3 py-2">{r.recorded ? CONDITION_LABEL[r.recorded] : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {editable ? (
                    <>
                      <label className="mr-3"><input type="radio" checked={r.found === true} onChange={() => setRow(i, { found: true })} className="accent-teal-700" /> Ya</label>
                      <label><input type="radio" checked={r.found === false} onChange={() => setRow(i, { found: false })} className="accent-red-600" /> Tidak</label>
                    </>
                  ) : r.found === null ? "—" : r.found ? "Ya" : "Tidak"}
                </td>
                <td className="px-3 py-2">
                  {editable && r.found ? (
                    <select value={r.cond} onChange={(e) => setRow(i, { cond: e.target.value as Cond })} className="rounded-md border border-slate-300 px-2 py-1">
                      {Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  ) : r.found && r.condition ? CONDITION_LABEL[r.condition] : ""}
                </td>
                <td className="px-3 py-2">{editable ? <input value={r.memo} onChange={(e) => setRow(i, { memo: e.target.value })} className="w-44 rounded-md border border-slate-300 px-2 py-1" /> : r.note}</td>
                <td className="px-3 py-2">
                  {editable && r.found ? (
                    <select value={r.fu} onChange={(e) => setRow(i, { fu: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1" title="Temuan yang perlu ditindaklanjuti di halaman aset">
                      <option value="">—</option><option value="REKLASIFIKASI">Perlu reklasifikasi</option><option value="KOREKSI">Perlu koreksi</option>
                    </select>
                  ) : r.followUp ? (
                    <a href={`/aset/${r.assetId}`} className={r.followUpDone ? "text-slate-500" : "font-medium text-amber-700 hover:underline"}>{r.followUp === "KOREKSI" ? "Koreksi" : "Reklasifikasi"}{r.followUpDone ? " ✓ selesai" : " — tindak lanjuti"}</a>
                  ) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Barang ditemukan tetapi belum tercatat</h2>
        <ul className="mb-2 space-y-1">
          {extras.length === 0 && newExtras.length === 0 && <li className="text-slate-500">Tidak ada.</li>}
          {extras.map((x) => (
            <li key={x.id} className="flex justify-between gap-2">
              <span>{x.label} <span className="text-slate-500">({x.code.replace("belum tercatat · ", "")})</span></span>
              {editable && <button type="button" className="text-red-600 hover:underline" onClick={() => start(async () => { const r = await inventoryAction(id, { action: "HAPUS_EXTRA", lineId: x.id }); setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok }); })}>Hapus</button>}
            </li>
          ))}
        </ul>
        {editable && (
          <>
            {newExtras.map((x, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input value={x.name} onChange={(e) => setNewExtras(newExtras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Uraian barang" className="flex-1 rounded-md border border-slate-300 px-2 py-1" />
                <input value={x.qty} onChange={(e) => setNewExtras(newExtras.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} placeholder="Jml" inputMode="numeric" className="w-16 rounded-md border border-slate-300 px-2 py-1" />
              </div>
            ))}
            <button type="button" className="text-teal-700 hover:underline" onClick={() => setNewExtras([...newExtras, { name: "", qty: "1" }])}>+ Tambah barang belum tercatat</button>
            <p className="mt-2 text-xs text-slate-500">Setelah selesai, catat barang ini lewat menu Aset → Catat aset (cara perolehan: Hasil inventarisasi).</p>
          </>
        )}
      </section>

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run("SIMPAN")}>Simpan</Button>
          <Button type="button" disabled={pending} onClick={() => run("SELESAI", "Selesaikan inventarisasi? Kondisi & status barang akan diperbarui.")}>Selesaikan</Button>
          <Button type="button" variant="danger" disabled={pending} onClick={() => run("BATAL", "Batalkan inventarisasi ini?")}>Batalkan</Button>
        </div>
      )}
      {status === "SELESAI" && <Alert tone="success">Inventarisasi selesai; hasil sudah diterapkan ke data aset.</Alert>}
    </div>
  );
}
