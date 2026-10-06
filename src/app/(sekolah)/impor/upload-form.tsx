"use client";

import { useActionState } from "react";
import { Button, Card, FormMessage } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { previewImport } from "./actions";

export function UploadForm({ kinds }: { kinds: { k: string; title: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(previewImport, {});
  return (
    <Card title="Unggah berkas">
      <form action={action} className="space-y-3 text-sm">
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center gap-3">
          <select name="kind" className="rounded-md border border-slate-300 px-2 py-1.5">
            {kinds.map((x) => <option key={x.k} value={x.k}>{x.title}</option>)}
          </select>
          <input type="file" name="file" accept=".xlsx,.csv" required className="text-sm" />
          <Button disabled={pending}>{pending ? "Membaca…" : "Periksa berkas"}</Button>
        </div>
        <p className="text-xs text-slate-500">Maks. 3 MB / 2.000 baris. Berkas .xls lama: buka di Excel lalu Simpan Sebagai .xlsx. Belum ada data yang disimpan pada tahap ini.</p>
      </form>
    </Card>
  );
}
