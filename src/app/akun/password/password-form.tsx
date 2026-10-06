"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { changeOwnPassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changeOwnPassword, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Password lama" error={e.current}>
        <Input name="current" type="password" autoComplete="current-password" required invalid={!!e.current} />
      </Field>
      <Field label="Password baru" error={e.password} hint="Minimal 8 karakter">
        <Input name="password" type="password" autoComplete="new-password" required invalid={!!e.password} />
      </Field>
      <Field label="Ulangi password baru" error={e.confirm}>
        <Input name="confirm" type="password" autoComplete="new-password" required invalid={!!e.confirm} />
      </Field>
      <Button disabled={pending} className="w-full">{pending ? "Menyimpan…" : "Simpan"}</Button>
    </form>
  );
}
