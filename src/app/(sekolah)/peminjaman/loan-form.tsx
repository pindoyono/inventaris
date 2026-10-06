"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/assets-shared";
import { createLoanAction, searchLoanableAssets } from "./actions";

type Found = Awaited<ReturnType<typeof searchLoanableAssets>>[number];
type Picked = Found & { conditionOut: keyof typeof CONDITION_LABEL };

export function LoanForm({ canLend, users, defaultDue }: { canLend: boolean; users: { id: string; name: string; info: string | null }[]; defaultDue: string }) {
  const [who, setWho] = useState<"akun" | "manual">(canLend ? "manual" : "akun");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [info, setInfo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [due, setDue] = useState(defaultDue);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => startSearch(async () => setFound(await searchLoanableAssets(q))), 250);
    return () => clearTimeout(t);
  }, [q]);

  function submit() {
    start(async () => {
      const res = await createLoanAction(
        {
          borrowerUserId: who === "akun" ? userId : "",
          borrowerName: who === "manual" ? name : "",
          borrowerInfo: info,
          purpose,
          dueAt: due,
          assets: picked.map((p) => ({ id: p.id, condition: p.conditionOut })),
        },
        canLend,
      );
      if (res?.errors) setErr(res.errors._form ?? Object.values(res.errors)[0]);
    });
  }

  return (
    <div className="space-y-6">
      {err && <Alert>{err}</Alert>}
      {canLend && (
        <Card title="Peminjam">
          <div className="mb-3 flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={who === "manual"} onChange={() => setWho("manual")} className="accent-teal-700" /> Siswa/tamu (tanpa akun)</label>
            <label className="flex items-center gap-2"><input type="radio" checked={who === "akun"} onChange={() => setWho("akun")} className="accent-teal-700" /> Pengguna berakun</label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {who === "manual" ? (
              <Field label="Nama peminjam"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            ) : (
              <Field label="Pengguna">
                <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">Pilih…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.info ? ` (${u.info})` : ""}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Kelas / NIS / NIP (opsional)"><Input value={info} onChange={(e) => setInfo(e.target.value)} placeholder="mis. XI TKJ 1 / 2324101" /></Field>
          </div>
        </Card>
      )}
      <Card title="Peminjaman">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Keperluan"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="mis. presentasi tugas praktik" /></Field>
          <Field label="Batas pengembalian (WITA)"><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
      </Card>
      <Card title="Barang">
        <div className="relative mb-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama/merk/no. register barang yang tersedia…" />
          {q.trim().length >= 2 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {searching && <li className="px-3 py-2 text-sm text-slate-500">Mencari…</li>}
              {!searching && found.filter((f) => !picked.some((p) => p.id === f.id)).length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Tidak ada barang tersedia yang cocok.</li>}
              {found.filter((f) => !picked.some((p) => p.id === f.id)).map((f) => (
                <li key={f.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setPicked([...picked, { ...f, conditionOut: f.condition }]); setQ(""); }}>
                    {f.name}{f.brand ? ` · ${f.brand}` : ""} <span className="font-mono text-xs text-slate-500">reg. {String(f.regNo).padStart(6, "0")}</span>
                    <span className="block text-xs text-slate-500">{f.room ?? "—"} · {CONDITION_LABEL[f.condition]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ul className="divide-y divide-slate-100 text-sm">
          {picked.length === 0 && <li className="py-3 text-center text-slate-500">Belum ada barang.</li>}
          {picked.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1">{p.name}{p.brand ? ` · ${p.brand}` : ""}<span className="block font-mono text-xs text-slate-500">{p.bmdCode} · {String(p.regNo).padStart(6, "0")}</span></span>
              {canLend && (
                <label className="flex items-center gap-1 text-xs text-slate-600">Kondisi diserahkan
                  <select value={p.conditionOut} onChange={(e) => setPicked(picked.map((x, j) => (j === i ? { ...x, conditionOut: e.target.value as Picked["conditionOut"] } : x)))} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                    {Object.entries(CONDITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
              )}
              <button type="button" className="text-red-600 hover:underline" onClick={() => setPicked(picked.filter((_, j) => j !== i))}>Hapus</button>
            </li>
          ))}
        </ul>
      </Card>
      <Button type="button" disabled={pending || !picked.length} onClick={submit}>{pending ? "Menyimpan…" : canLend ? "Serahkan & catat peminjaman" : "Ajukan peminjaman"}</Button>
    </div>
  );
}
