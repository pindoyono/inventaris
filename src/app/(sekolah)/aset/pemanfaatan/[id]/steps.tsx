"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { fmtRp } from "@/lib/decimal";
import { utilizationStepAction } from "../actions";

const inp = "block w-full rounded-md border border-slate-300 px-2 py-1.5";

export function UtilizationSteps({ id, status, today, partner, contribution }: { id: string; status: string; today: string; partner: string; contribution: string }) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>({ approvalDate: today, startDate: today, endedDate: today, partner, contribution: fmtRp(contribution) });
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const set = (k: string) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  const run = (step: string, extra: Record<string, string>, c?: string) => {
    if (c && !confirm(c)) return;
    start(async () => {
      const r = await utilizationStepAction(id, { step, ...extra });
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
      if (!r.errors) router.refresh();
    });
  };
  const box = "space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm";
  const field = (k: string, label: string, type = "text") => (
    <label className="block space-y-1"><span className="text-slate-600">{label}</span><input type={type} value={f[k] ?? ""} onChange={set(k)} max={type === "date" && k !== "endDate" ? today : undefined} className={inp} /></label>
  );
  return (
    <div className="space-y-4">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      {status === "RENCANA" && (
        <section className={box}>
          <h2 className="font-semibold">Persetujuan Pengelola/Kepala Daerah</h2>
          {field("approvalNo", "Nomor surat persetujuan")}
          {field("approvalDate", "Tanggal", "date")}
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={() => run("setujui", { approvalNo: f.approvalNo ?? "", approvalDate: f.approvalDate })}>Catat disetujui</Button>
          </div>
          {field("reason", "Alasan (bila ditolak/dibatalkan)")}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run("tolak", { reason: f.reason ?? "" }, "Tandai usulan ditolak?")}>Ditolak</Button>
            <Button type="button" variant="danger" disabled={pending} onClick={() => run("batal", { reason: f.reason ?? "" }, "Batalkan rencana ini?")}>Batalkan</Button>
          </div>
        </section>
      )}
      {status === "DISETUJUI" && (
        <section className={box}>
          <h2 className="font-semibold">Mulai pelaksanaan (perjanjian)</h2>
          {field("partner", "Mitra")}
          {field("agreementNo", "Nomor perjanjian")}
          {field("agreementDate", "Tanggal perjanjian", "date")}
          <div className="grid gap-2 sm:grid-cols-2">{field("startDate", "Mulai", "date")}{field("endDate", "Berakhir", "date")}</div>
          {field("contribution", "Kontribusi/sewa (Rp)")}
          <Button type="button" disabled={pending} onClick={() => run("mulai", { partner: f.partner, agreementNo: f.agreementNo ?? "", agreementDate: f.agreementDate ?? "", startDate: f.startDate, endDate: f.endDate ?? "", contribution: f.contribution })}>Mulai</Button>
          {field("reason", "Alasan pembatalan")}
          <Button type="button" variant="danger" disabled={pending} onClick={() => run("batal", { reason: f.reason ?? "" }, "Batalkan?")}>Batalkan</Button>
        </section>
      )}
      {status === "BERJALAN" && (
        <section className={box}>
          <h2 className="font-semibold">Selesai / berakhir</h2>
          {field("endedDate", "Tanggal berakhir", "date")}
          <Button type="button" disabled={pending} onClick={() => run("selesai", { endedDate: f.endedDate }, "Tandai pemanfaatan selesai?")}>Tandai selesai</Button>
        </section>
      )}
    </div>
  );
}
