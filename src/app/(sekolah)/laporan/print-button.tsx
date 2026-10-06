"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
      Cetak
    </button>
  );
}
