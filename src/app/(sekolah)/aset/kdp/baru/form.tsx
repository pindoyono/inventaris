"use client";

import { useActionState, useState } from "react";
import { Button, Card, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { CONSTRUCTION_CODES } from "@/lib/construction-shared";
import { createConstructionAction } from "../actions";

type Opt = { id: string; name: string };

export function ConstructionForm({ kind, today, vendors, fundingSources, fundingComponents }: {
  kind: "KDP" | "ATR"; today: string; vendors: Opt[]; fundingSources: Opt[]; fundingComponents: (Opt & { sourceId: string })[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createConstructionAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const [fs, setFs] = useState(v.fundingSourceId ?? "");
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="kind" value={kind} />
      <Card title="Pekerjaan">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Kode barang" error={e.bmdCode}>
              <Select name="bmdCode" defaultValue={v.bmdCode ?? CONSTRUCTION_CODES[kind][2].code}>
                {CONSTRUCTION_CODES[kind].map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label="Nama pekerjaan" error={e.name}><Input name="name" defaultValue={v.name} placeholder={kind === "KDP" ? "mis. Pembangunan Ruang Kelas Baru 2 lokal" : "mis. Rehab ruang laboratorium (gedung milik Dinas)"} /></Field></div>
          {kind === "ATR" && <div className="sm:col-span-2"><Field label="Pemilik/pengguna aset yang direnovasi" error={e.ownerName}><Input name="ownerName" defaultValue={v.ownerName} placeholder="mis. Dinas Pendidikan / Pemerintah Desa" /></Field></div>}
          <Field label="Letak/lokasi"><Input name="letak" defaultValue={v.letak} /></Field>
          <Field label="Luas (m²)"><Input name="luas" defaultValue={v.luas} inputMode="decimal" /></Field>
          <Field label="Bangunan (P = permanen, SP = semi permanen, D = darurat)">
            <Select name="konstruksi" defaultValue={v.konstruksi ?? ""}><option value="">—</option><option value="P">Permanen</option><option value="SP">Semi permanen</option><option value="D">Darurat</option></Select>
          </Field>
          <Field label="Tanggal mulai" error={e.startDate}><Input type="date" name="startDate" max={today} defaultValue={v.startDate ?? today} /></Field>
          <Field label="Target selesai (opsional)" error={e.targetDate}><Input type="date" name="targetDate" defaultValue={v.targetDate} /></Field>
        </div>
      </Card>
      <Card title="Kontrak & pendanaan">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor kontrak/SPK"><Input name="contractNo" defaultValue={v.contractNo} /></Field>
          <Field label="Tanggal kontrak"><Input type="date" name="contractDate" defaultValue={v.contractDate} /></Field>
          <Field label="Penyedia/pelaksana">
            <Select name="vendorId" defaultValue={v.vendorId ?? ""}><option value="">— (swakelola/belum ada)</option>{vendors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          </Field>
          <Field label="Nilai kontrak (Rp)" error={e.contractValue}><Input name="contractValue" defaultValue={v.contractValue} inputMode="decimal" placeholder="mis. 350.000.000" /></Field>
          <Field label="Sumber dana">
            <Select name="fundingSourceId" value={fs} onChange={(ev) => setFs(ev.target.value)}><option value="">—</option>{fundingSources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          </Field>
          <Field label="Komponen dana">
            <Select key={fs} name="fundingComponentId" defaultValue={v.fundingComponentId ?? ""} disabled={!fs}><option value="">—</option>{fundingComponents.filter((c) => c.sourceId === fs).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </Field>
          <div className="sm:col-span-2"><Field label="Catatan"><Textarea name="note" rows={2} defaultValue={v.note} /></Field></div>
        </div>
      </Card>
      <Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
    </form>
  );
}
