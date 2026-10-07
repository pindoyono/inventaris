"use client";

import { useActionState } from "react";
import { Button, Card, FormMessage } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { saveUsefulLife } from "../actions";

/** Tabel masa manfaat per objek kode barang (Perkada); kosong = bawaan */
export function UsefulLifeForm({ rows }: { rows: { code: string; name: string; def: number; value: number | null }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveUsefulLife, {});
  const v = state.values ?? {};
  return (
    <form action={action}>
      <Card title="Masa manfaat penyusutan (tahun)">
        <FormMessage state={state} />
        <p className="mb-3 text-sm text-slate-600">Dipakai laporan penyusutan (Permendagri 47/2021 Format IV.H), metode garis lurus per semester. Bawaan mengikuti praktik umum Buletin Teknis SAP 18 — sesuaikan dengan Perkada penyusutan daerah Anda. 0 = tidak disusutkan.</p>
        <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {rows.map((r) => (
            <label key={r.code} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1">
              <span><span className="font-mono text-xs text-slate-500">{r.code}</span> {r.name}</span>
              <input name={`life_${r.code}`} defaultValue={v[`life_${r.code}`] ?? String(r.value ?? r.def)} inputMode="numeric" className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right" aria-label={`Masa manfaat ${r.name}`} />
            </label>
          ))}
        </div>
        <Button className="mt-4" disabled={pending}>{pending ? "Menyimpan…" : "Simpan masa manfaat"}</Button>
      </Card>
    </form>
  );
}
