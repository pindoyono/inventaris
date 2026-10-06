"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button, Card, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { saveItem, searchPersediaanCodes } from "../actions";

type Code = { code: string; name: string; parent: string };
type Item = { id: string; nusp: string; bmdCode: string; bmdName: string; name: string; spec: string | null; uomId: string; minStock: string; isActive: boolean };

export function ItemForm({ item, uoms, favorites }: { item: Item | null; uoms: { id: string; name: string }[]; favorites: Code[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveItem, {});
  const e = state.errors ?? {};
  const v = state.values;
  const [code, setCode] = useState<Code | null>(item ? { code: item.bmdCode, name: item.bmdName, parent: "" } : null);

  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Card title="Kode barang (Permendagri 108/2016)">
        {item ? (
          <p className="text-sm">
            <span className="font-mono">{item.nusp}</span> — {item.bmdName}
            <span className="block text-xs text-slate-500">Kode barang tidak bisa diubah setelah dibuat. Buat barang baru bila kodenya salah, lalu nonaktifkan yang lama.</span>
          </p>
        ) : (
          <>
            <input type="hidden" name="bmdCode" value={code?.code ?? ""} />
            <CodePicker value={code} onChange={setCode} favorites={favorites} />
            {e.bmdCode && <p className="mt-2 text-xs text-red-600">{e.bmdCode}</p>}
            <p className="mt-2 text-xs text-slate-500">NUSP dibuat otomatis: kode barang + nomor urut spesifikasi (mis. …02.001.0001 untuk HVS A4, …0002 untuk HVS F4).</p>
          </>
        )}
      </Card>
      <Card title="Spesifikasi">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nama barang" error={e.name} hint="Nama yang tampil di dokumen, mis. Kertas HVS A4 70 gram">
              <Input name="name" defaultValue={v?.name ?? item?.name ?? (code && !item ? "" : "")} required invalid={!!e.name} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Spesifikasi (opsional)" error={e.spec} hint="Merek, ukuran, warna, dsb.">
              <Textarea name="spec" rows={2} defaultValue={v?.spec ?? item?.spec ?? ""} />
            </Field>
          </div>
          <Field label="Satuan" error={e.uomId} hint="Satuan yang lazim (Permendagri 47/2021)">
            <Select name="uomId" defaultValue={v?.uomId ?? item?.uomId ?? ""} invalid={!!e.uomId}>
              <option value="">Pilih satuan…</option>
              {uoms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Stok minimum" error={e.minStock} hint="Tanda “menipis” bila stok ≤ angka ini; 0 = tidak dipantau">
            <Input name="minStock" defaultValue={v?.minStock ?? (item ? String(Number(item.minStock)) : "0")} inputMode="decimal" invalid={!!e.minStock} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={v ? v.isActive === "on" : (item?.isActive ?? true)} className="size-4 accent-teal-700" />
            Aktif (bisa dipilih di dokumen)
          </label>
        </div>
      </Card>
      <Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
    </form>
  );
}

function CodePicker({ value, onChange, favorites }: { value: Code | null; onChange: (c: Code | null) => void; favorites: Code[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Code[]>([]);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setResults(await searchPersediaanCodes(q))), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = q.trim().length >= 2 ? results : favorites;

  if (value)
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-teal-600 bg-teal-50 px-3 py-2 text-sm">
        <span>
          <span className="font-mono text-xs">{value.code}</span> {value.name}
          {value.parent && <span className="block text-xs text-slate-500">{value.parent}</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-teal-800 hover:underline">Ganti</button>
      </div>
    );

  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari: kertas, tinta, sabun, spidol, bola… atau awalan kode 1.1.7" />
      <p className="text-xs text-slate-500">{q.trim().length >= 2 ? (pending ? "Mencari…" : `${results.length} hasil`) : "Favorit sekolah (persediaan):"}</p>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
        {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Tidak ada kode.</li>}
        {list.map((c) => (
          <li key={c.code}>
            <button type="button" onClick={() => onChange(c)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
              <span className="font-mono text-xs text-slate-500">{c.code}</span> {c.name}
              {c.parent && <span className="block text-xs text-slate-500">{c.parent}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
