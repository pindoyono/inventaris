"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { ATR_FOLLOW_UP_LABEL } from "@/lib/construction-shared";
import { CodePicker } from "../../asset-form";
import { constructionStepAction } from "../actions";

type Code = { code: string; name: string; parent: string };
const inp = "block w-full rounded-md border border-slate-300 px-2 py-1.5";

export function ConstructionActions({ id, kind, status, progress, targetDate, atrFollowUp, today, rooms, favorites, name }: {
  id: string; kind: "KDP" | "ATR"; status: "BERJALAN" | "DIHENTIKAN" | "SELESAI"; progress: number; targetDate: string; atrFollowUp: string;
  today: string; rooms: { id: string; name: string }[]; favorites: Code[]; name: string;
}) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>({ date: today, progress: String(progress), targetDate, value: atrFollowUp, name });
  const [code, setCode] = useState<Code | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const set = (k: string) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  const run = (step: string, extra: Record<string, string>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const r = await constructionStepAction(id, { step, ...extra });
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
      if (!r.errors) router.refresh();
    });
  };
  const box = "space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm";
  return (
    <div className="space-y-4">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      {status !== "DIHENTIKAN" && (
        <section className={box}>
          <h2 className="font-semibold">Catat pembayaran</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-slate-600">Tanggal</span><input type="date" max={today} value={f.date} onChange={set("date")} className={inp} /></label>
            <label className="space-y-1"><span className="text-slate-600">Nilai (Rp)</span><input value={f.amount ?? ""} onChange={set("amount")} inputMode="decimal" className={inp} /></label>
          </div>
          <label className="block space-y-1"><span className="text-slate-600">No. SP2D/kuitansi</span><input value={f.docNo ?? ""} onChange={set("docNo")} className={inp} /></label>
          <label className="block space-y-1"><span className="text-slate-600">Uraian</span><input value={f.payNote ?? ""} onChange={set("payNote")} placeholder="mis. Termin I (30%)" className={inp} /></label>
          <Button type="button" disabled={pending || !f.amount} onClick={() => run("bayar", { date: f.date, amount: f.amount ?? "", docNo: f.docNo ?? "", note: f.payNote ?? "" })}>Simpan pembayaran</Button>
        </section>
      )}
      {status === "BERJALAN" && (
        <section className={box}>
          <h2 className="font-semibold">Progres fisik</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-slate-600">Progres (%)</span><input value={f.progress} onChange={set("progress")} inputMode="numeric" className={inp} /></label>
            <label className="space-y-1"><span className="text-slate-600">Target selesai</span><input type="date" value={f.targetDate} onChange={set("targetDate")} className={inp} /></label>
          </div>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run("progres", { progress: f.progress, targetDate: f.targetDate })}>Perbarui progres</Button>
        </section>
      )}
      {status === "BERJALAN" && (
        <section className={box}>
          <h2 className="font-semibold">Selesai & serah terima</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-slate-600">Tanggal BAST</span><input type="date" max={today} value={f.date} onChange={set("date")} className={inp} /></label>
            <label className="space-y-1"><span className="text-slate-600">Nomor BAST</span><input value={f.bastNo ?? ""} onChange={set("bastNo")} className={inp} /></label>
          </div>
          {kind === "KDP" && (
            <>
              <p className="text-xs text-slate-500">KDP direklasifikasi ke aset definitif senilai akumulasi biaya (KIB A–E).</p>
              <CodePicker value={code} onChange={setCode} favorites={favorites} />
              <label className="block space-y-1"><span className="text-slate-600">Nama aset</span><input value={f.name} onChange={set("name")} className={inp} /></label>
              <label className="block space-y-1"><span className="text-slate-600">Ruangan (opsional)</span>
                <select value={f.roomId ?? ""} onChange={set("roomId")} className={inp}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            </>
          )}
          <Button type="button" disabled={pending || !f.bastNo || (kind === "KDP" && !code)} onClick={() => run("selesai", { date: f.date, bastNo: f.bastNo ?? "", bmdCode: code?.code ?? "", name: f.name, roomId: f.roomId ?? "" }, "Tandai pekerjaan selesai?")}>Tandai selesai</Button>
        </section>
      )}
      {status !== "SELESAI" && (
        <section className={box}>
          <h2 className="font-semibold">{status === "BERJALAN" ? "Hentikan pekerjaan" : "Pekerjaan dihentikan"}</h2>
          {status === "BERJALAN" ? (
            <>
              <label className="block space-y-1"><span className="text-slate-600">Alasan</span><input value={f.reason ?? ""} onChange={set("reason")} placeholder="mis. kontrak diputus, anggaran tidak tersedia" className={inp} /></label>
              <Button type="button" variant="danger" disabled={pending} onClick={() => run("hentikan", { reason: f.reason ?? "" }, "Tandai pekerjaan dihentikan?")}>Hentikan</Button>
            </>
          ) : (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run("lanjutkan", {})}>Lanjutkan pekerjaan</Button>
          )}
        </section>
      )}
      {kind === "ATR" && (
        <section className={box}>
          <h2 className="font-semibold">Tindak lanjut aset tetap renovasi</h2>
          <select value={f.value} onChange={set("value")} className={inp}>
            <option value="">Belum ada</option>
            {Object.entries(ATR_FOLLOW_UP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run("tindak-lanjut", { value: f.value })}>Simpan</Button>
        </section>
      )}
    </div>
  );
}
