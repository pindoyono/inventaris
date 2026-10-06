"use client";

import { useEffect, useState } from "react";

const F4_CSS = "@page potret{size:215mm 330mm;margin:0}@page lanskap{size:330mm 215mm;margin:0}";

export function PrintBar({ judul, ket }: { judul: string; ket?: string }) {
  const [kertas, setKertas] = useState<"a4" | "f4">(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("kertas") === "f4" ? "f4" : "a4"; } catch { return "a4"; }
  });
  useEffect(() => {
    document.documentElement.dataset.kertas = kertas;
    let el = document.getElementById("kertas-f4") as HTMLStyleElement | null;
    if (kertas === "f4" && !el) { el = document.createElement("style"); el.id = "kertas-f4"; el.textContent = F4_CSS; document.head.appendChild(el); }
    if (kertas === "a4") el?.remove();
    try { localStorage.setItem("kertas", kertas); } catch {}
  }, [kertas]);
  return (
    <div className="bilah tanpa-cetak">
      <a href="#" onClick={(e) => { e.preventDefault(); if (history.length > 1) history.back(); else window.close(); }}>← Kembali</a>
      <strong>{judul}</strong>
      {ket && <span className="ket">{ket}</span>}
      <label className="ket">Kertas{" "}
        <select suppressHydrationWarning value={kertas} onChange={(e) => setKertas(e.target.value as "a4" | "f4")} style={{ color: "#111", borderRadius: 4, padding: "2px 4px" }}>
          <option value="a4">A4</option>
          <option value="f4">F4 / Folio</option>
        </select>
      </label>
      <button type="button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
    </div>
  );
}
