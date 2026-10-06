"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import type { FormState } from "@/lib/server/action";
import { markAllRead } from "./actions";

export function MarkAllRead() {
  const [, action, pending] = useActionState<FormState>(markAllRead, {});
  return (
    <form action={action}>
      <Button variant="secondary" disabled={pending}>Tandai semua sudah dibaca</Button>
    </form>
  );
}
