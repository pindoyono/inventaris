"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/ui";
import { platformLoginAction, schoolLoginAction, type LoginState } from "./actions";

export function LoginForm({ kind, next }: { kind: "school" | "platform"; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    kind === "school" ? schoolLoginAction : platformLoginAction,
    {},
  );
  if (state.otp)
    return (
      <form action={action} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        <input type="hidden" name="next" value={state.next ?? next ?? ""} />
        <input type="hidden" name="npsn" value={state.npsn ?? ""} />
        <input type="hidden" name="username" value={state.username ?? ""} />
        <p className="text-sm text-slate-600">Akun ini memakai verifikasi dua langkah. Masukkan kode 6 digit dari aplikasi autentikator, atau salah satu kode pemulihan.</p>
        <Field label="Kode verifikasi">
          <Input name="otp" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={11} placeholder="123456" />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Memeriksa…" : "Verifikasi"}</Button>
        <p className="text-center text-sm"><button type="button" onClick={() => window.location.assign(kind === "school" ? "/login" : "/platform/login")} className="text-teal-700 hover:underline">Batal, masuk ulang</button></p>
      </form>
    );
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {kind === "school" && (
        <>
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="NPSN">
            <Input name="npsn" defaultValue={state.npsn} maxLength={8} inputMode="numeric" autoComplete="organization" required autoFocus />
          </Field>
        </>
      )}
      <Field label="Username">
        <Input name="username" defaultValue={state.username} autoComplete="username" required autoFocus={kind === "platform"} />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Memeriksa…" : "Masuk"}</Button>
      {kind === "school" && <p className="text-center text-sm"><Link href="/lupa-sandi" className="text-teal-700 hover:underline">Lupa kata sandi?</Link></p>}
    </form>
  );
}
