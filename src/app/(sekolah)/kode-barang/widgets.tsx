"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { addLocalCode, toggleFavorite } from "./actions";

export function FavoriteToggle({ code, on }: { code: string; on: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={optimistic ? "Hapus dari favorit" : "Jadikan favorit"}
      aria-pressed={optimistic}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleFavorite(code, !optimistic);
        })
      }
      className={`text-lg leading-none ${optimistic ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}
    >
      ★
    </button>
  );
}

export function LocalCodeForm({ parentCode }: { parentCode: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addLocalCode, {});
  const e = state.errors ?? {};
  return (
    <Card title="Tambah kode barang lokal">
      <p className="mb-3 text-sm text-slate-600">
        Permendagri 108/2016 Pasal 3 ayat (2): kode di bawah sub rincian objek dapat ditambah sesuai kebutuhan daerah.
        Gunakan bila jenis barang benar-benar tidak ada di daftar resmi; sebaiknya mengikuti penetapan Pemda.
      </p>
      <form action={action} className="space-y-3">
        <FormMessage state={state} />
        <input type="hidden" name="parentCode" value={parentCode} />
        <Field label="Nama barang" error={e.name}><Input name="name" required invalid={!!e.name} /></Field>
        <Field label="Dasar penetapan (opsional)" error={e.decreeRef} hint="Mis. Perkada/SK Kepala BPKAD nomor …"><Input name="decreeRef" /></Field>
        {e.parentCode && <p className="text-xs text-red-600">{e.parentCode}</p>}
        <Button disabled={pending}>{pending ? "Menyimpan…" : "Tambah kode"}</Button>
      </form>
    </Card>
  );
}
