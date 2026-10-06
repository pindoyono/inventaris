"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, Field, FormMessage, Input, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { setBooksClosed } from "./actions";

const fmt = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

export function ClosingForm({ current, suggest, today }: { current: string | null; suggest: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setBooksClosed, {});
  const [until, setUntil] = useState(current && current > suggest ? current : suggest);
  const reopening = !!current && (!until || until < current);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Alert tone="info">{current ? <>Buku saat ini <strong>ditutup sampai {fmt(current)}</strong>.</> : "Belum ada periode yang ditutup."}</Alert>
      <Card>
        <div className="space-y-4">
          <Field label="Tutup buku sampai tanggal" error={e.until} hint="Biasanya akhir semester: 30 Juni atau 31 Desember. Kosongkan untuk membuka semua periode.">
            <Input type="date" name="until" value={until} max={today} onChange={(ev) => setUntil(ev.target.value)} invalid={!!e.until} />
          </Field>
          {reopening && (
            <Field label="Alasan membuka kembali" error={e.reason} hint="Tercatat di log aktivitas">
              <Textarea name="reason" rows={2} invalid={!!e.reason} />
            </Field>
          )}
          <Button disabled={pending} variant={reopening ? "danger" : "primary"}>{reopening ? "Buka kembali periode" : "Tutup buku"}</Button>
        </div>
      </Card>
    </form>
  );
}
