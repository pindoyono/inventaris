"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { transferStepAction } from "../actions";

const inp = "block w-full rounded-md border border-slate-300 px-2 py-1.5";

export function TransferSteps({ id, status, mine, external, approvalNo, today, rooms, canManage }: {
  id: string; status: string; mine: boolean; external: boolean; approvalNo: string; today: string; rooms: { id: string; name: string }[]; canManage: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>({ bastDate: today, date: today, approvalNo });
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const set = (k: string) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  const run = (step: string, extra: Record<string, string>, c?: string) => {
    if (c && !confirm(c)) return;
    start(async () => {
      const r = await transferStepAction(id, { step, ...extra });
      setMsg(r.errors ? { err: Object.values(r.errors)[0] } : { ok: r.ok });
      if (!r.errors) router.refresh();
    });
  };
  const box = "space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm";
  const field = (k: string, label: string, type = "text") => <label className="block space-y-1"><span className="text-slate-600">{label}</span><input type={type} max={type === "date" ? today : undefined} value={f[k] ?? ""} onChange={set(k)} className={inp} /></label>;
  return (
    <div className="space-y-4">
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      {mine && status === "DRAF" && (
        <section className={box}>
          <h2 className="font-semibold">Serahkan (BAST)</h2>
          <p className="text-xs text-slate-500">Barang keluar dari daftar barang sekolah ini pada tanggal BAST.{external ? "" : " Sekolah penerima diberi tahu untuk mencatat penerimaan."}</p>
          {field("approvalNo", "No. surat persetujuan Pengguna Barang")}
          {field("approvalDate", "Tanggal persetujuan", "date")}
          {field("bastNo", "Nomor BAST")}
          {field("bastDate", "Tanggal BAST", "date")}
          <Button type="button" disabled={pending} onClick={() => run("serahkan", { bastNo: f.bastNo ?? "", bastDate: f.bastDate, approvalNo: f.approvalNo ?? "", approvalDate: f.approvalDate ?? "" }, "Serahkan barang? Barang akan keluar dari daftar barang sekolah.")}>Serahkan</Button>
        </section>
      )}
      {mine && canManage && ["DRAF", "DISERAHKAN", "DITOLAK"].includes(status) && (
        <section className={box}>
          <h2 className="font-semibold">Batalkan</h2>
          {status !== "DRAF" && <p className="text-xs text-slate-500">Barang dikembalikan ke daftar barang sekolah (pembatalan penghapusan).</p>}
          {field("reason", "Alasan")}
          <Button type="button" variant="danger" disabled={pending} onClick={() => run("batal", { reason: f.reason ?? "" }, "Batalkan pengalihan ini?")}>Batalkan</Button>
        </section>
      )}
      {!mine && canManage && status === "DISERAHKAN" && (
        <section className={box}>
          <h2 className="font-semibold">Catat penerimaan</h2>
          <p className="text-xs text-slate-500">Barang dicatat sebagai aset sekolah ini dengan nilai & tahun perolehan asal (nomor register baru).</p>
          {field("date", "Tanggal terima", "date")}
          <label className="block space-y-1"><span className="text-slate-600">Tempatkan di ruangan</span>
            <select value={f.roomId ?? ""} onChange={set("roomId")} className={inp}><option value="">— belum ditempatkan —</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          {field("note", "Catatan")}
          <Button type="button" disabled={pending} onClick={() => run("terima", { date: f.date, roomId: f.roomId ?? "", note: f.note ?? "" })}>Terima & catat</Button>
          <div className="border-t border-slate-100 pt-2">
            {field("reason", "Alasan penolakan")}
            <Button type="button" variant="secondary" className="mt-2" disabled={pending} onClick={() => run("tolak", { reason: f.reason ?? "" }, "Tolak penerimaan?")}>Tolak</Button>
          </div>
        </section>
      )}
    </div>
  );
}
