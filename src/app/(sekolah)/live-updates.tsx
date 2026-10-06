"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Halaman yang ikut disegarkan saat data sekolah berubah (dasbor & daftar; bukan form) */
const LIVE_PAGES = ["/dasbor", "/permintaan", "/peminjaman", "/usulan", "/pengadaan", "/persediaan", "/persediaan/dokumen", "/aset", "/audit", "/notifikasi"];

/** Satu koneksi SSE per tab: "notif" → segarkan (lonceng); "data" → segarkan halaman daftar/dasbor */
export function LiveUpdates() {
  const router = useRouter();
  const path = usePathname();
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/peristiwa");
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    es.addEventListener("notif", refresh);
    es.addEventListener("data", () => { if (LIVE_PAGES.includes(pathRef.current)) refresh(); });
    return () => { es.close(); if (timer.current) clearTimeout(timer.current); };
  }, [router]);
  return null;
}
