"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { recordMaintenanceAction } from "../../actions";
import { searchLoanableAssets } from "../../../peminjaman/actions";

type Opt = { id: string; name: string };

export function MaintenanceForm({ today, asset, fundingSources, fundingComponents }: { today: string; asset: { id: string; name: string; regNo: number; status: string } | null; fundingSources: Opt[]; fundingComponents: (Opt & { sourceId: string })[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordMaintenanceAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const [picked, setPicked] = useState(asset && asset.status === "DIGUNAKAN" ? asset : null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Awaited<ReturnType<typeof searchLoanableAssets>>>([]);
  const [, startSearch] = useTransition();
  const [fs, setFs] = useState(v.fundingSourceId ?? "");
  const [finishNow, setFinishNow] = useState(v.finishNow === "on");
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => startSearch(async () => setFound(await searchLoanableAssets(q))), 250);
    return () => clearTimeout(t);
  }, [q]);
  // Komponen BOSP "Pemeliharaan sarana dan prasarana sekolah" sebagai saran
  const suggested = fundingComponents.find((c) => c.sourceId === fs && /pemeliharaan/i.test(c.name))?.id ?? "";

  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      {asset && asset.status !== "DIGUNAKAN" && <Alert tone="warning">{asset.name} sedang {asset.status.toLowerCase().replaceAll("_", " ")}; selesaikan dulu di daftar pemeliharaan.</Alert>}
      <Card title="Barang">
        <input type="hidden" name="assetId" value={picked?.id ?? ""} />
        {picked ? (
          <div className="flex justify-between text-sm"><span>{picked.name} <span className="font-mono text-xs text-slate-500">reg. {String(picked.regNo).padStart(6, "0")}</span></span><button type="button" className="text-teal-700 hover:underline" onClick={() => setPicked(null)}>Ganti</button></div>
        ) : (
          <div className="relative">
            <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Cari nama/merk/no. register…" />
            {q.trim().length >= 2 && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                {found.map((f) => <li key={f.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setPicked({ id: f.id, name: f.name, regNo: f.regNo, status: "DIGUNAKAN" }); setQ(""); }}>{f.name} <span className="font-mono text-xs text-slate-500">reg. {String(f.regNo).padStart(6, "0")}</span> <span className="text-xs text-slate-500">· {CONDITION_LABEL[f.condition]}</span></button></li>)}
              </ul>
            )}
          </div>
        )}
        {e.assetId && <p className="mt-1 text-xs text-red-600">Pilih barang</p>}
      </Card>
      <Card title="Pekerjaan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jenis">
            <Select name="kind" defaultValue={v.kind ?? "PERBAIKAN"}>
              <option value="RUTIN">Pemeliharaan rutin</option>
              <option value="PERBAIKAN">Perbaikan</option>
              <option value="PENINGKATAN">Peningkatan (menambah umur/kapasitas)</option>
            </Select>
          </Field>
          <Field label="Tanggal mulai"><Input type="date" name="startDate" max={today} defaultValue={v.startDate ?? today} /></Field>
          <div className="sm:col-span-2"><Field label="Uraian pekerjaan" error={e.description}><Textarea name="description" rows={2} defaultValue={v.description} placeholder="mis. Ganti lampu proyektor, servis AC" /></Field></div>
          <Field label="Pelaksana (opsional)"><Input name="executor" defaultValue={v.executor} placeholder="mis. teknisi sekolah / nama toko" /></Field>
          <Field label="Biaya (Rp)"><Input name="cost" defaultValue={v.cost} inputMode="decimal" placeholder="0" /></Field>
          <Field label="Sumber dana (opsional)">
            <Select name="fundingSourceId" value={fs} onChange={(ev) => setFs(ev.target.value)}>
              <option value="">—</option>
              {fundingSources.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </Field>
          <Field label="Komponen dana">
            <Select key={fs} name="fundingComponentId" defaultValue={suggested} disabled={!fs}>
              <option value="">—</option>
              {fundingComponents.filter((c) => c.sourceId === fs).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <Card>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="finishNow" checked={finishNow} onChange={(ev) => setFinishNow(ev.target.checked)} className="mt-0.5 size-4 accent-teal-700" />
          <span>Sudah selesai (catat langsung). <span className="text-slate-500">Bila tidak dicentang, barang berstatus “dalam pemeliharaan” sampai ditandai selesai.</span></span>
        </label>
        {finishNow && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal selesai" error={e.endDate}><Input type="date" name="endDate" max={today} defaultValue={v.endDate ?? today} /></Field>
            <Field label="Kondisi sesudah">
              <Select name="conditionAfter" defaultValue={v.conditionAfter ?? "BAIK"}>
                {Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Card>
      <Button disabled={pending || !picked}>{pending ? "Menyimpan…" : "Simpan"}</Button>
    </form>
  );
}
