import Link from "next/link";
import type { ReactNode } from "react";
import { chartSource, flowById } from "./flows";
import { Flowchart } from "./flowchart";

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="mt-8 scroll-mt-20 border-b border-slate-200 pb-1 text-lg font-semibold">{children}</h2>;
}
export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 font-semibold">{children}</h3>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mt-2 leading-relaxed text-slate-700">{children}</p>;
}
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-2 list-decimal space-y-1.5 pl-6 leading-relaxed text-slate-700 marker:font-semibold marker:text-teal-700">{children}</ol>;
}
export function List({ children }: { children: ReactNode }) {
  return <ul className="mt-2 list-disc space-y-1 pl-6 leading-relaxed text-slate-700">{children}</ul>;
}
export function Tip({ children, tone = "tip" }: { children: ReactNode; tone?: "tip" | "warn" }) {
  const c = tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-teal-200 bg-teal-50 text-teal-950";
  return <div className={`mt-3 rounded-md border px-4 py-2.5 text-sm leading-relaxed ${c}`}><b>{tone === "warn" ? "Perhatian: " : "Tips: "}</b>{children}</div>;
}
/** Tautan ke halaman aplikasi */
export function Go({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-2 hover:decoration-teal-700">{children}</Link>;
}
export function Btn({ children }: { children: ReactNode }) {
  return <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[0.85em] font-medium whitespace-nowrap text-slate-800">{children}</span>;
}
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 bg-white">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Flowchart + daftar langkah yang bisa diklik */
export function FlowBlock({ id, compact }: { id: string; compact?: boolean }) {
  const f = flowById(id);
  if (!f) return null;
  return (
    <section id={`alur-${f.id}`} className="mt-4 scroll-mt-20 space-y-3">
      {!compact && <div><h2 className="text-lg font-semibold">{f.title}</h2><p className="text-sm text-slate-600">{f.desc}</p></div>}
      <Flowchart source={chartSource(f)} title={f.title} />
      <details className="rounded-lg border border-slate-200 bg-white text-sm" open={!compact}>
        <summary className="cursor-pointer px-4 py-2 font-medium">Daftar langkah & halaman ({f.links.length})</summary>
        <ol className="grid gap-x-6 gap-y-1 px-4 pb-3 sm:grid-cols-2">
          {f.links.map((l, i) => (
            <li key={`${l.node}-${i}`} className="flex gap-2">
              <span className="font-mono text-xs text-slate-400">{l.node}</span>
              <span><Go href={l.href}>{l.label}</Go>{l.who && <span className="text-slate-500"> · {l.who}</span>}</span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
