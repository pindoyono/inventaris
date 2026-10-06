"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { ACQUISITION_LABEL } from "@/lib/assets-shared";
import { correctAction, reclassAction } from "../actions";
import { CodePicker } from "../asset-form";

type Finding = { id: string; kind: "REKLASIFIKASI" | "KOREKSI" | null; note: string | null; number: string; date: string };
type Code = { code: string; name: string; parent: string };

const inp = "block w-full rounded-md border border-slate-300 px-2 py-1.5";

/** Reklasifikasi & koreksi — tindak lanjut hasil inventarisasi (Permendagri 7/2024 C.27/C.29) */
export function Classification({ id, today, findings, favorites, acqPrice, acqDate, acquisition }: {
  id: string; today: string; findings: Finding[]; favorites: Code[]; acqPrice: string; acqDate: string; acquisition: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"" | "REKLASIFIKASI" | "KOREKSI">("");
  const [code, setCode] = useState<Code | null>(null);
  const [f, setF] = useState<Record<string, string>>({ date: today, intra: "auto", acqPrice, acqDate, acquisition });
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pending, start] = useTransition();
  const set = (k: string) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  const mine = findings.filter((x) => x.kind === tab);
  const submit = () =>
    start(async () => {
      const base = { assetId: id, date: f.date, reason: f.reason ?? "", docNo: f.docNo ?? "", inventoryLineId: f.lineId ?? "" };
      const r =
        tab === "REKLASIFIKASI"
          ? await reclassAction({ ...base, bmdCode: code?.code ?? "", intra: f.intra, name: f.name ?? "" })
          : await correctAction({ ...base, acqPrice: f.acqPrice !== acqPrice ? f.acqPrice : "", acqDate: f.acqDate !== acqDate ? f.acqDate : "", acquisition: f.acquisition !== acquisition ? f.acquisition : "" });
      if (r.errors) setMsg({ err: Object.values(r.errors)[0] });
      else {
        setMsg({ ok: r.ok });
        setTab("");
        router.refresh();
      }
    });
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="font-semibold">Reklasifikasi / koreksi</h2>
      {findings.length > 0 && (
        <Alert tone="warning">
          Temuan inventarisasi menunggu tindak lanjut:
          {findings.map((x) => <span key={x.id} className="block">• {x.kind === "KOREKSI" ? "Koreksi" : "Reklasifikasi"} ({x.number}){x.note ? `: ${x.note}` : ""}</span>)}
        </Alert>
      )}
      {msg.ok && <Alert tone="success">{msg.ok}</Alert>}
      {msg.err && <Alert>{msg.err}</Alert>}
      <div className="flex gap-2">
        <Button type="button" variant={tab === "REKLASIFIKASI" ? "primary" : "secondary"} onClick={() => { setTab("REKLASIFIKASI"); setMsg({}); }}>Reklasifikasi</Button>
        <Button type="button" variant={tab === "KOREKSI" ? "primary" : "secondary"} onClick={() => { setTab("KOREKSI"); setMsg({}); }}>Koreksi nilai/tanggal</Button>
      </div>
      {tab && (
        <div className="space-y-2">
          {tab === "REKLASIFIKASI" ? (
            <>
              <p className="text-xs text-slate-500">Pindah kode barang/golongan (nomor register baru) dan/atau status intra/ekstrakomptabel.</p>
              <CodePicker value={code} onChange={setCode} favorites={favorites} />
              <label className="block space-y-1"><span className="text-slate-600">Status pembukuan</span>
                <select value={f.intra} onChange={set("intra")} className={inp}>
                  <option value="auto">Otomatis (batas kapitalisasi)</option><option value="intra">Intrakomptabel</option><option value="ekstra">Ekstrakomptabel</option>
                </select></label>
              <label className="block space-y-1"><span className="text-slate-600">Nama barang baru (opsional)</span><input value={f.name ?? ""} onChange={set("name")} className={inp} /></label>
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1"><span className="text-slate-600">Nilai perolehan (Rp)</span><input value={f.acqPrice} onChange={set("acqPrice")} inputMode="decimal" className={inp} /></label>
              <label className="space-y-1"><span className="text-slate-600">Tanggal perolehan</span><input type="date" max={today} value={f.acqDate} onChange={set("acqDate")} className={inp} /></label>
              <label className="space-y-1"><span className="text-slate-600">Asal perolehan</span>
                <select value={f.acquisition} onChange={set("acquisition")} className={inp}>{Object.entries(ACQUISITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-slate-600">Tanggal</span><input type="date" max={today} value={f.date} onChange={set("date")} className={inp} /></label>
            <label className="space-y-1"><span className="text-slate-600">No. dokumen (BA/SK, opsional)</span><input value={f.docNo ?? ""} onChange={set("docNo")} className={inp} /></label>
          </div>
          <label className="block space-y-1"><span className="text-slate-600">Alasan</span><input value={f.reason ?? ""} onChange={set("reason")} placeholder="mis. salah kode saat pencatatan awal" className={inp} /></label>
          {mine.length > 0 && (
            <label className="block space-y-1"><span className="text-slate-600">Menindaklanjuti temuan</span>
              <select value={f.lineId ?? ""} onChange={set("lineId")} className={inp}>
                <option value="">— bukan dari inventarisasi —</option>
                {mine.map((x) => <option key={x.id} value={x.id}>{x.number}{x.note ? ` — ${x.note}` : ""}</option>)}
              </select></label>
          )}
          <Button type="button" disabled={pending || (tab === "REKLASIFIKASI" && !code)} onClick={submit}>{pending ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      )}
    </div>
  );
}
