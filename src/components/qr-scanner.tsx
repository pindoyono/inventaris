"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** Ambil token QR label Inventaris dari teks hasil pindai (URL …/q/{token}) */
export function tokenFromText(t: string) {
  return /\/q\/([0-9a-f]{24})\b/i.exec(t)?.[1]?.toLowerCase() ?? (/^[0-9a-f]{24}$/i.test(t.trim()) ? t.trim().toLowerCase() : null);
}

/**
 * Pemindai QR via kamera belakang. Pakai BarcodeDetector bawaan browser bila ada,
 * selain itu ZXing (dimuat saat diperlukan). `onResult` dipanggil sekali per kode berbeda.
 */
export function QrScanner({ onResult, paused = false }: { onResult: (text: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const last = useRef<{ t: string; at: number } | null>(null);
  const cb = useRef(onResult);
  const pausedRef = useRef(paused);
  useEffect(() => { cb.current = onResult; pausedRef.current = paused; }, [onResult, paused]);

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    const emit = (t: string) => {
      const now = Date.now();
      if (pausedRef.current) return;
      if (last.current && last.current.t === t && now - last.current.at < 3000) return;
      last.current = { t, at: now };
      if ("vibrate" in navigator) navigator.vibrate?.(60);
      cb.current(t);
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setErr("Browser ini tidak mendukung kamera. Gunakan Chrome/Safari terbaru melalui HTTPS.");
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      try {
        if (BD) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (stop) return;
          video.current!.srcObject = stream;
          await video.current!.play();
          const det = new BD({ formats: ["qr_code"] });
          const loop = async () => {
            if (stop) return;
            try { const r = await det.detect(video.current!); if (r[0]) emit(r[0].rawValue); } catch {}
            setTimeout(loop, 250);
          };
          loop();
        } else {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const reader = new BrowserQRCodeReader();
          zxingControls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (res) => { if (res) emit(res.getText()); });
        }
      } catch (e) {
        setErr(e instanceof Error && e.name === "NotAllowedError" ? "Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser." : "Kamera tidak dapat dibuka.");
      }
    })();
    return () => {
      stop = true;
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video ref={video} muted playsInline className="aspect-square w-full object-cover sm:aspect-video" />
        <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
