"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { ACQUISITION_LABEL, CONDITION_LABEL, isIntraFor, KIB_ATTRS, KIB_LABEL, kibOfCode } from "@/lib/assets-shared";
import { fmtRp, normalizeIdNumber, parseDec } from "@/lib/decimal";
import { createAssetsAction, searchAssetCodes, updateAssetAction } from "./actions";
import type { AssetFormOptions } from "./data";

type Code = { code: string; name: string; parent: string };
export type AssetEdit = {
  id: string; bmdCode: string; kib: string; codeName: string; name: string; brand: string | null; attrs: Record<string, string>;
  vendorId: string | null; fundingSourceId: string | null; fundingComponentId: string | null; refNumber: string | null; unitId: string | null; note: string | null;
};

export function AssetForm({ opts, today, edit }: { opts: AssetFormOptions; today: string; edit?: AssetEdit }) {
  const [state, action, pending] = useActionState<FormState, FormData>(edit ? updateAssetAction : createAssetsAction, {});
  const e = state.errors ?? {};
  const v = state.values;
  const [code, setCode] = useState<Code | null>(edit ? { code: edit.bmdCode, name: edit.codeName, parent: "" } : v?.bmdCode ? { code: v.bmdCode, name: v.bmdCode, parent: "" } : null);
  const [price, setPrice] = useState(v?.acqPrice ?? "");
  const [fs, setFs] = useState(v?.fundingSourceId ?? edit?.fundingSourceId ?? "");
  const kib = code ? kibOfCode(code.code) : null;
  let priceC: bigint | null = null;
  try {
    priceC = price ? parseDec(normalizeIdNumber(price)) : null;
  } catch {}
  const intra = kib && priceC !== null ? isIntraFor(kib, priceC, opts.capitalization) : null;
  const limit = kib ? (opts.capitalization[kib] ?? opts.capitalization.default) : null;
  const val = (k: string, d: string | null | undefined = "") => v?.[k] ?? d ?? "";

  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      {edit && <input type="hidden" name="id" value={edit.id} />}
      <Card title="Kode barang (Permendagri 108/2016)">
        {edit ? (
          <p className="text-sm">
            <span className="font-mono">{edit.bmdCode}</span> — {edit.codeName} · {KIB_LABEL[edit.kib]}
            <span className="block text-xs text-slate-500">Kode barang, nomor register, tanggal, dan harga perolehan tidak bisa diubah di sini karena menentukan kode register.</span>
          </p>
        ) : (
          <>
            <input type="hidden" name="bmdCode" value={code?.code ?? ""} />
            <CodePicker value={code} onChange={setCode} favorites={opts.favorites} />
            {e.bmdCode && <p className="mt-2 text-xs text-red-600">{e.bmdCode}</p>}
            {kib && <p className="mt-2 text-sm text-slate-600">{KIB_LABEL[kib]}</p>}
          </>
        )}
      </Card>

      <Card title="Data barang">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nama/jenis barang" error={e.name} hint="Mis. Laptop guru, Kursi siswa kayu jati">
              <Input name="name" defaultValue={val("name", edit?.name)} required invalid={!!e.name} />
            </Field>
          </div>
          <Field label="Merk/tipe (opsional)" error={e.brand}>
            <Input name="brand" defaultValue={val("brand", edit?.brand)} />
          </Field>
          <Field label={`${opts.units.length ? "Unit pemakai" : "Unit"} (opsional)`}>
            <Select name="unitId" defaultValue={val("unitId", edit?.unitId)}>
              <option value="">—</option>
              {opts.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          {(KIB_ATTRS[kib ?? ""] ?? []).map((a) => (
            <Field key={a.key} label={`${a.label} (opsional)`}>
              <Input name={`attr_${a.key}`} defaultValue={val(`attr_${a.key}`, edit?.attrs[a.key])} />
            </Field>
          ))}
        </div>
      </Card>

      {!edit && (
        <Card title="Perolehan & penempatan">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal perolehan" error={e.acqDate} hint="Tahunnya masuk kode register">
              <Input type="date" name="acqDate" max={today} defaultValue={val("acqDate", today)} invalid={!!e.acqDate} />
            </Field>
            <Field label="Cara perolehan">
              <Select name="acquisition" defaultValue={val("acquisition", "PEMBELIAN")}>
                {Object.entries(ACQUISITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Harga satuan (Rp)" error={e.acqPrice} hint="Harga per unit termasuk biaya sampai siap pakai">
              <Input name="acqPrice" value={price} onChange={(ev) => setPrice(ev.target.value)} inputMode="decimal" placeholder="mis. 8.500.000" invalid={!!e.acqPrice} />
            </Field>
            <Field label="Jumlah unit" error={e.qty} hint="Setiap unit mendapat nomor register sendiri">
              <Input name="qty" type="number" min={1} max={500} defaultValue={val("qty", "1")} invalid={!!e.qty} />
            </Field>
            <div className="sm:col-span-2">
              {intra !== null && (
                <Alert tone={intra ? "success" : "warning"}>
                  {intra ? (
                    <><strong>Intrakomptabel</strong> (kode register 01): masuk KIB dan neraca.</>
                  ) : (
                    <><strong>Ekstrakomptabel</strong> (kode register 02): di bawah batas kapitalisasi Rp{fmtRp(String(limit))}; tetap dicatat dan masuk KIR.</>
                  )}
                </Alert>
              )}
            </div>
            <Field label="Ruangan" hint={opts.rooms.length ? "Lokasi untuk KIR" : "Tambahkan ruangan di Data Dasar"}>
              <Select name="roomId" defaultValue={val("roomId")}>
                <option value="">— (belum ditempatkan)</option>
                {opts.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <Field label="Kondisi">
              <Select name="condition" defaultValue={val("condition", "BAIK")}>
                {Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Nomor register mulai dari (opsional)" error={e.startRegNo} hint="Isi bila sudah punya nomor register dari Dinas/BPKAD; kosong = lanjut dari nomor terakhir">
              <Input name="startRegNo" type="number" min={1} max={999999} defaultValue={val("startRegNo")} />
            </Field>
          </div>
        </Card>
      )}

      <Card title="Dokumen & sumber dana">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Penyedia/pemberi (opsional)">
            <Select name="vendorId" defaultValue={val("vendorId", edit?.vendorId)}>
              <option value="">—</option>
              {opts.vendors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          <Field label="Nomor nota/BAST/kuitansi (opsional)">
            <Input name="refNumber" defaultValue={val("refNumber", edit?.refNumber)} />
          </Field>
          <Field label="Sumber dana (opsional)">
            <Select name="fundingSourceId" value={fs} onChange={(ev) => setFs(ev.target.value)}>
              <option value="">—</option>
              {opts.fundingSources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          <Field label="Komponen dana (opsional)">
            <Select key={fs} name="fundingComponentId" defaultValue={fs === (v?.fundingSourceId ?? edit?.fundingSourceId) ? val("fundingComponentId", edit?.fundingComponentId) : ""} disabled={!fs}>
              <option value="">—</option>
              {opts.fundingComponents.filter((c) => c.sourceId === fs).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Catatan (opsional)">
              <Textarea name="note" rows={2} defaultValue={val("note", edit?.note)} />
            </Field>
          </div>
        </div>
      </Card>
      <Button disabled={pending}>{pending ? "Menyimpan…" : edit ? "Simpan perubahan" : "Catat aset"}</Button>
    </form>
  );
}

export function CodePicker({ value, onChange, favorites }: { value: Code | null; onChange: (c: Code | null) => void; favorites: Code[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Code[]>([]);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setResults(await searchAssetCodes(q))), 250);
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
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari: laptop, proyektor, meja siswa, AC, lemari… atau awalan kode 1.3.2" />
      <p className="text-xs text-slate-500">{q.trim().length >= 2 ? (pending ? "Mencari…" : `${results.length} hasil`) : "Favorit sekolah:"}</p>
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
