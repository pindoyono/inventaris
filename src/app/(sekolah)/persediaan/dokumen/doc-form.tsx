"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { fmtNum, fmtRp, mulDec, normalizeIdNumber, parseDec } from "@/lib/decimal";
import type { FieldErrors } from "@/lib/validations";
import { saveDoc, type DocPayload } from "../actions";
import type { DocOptions } from "../data";
import { ACQUISITION, KIND_HINT, KIND_LABEL, type FormKind } from "./labels";

type Line = { itemId: string; qty: string; unitPrice: string; note: string };
export type DocInitial = Omit<DocPayload, "lines" | "kind"> & { kind: FormKind; lines: Line[] };

const safeDec = (v: string) => {
  try {
    return parseDec(normalizeIdNumber(v || "0"));
  } catch {
    return null;
  }
};

export function DocForm({ initial, opts, today }: { initial: DocInitial; opts: DocOptions; today: string }) {
  const [d, setD] = useState(initial);
  const [lines, setLines] = useState<Line[]>(initial.lines);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const kind = d.kind;
  const inbound = kind === "SALDO_AWAL" || kind === "PENERIMAAN";
  const set = (k: keyof DocInitial) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  const itemById = useMemo(() => new Map(opts.items.map((i) => [i.id, i])), [opts.items]);
  const avail = (itemId: string) => opts.stock[itemId]?.[d.warehouseId] ?? "0";

  const matches = q.trim().length
    ? opts.items.filter((i) => !lines.some((l) => l.itemId === i.id) && `${i.nusp} ${i.name} ${i.spec ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
    : [];
  const total = lines.reduce((a, l) => {
    const qd = safeDec(l.qty), pd = safeDec(l.unitPrice);
    return qd !== null && pd !== null ? a + mulDec(qd, pd) : a;
  }, 0n);

  function submit(andPost: boolean) {
    if (andPost && !confirm("Posting dokumen? Setelah diposting, dokumen tidak bisa diubah (hanya bisa dibatalkan).")) return;
    start(async () => {
      const res = await saveDoc({ ...d, lines: lines.map((l) => ({ ...l, unitPrice: inbound ? l.unitPrice : null })) }, andPost);
      setErrors(res?.errors ?? {});
      if (res?.errors) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  const e = errors;

  return (
    <div className="space-y-6">
      {Object.keys(e).length > 0 && (
        <Alert>{e._form ?? (e.lines ? "Periksa baris barang: jumlah wajib diisi dan barang tidak boleh kosong." : Object.values(e)[0])}</Alert>
      )}
      <Alert tone="info">{KIND_HINT[kind]}</Alert>

      <Card title={KIND_LABEL[kind]}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal dokumen" error={e.date} hint="Sesuai tanggal dokumen sumber (nota/BAST)">
            <Input type="date" value={d.date} max={today} onChange={set("date")} invalid={!!e.date} />
          </Field>
          <Field label={kind === "MUTASI" ? "Gudang asal" : "Gudang"} error={e.warehouseId}>
            <Select value={d.warehouseId} onChange={set("warehouseId")} invalid={!!e.warehouseId}>
              {opts.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
          {kind === "MUTASI" && (
            <Field label="Gudang tujuan" error={e.toWarehouseId}>
              <Select value={d.toWarehouseId ?? ""} onChange={set("toWarehouseId")} invalid={!!e.toWarehouseId}>
                <option value="">Pilih gudang tujuan…</option>
                {opts.warehouses.filter((w) => w.id !== d.warehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </Field>
          )}
          {kind === "PENYALURAN" && (
            <Field label="Unit penerima" error={e.unitId} hint={opts.units.length ? undefined : "Belum ada unit — tambahkan di Data Dasar"}>
              <Select value={d.unitId ?? ""} onChange={set("unitId")} invalid={!!e.unitId}>
                <option value="">Pilih unit…</option>
                {opts.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
          )}
          {kind === "PENERIMAAN" && (
            <>
              <Field label="Cara perolehan">
                <Select value={d.acquisition ?? "PEMBELIAN"} onChange={set("acquisition")}>
                  {ACQUISITION.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Penyedia / pemberi" hint={opts.vendors.length ? undefined : "Tambahkan penyedia di Data Dasar"}>
                <Select value={d.vendorId ?? ""} onChange={set("vendorId")}>
                  <option value="">—</option>
                  {opts.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </Field>
              <Field label="Nomor nota/kuitansi/BAST">
                <Input value={d.refNumber ?? ""} onChange={set("refNumber")} />
              </Field>
              <Field label="Tanggal nota">
                <Input type="date" value={d.refDate ?? ""} max={today} onChange={set("refDate")} />
              </Field>
            </>
          )}
          {(kind === "PENERIMAAN" || kind === "SALDO_AWAL") && (
            <>
              <Field label="Sumber dana">
                <Select value={d.fundingSourceId ?? ""} onChange={(ev) => setD({ ...d, fundingSourceId: ev.target.value, fundingComponentId: "" })}>
                  <option value="">—</option>
                  {opts.fundingSources.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </Field>
              <Field label="Komponen penggunaan dana">
                <Select value={d.fundingComponentId ?? ""} onChange={set("fundingComponentId")} disabled={!d.fundingSourceId}>
                  <option value="">—</option>
                  {opts.fundingComponents.filter((c) => c.sourceId === d.fundingSourceId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label="Catatan (opsional)">
              <Textarea rows={2} value={d.note ?? ""} onChange={set("note")} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Barang">
        <div className="relative mb-4">
          <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Ketik nama/NUSP barang untuk menambah baris…" />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {matches.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setLines([...lines, { itemId: i.id, qty: "", unitPrice: "", note: "" }]);
                      setQ("");
                    }}
                  >
                    <span className="font-mono text-xs text-slate-500">{i.nusp}</span> {i.name}
                    {!inbound && <span className="ml-2 text-xs text-slate-500">stok {fmtNum(avail(i.id))} {i.uom}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {opts.items.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada barang persediaan. Tambahkan barang terlebih dahulu.</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="py-1 pr-2 font-medium">Barang</th>
                {!inbound && <th className="px-2 py-1 text-right font-medium">Tersedia</th>}
                <th className="px-2 py-1 font-medium">Jumlah</th>
                {inbound && <th className="px-2 py-1 font-medium">Harga satuan (Rp)</th>}
                {inbound && <th className="px-2 py-1 text-right font-medium">Nilai (Rp)</th>}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Belum ada baris.</td></tr>}
              {lines.map((l, i) => {
                const it = itemById.get(l.itemId);
                const qd = safeDec(l.qty), pd = safeDec(l.unitPrice);
                const over = !inbound && qd !== null && qd > parseDec(avail(l.itemId));
                const upd = (k: keyof Line) => (ev: { target: { value: string } }) => setLines(lines.map((x, j) => (j === i ? { ...x, [k]: ev.target.value } : x)));
                return (
                  <tr key={l.itemId}>
                    <td className="py-2 pr-2">
                      <span className="block">{it?.name ?? "(barang nonaktif)"}</span>
                      <span className="font-mono text-xs text-slate-500">{it?.nusp}</span>
                    </td>
                    {!inbound && <td className="px-2 py-2 text-right whitespace-nowrap">{fmtNum(avail(l.itemId))} {it?.uom}</td>}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <Input value={l.qty} onChange={upd("qty")} inputMode="decimal" className="w-24" invalid={qd === null || over} />
                        <span className="text-xs text-slate-500">{it?.uom}</span>
                      </div>
                      {over && <span className="text-xs text-red-600">melebihi stok</span>}
                    </td>
                    {inbound && (
                      <td className="px-2 py-2">
                        <Input value={l.unitPrice} onChange={upd("unitPrice")} inputMode="decimal" className="w-36" placeholder="mis. 52.000" invalid={pd === null} />
                      </td>
                    )}
                    {inbound && <td className="px-2 py-2 text-right">{qd !== null && pd !== null ? fmtRp(mulDec(qd, pd)) : "—"}</td>}
                    <td className="py-2 pl-2 text-right">
                      <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-red-600 hover:underline">Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {inbound && lines.length > 0 && (
              <tfoot>
                <tr className="font-medium">
                  <td colSpan={3} className="py-2 text-right">Total</td>
                  <td className="px-2 py-2 text-right">{fmtRp(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending || !lines.length} onClick={() => submit(true)}>
          {pending ? "Memproses…" : "Simpan & posting"}
        </Button>
        <Button type="button" variant="secondary" disabled={pending || !lines.length} onClick={() => submit(false)}>
          Simpan sebagai draf
        </Button>
      </div>
    </div>
  );
}
