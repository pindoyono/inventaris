"use client";

import { useActionState } from "react";
import { Button, FormMessage } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { startInventoryAction, startOpnameAction } from "./actions";

export function StartForm({ kind, options }: { kind: "opname" | "inventarisasi"; options: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(kind === "opname" ? startOpnameAction : startInventoryAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <FormMessage state={state} />
      <label className="space-y-1">
        <span className="block text-slate-600">{kind === "opname" ? "Gudang" : "Ruangan"}</span>
        <select name={kind === "opname" ? "warehouseId" : "roomId"} className="rounded-md border border-slate-300 px-2 py-1.5">
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <label className="min-w-48 flex-1 space-y-1">
        <span className="block text-slate-600">Catatan (opsional)</span>
        <input name="note" className="w-full rounded-md border border-slate-300 px-2 py-1.5" placeholder={kind === "opname" ? "mis. Opname Semester II 2026" : "mis. Inventarisasi akhir semester"} />
      </label>
      <Button disabled={pending || !options.length}>{pending ? "Memulai…" : kind === "opname" ? "Mulai stock opname" : "Mulai inventarisasi"}</Button>
    </form>
  );
}
