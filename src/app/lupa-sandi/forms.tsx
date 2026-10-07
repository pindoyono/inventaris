"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/ui";
import { requestResetAction, resetAction, type ResetState } from "./actions";

export function RequestForm() {
  const [s, action, pending] = useActionState<ResetState, FormData>(requestResetAction, {});
  if (s.ok) return <Alert tone="success">{s.ok}</Alert>;
  return (
    <form action={action} className="space-y-4">
      {s.error && <Alert>{s.error}</Alert>}
      <Field label="NPSN"><Input name="npsn" defaultValue={s.npsn} maxLength={8} inputMode="numeric" required autoFocus /></Field>
      <Field label="Username"><Input name="username" defaultValue={s.username} autoComplete="username" required /></Field>
      <Button disabled={pending} className="w-full">{pending ? "Mengirim…" : "Kirim tautan"}</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState<ResetState, FormData>(resetAction.bind(null, token), {});
  if (s.ok) return <div className="space-y-3"><Alert tone="success">{s.ok}</Alert><Link href="/login" className="block text-center font-medium text-teal-700 hover:underline">Masuk</Link></div>;
  return (
    <form action={action} className="space-y-4">
      {s.error && <Alert>{s.error}</Alert>}
      <Field label="Kata sandi baru" hint="Minimal 8 karakter"><Input name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus /></Field>
      <Field label="Ulangi kata sandi baru"><Input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <Button disabled={pending} className="w-full">{pending ? "Menyimpan…" : "Simpan kata sandi"}</Button>
    </form>
  );
}
