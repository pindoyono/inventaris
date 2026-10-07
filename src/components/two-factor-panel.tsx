"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { begin2fa, confirm2fa, disable2fa, regenerateRecovery, type TwoFaState } from "@/lib/server/two-factor";

const inp = "block w-full rounded-md border border-slate-300 px-3 py-2";

/** Pengaktifan verifikasi dua langkah (TOTP) */
export function TwoFactorPanel({ kind, enabled, recoveryLeft }: { kind: "school" | "platform"; enabled: boolean; recoveryLeft: number }) {
  const router = useRouter();
  const [st, setSt] = useState<TwoFaState>({});
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pending, start] = useTransition();
  const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const run = (fn: () => Promise<TwoFaState>) => start(async () => { const r = await fn(); setSt(r); if (r.ok) { setCode(""); setPw(""); router.refresh(); } });

  if (st.codes)
    return (
      <div className="space-y-3">
        <Alert tone="success">{st.ok}</Alert>
        <p className="text-sm">Simpan <b>kode pemulihan</b> berikut di tempat aman (cetak atau catat). Tiap kode hanya bisa dipakai sekali bila HP hilang. Kode ini tidak akan ditampilkan lagi.</p>
        <ul className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-sm">{st.codes.map((c) => <li key={c}>{c}</li>)}</ul>
        <Button type="button" variant="secondary" onClick={() => window.print()}>Cetak kode</Button>
      </div>
    );

  if (!enabled)
    return (
      <div className="space-y-4 text-sm">
        {st.error && <Alert>{st.error}</Alert>}
        {!st.qr ? (
          <>
            <p>Verifikasi dua langkah meminta kode 6 digit dari aplikasi autentikator di HP (Google Authenticator, Microsoft Authenticator, Authy, dll.) setiap kali masuk, sehingga kata sandi yang bocor saja tidak cukup untuk membobol akun.</p>
            <Button type="button" disabled={pending} onClick={() => run(() => begin2fa(kind))}>Aktifkan verifikasi dua langkah</Button>
          </>
        ) : (
          <>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Buka aplikasi autentikator lalu pindai kode QR ini.</li>
              <li>Atau masukkan kunci secara manual: <span className="font-mono font-semibold">{st.secret}</span></li>
              <li>Masukkan kode 6 digit yang muncul di aplikasi.</li>
            </ol>
            <div className="w-52 rounded-md border border-slate-200 bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: st.qr }} />
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className={`${inp} max-w-40`} aria-label="Kode verifikasi" />
            <Button type="button" disabled={pending || code.length < 6} onClick={() => run(() => confirm2fa(kind, form({ code })))}>Konfirmasi & aktifkan</Button>
          </>
        )}
      </div>
    );

  return (
    <div className="space-y-4 text-sm">
      {st.error && <Alert>{st.error}</Alert>}
      {st.ok && <Alert tone="success">{st.ok}</Alert>}
      <Alert tone="success">Verifikasi dua langkah <b>aktif</b>. Sisa kode pemulihan: {recoveryLeft}.</Alert>
      <p className="text-slate-600">Untuk membuat kode pemulihan baru atau menonaktifkan, masukkan kata sandi dan kode dari aplikasi (atau kode pemulihan).</p>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Kata sandi" autoComplete="current-password" className={inp} aria-label="Kata sandi" />
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Kode verifikasi" autoComplete="one-time-code" className={inp} aria-label="Kode verifikasi" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={pending || !pw || !code} onClick={() => run(() => regenerateRecovery(kind, form({ password: pw, code })))}>Buat kode pemulihan baru</Button>
        <Button type="button" variant="danger" disabled={pending || !pw || !code} onClick={() => { if (confirm("Nonaktifkan verifikasi dua langkah?")) run(() => disable2fa(kind, form({ password: pw, code }))); }}>Nonaktifkan</Button>
      </div>
    </div>
  );
}
