"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

let ready: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  ready ??= import("mermaid").then((m) => {
    m.default.initialize({
      startOnLoad: false,
      // "loose" diperlukan agar `click … href` menjadi tautan; isi diagram berasal dari kode aplikasi sendiri
      securityLevel: "loose",
      theme: "base",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      themeVariables: {
        primaryColor: "#f8fafc",
        primaryBorderColor: "#94a3b8",
        primaryTextColor: "#0f172a",
        lineColor: "#64748b",
        clusterBkg: "#f1f5f9",
        clusterBorder: "#cbd5e1",
        fontSize: "14px",
      },
      flowchart: { htmlLabels: true, curve: "basis", nodeSpacing: 28, rankSpacing: 40, useMaxWidth: true },
    });
    return m.default;
  });
  return ready;
}

/** Flowchart Mermaid; simpul berwarna hijau toska bisa diklik untuk membuka halaman terkait */
export function Flowchart({ source, title }: { source: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMermaid()
      .then((m) => m.render(`fc${uid}`, source))
      .then(({ svg, bindFunctions }) => {
        const el = ref.current;
        if (cancelled || !el) return;
        el.innerHTML = svg;
        bindFunctions?.(el);
        const s = el.querySelector("svg");
        s?.setAttribute("role", "img");
        s?.setAttribute("aria-label", `Flowchart: ${title}`);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [source, title, uid]);

  // Tautan internal dibuka lewat router (tanpa muat ulang penuh)
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest("a");
    const href = a?.getAttribute("href") ?? a?.getAttribute("xlink:href");
    if (!href?.startsWith("/") || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    router.push(href);
  };

  if (failed) return <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Diagram tidak dapat ditampilkan di peramban ini. Gunakan daftar langkah di bawahnya.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
      <div ref={ref} onClick={onClick} className="fc-wrap min-h-40 [&_a]:cursor-pointer [&_svg]:mx-auto [&_svg]:min-w-[600px]">
        <p className="py-10 text-center text-sm text-slate-500">Memuat diagram…</p>
      </div>
    </div>
  );
}
