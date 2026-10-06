"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, FormMessage } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { cancelDocAction, deleteDocAction, postDocAction } from "../../actions";

export function DraftActions({ docId }: { docId: string }) {
  const [postState, post, posting] = useActionState<FormState>(postDocAction.bind(null, docId), {});
  const [delState, del, deleting] = useActionState<FormState>(deleteDocAction.bind(null, docId), {});
  return (
    <div className="space-y-3">
      <FormMessage state={postState.errors ? postState : delState.errors ? delState : postState} />
      <div className="flex flex-wrap gap-3">
        <form action={post} onSubmit={(e) => { if (!confirm("Posting dokumen ini ke buku besar?")) e.preventDefault(); }}>
          <Button disabled={posting}>{posting ? "Memposting…" : "Posting"}</Button>
        </form>
        <Link href={`/persediaan/dokumen/${docId}/ubah`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Ubah draf</Link>
        <form action={del} onSubmit={(e) => { if (!confirm("Hapus draf ini?")) e.preventDefault(); }}>
          <Button variant="secondary" disabled={deleting}>Hapus draf</Button>
        </form>
      </div>
    </div>
  );
}

export function CancelAction({ docId }: { docId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(cancelDocAction.bind(null, docId), {});
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Batalkan dokumen…</Button>;
  return (
    <form action={action} className="max-w-lg space-y-2" onSubmit={(e) => { if (!confirm("Batalkan dokumen? Stok akan dikembalikan dengan baris pembalik.")) e.preventDefault(); }}>
      <FormMessage state={state} />
      <label className="block text-sm font-medium">Alasan pembatalan</label>
      <textarea name="reason" rows={2} className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
      {state.errors?.reason && <p className="text-xs text-red-600">{state.errors.reason}</p>}
      <div className="flex gap-2">
        <Button variant="danger" disabled={pending}>{pending ? "Membatalkan…" : "Batalkan dokumen"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Tutup</Button>
      </div>
    </form>
  );
}
