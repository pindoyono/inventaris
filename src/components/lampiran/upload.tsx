"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import type { FormState } from "@/lib/server/action";
import { deleteAttachment, uploadAttachment } from "./actions";

export function UploadAttachment({ entity, entityId, path }: { entity: string; entityId: string; path: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadAttachment.bind(null, entity, entityId, path), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-center gap-2 text-sm">
      {/* capture: di HP langsung membuka kamera belakang */}
      <input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" required className="max-w-56 text-sm" />
      <input name="caption" placeholder="Keterangan (mis. nota, kondisi saat kembali)" className="min-w-48 flex-1 rounded-md border border-slate-300 px-2 py-1.5" />
      <button disabled={pending} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">{pending ? "Mengunggah…" : "Unggah"}</button>
      {state.errors?._form && <span className="text-xs text-red-600">{state.errors._form}</span>}
      {state.ok && <span className="text-xs text-emerald-700">{state.ok}</span>}
      <span className="w-full text-xs text-slate-500">Foto (JPG/PNG/WEBP) atau PDF, maks. 3 MB.</span>
    </form>
  );
}

export function DeleteAttachment({ id, path }: { id: string; path: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="text-red-600 hover:underline" onClick={() => { if (confirm("Hapus lampiran ini?")) start(async () => { await deleteAttachment(id, path); }); }}>
      hapus
    </button>
  );
}
