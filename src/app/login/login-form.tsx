"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { platformLoginAction, schoolLoginAction, type LoginState } from "./actions";

export function LoginForm({ kind, next }: { kind: "school" | "platform"; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    kind === "school" ? schoolLoginAction : platformLoginAction,
    {},
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
    </form>
  );
}
