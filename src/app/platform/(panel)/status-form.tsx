"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { changeSchoolStatus, type StatusState } from "./actions";

type Status = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

export function StatusForm({ schoolId, status }: { schoolId: string; status: Status }) {
  const [state, action, pending] = useActionState<StatusState, FormData>(changeSchoolStatus, {});
  const [note, setNote] = useState("");
  const options: { to: Status; label: string; variant: "primary" | "danger" | "secondary"; confirm: string }[] = [];
  if (status !== "ACTIVE") options.push({ to: "ACTIVE", label: status === "PENDING" ? "Setujui" : "Aktifkan", variant: "primary", confirm: "Setujui/aktifkan sekolah ini?" });
  if (status === "PENDING") options.push({ to: "REJECTED", label: "Tolak", variant: "danger", confirm: "Tolak pendaftaran ini?" });
  if (status === "ACTIVE") options.push({ to: "SUSPENDED", label: "Nonaktifkan", variant: "danger", confirm: "Nonaktifkan sekolah ini? Semua pengguna tidak bisa masuk." });

  return (
    <form action={action} className="w-full max-w-xs space-y-2">
      <input type="hidden" name="schoolId" value={schoolId} />
      {options.some((o) => o.to !== "ACTIVE") && (
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Alasan (wajib untuk tolak/nonaktifkan)"
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.to}
            name="status"
            value={o.to}
            variant={o.variant}
            disabled={pending}
            onClick={(e) => {
              if (!confirm(o.confirm)) e.preventDefault();
            }}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}
