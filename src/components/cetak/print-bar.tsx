"use client";

export function PrintBar({ judul, ket }: { judul: string; ket?: string }) {
  return (
    <div className="bilah tanpa-cetak">
      <a href="#" onClick={(e) => { e.preventDefault(); if (history.length > 1) history.back(); else window.close(); }}>← Kembali</a>
      <strong>{judul}</strong>
      {ket && <span className="ket">{ket}</span>}
      <button type="button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
    </div>
  );
}
