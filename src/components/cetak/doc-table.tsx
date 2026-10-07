import { Fragment } from "react";
import type { Cell, DocTable } from "@/lib/server/laporan-docs";
import { fmtNum, fmtRp } from "@/lib/decimal";
import { Tabel } from "./print";

const fmt = (v: Cell, kind: string | undefined) => {
  if (v === null || v === "") return "";
  if (typeof v === "bigint") return v === 0n ? "-" : fmtRp(v);
  if (typeof v === "number") return kind === "num" && v === 0 ? "-" : fmtNum(v);
  return v;
};
const cls = (kind: string | undefined) => (kind === "money" || kind === "num" ? "angka" : kind === "code" ? "kode" : undefined);

/** Header dua tingkat: kolom berkelompok (group) digabung, kolom tanpa kelompok memanjang dua baris */
function Head({ t }: { t: DocTable }) {
  const grouped = t.cols.some((c) => c.group);
  if (!grouped) return <tr>{t.cols.map((c, i) => <th key={i}>{c.label}</th>)}</tr>;
  const top: { label: string; span: number; group: boolean }[] = [];
  for (const c of t.cols) {
    const last = top.at(-1);
    if (c.group && last?.group && last.label === c.group) last.span++;
    else top.push({ label: c.group ?? c.label, span: 1, group: !!c.group });
  }
  return (
    <>
      <tr>{top.map((h, i) => (h.group ? <th key={i} colSpan={h.span}>{h.label}</th> : <th key={i} rowSpan={2}>{h.label}</th>))}</tr>
      <tr>{t.cols.filter((c) => c.group).map((c, i) => <th key={i}>{c.label}</th>)}</tr>
    </>
  );
}

/** Tabel cetak format resmi (dengan baris nomor kolom) */
export function DocPrintTable({ t }: { t: DocTable }) {
  return (
    <>
      {t.caption && <p style={{ fontWeight: 700, margin: "4mm 0 1.5mm" }}>{t.caption}</p>}
      <Tabel cols={t.cols.length} head={<Head t={t} />}
        foot={t.foot && <tr className="jumlah">{t.foot.map((v, i) => <td key={i} className={cls(t.cols[i]?.kind)}>{fmt(v, t.cols[i]?.kind)}</td>)}</tr>}>
        {t.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={cls(t.cols[j]?.kind)}>{fmt(v, t.cols[j]?.kind)}</td>)}</tr>)}
        {t.rows.length === 0 && <tr className="kosong"><td colSpan={t.cols.length} className="tengah">Tidak ada data</td></tr>}
      </Tabel>
    </>
  );
}

/** Versi layar */
export function DocScreenTable({ t }: { t: DocTable }) {
  const th = "border border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-medium text-slate-600";
  const td = (k?: string) => `border border-slate-200 px-2 py-1.5 ${k === "money" || k === "num" ? "text-right tabular-nums" : k === "code" ? "font-mono text-xs" : ""}`;
  const grouped = t.cols.some((c) => c.group);
  return (
    <div className="space-y-1">
      {t.caption && <p className="font-medium">{t.caption}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            {grouped ? (
              <>
                <tr>{t.cols.map((c, i) => (!c.group ? <th key={i} rowSpan={2} className={th}>{c.label}</th> : i === 0 || t.cols[i - 1].group !== c.group ? <th key={i} colSpan={t.cols.filter((x) => x.group === c.group).length} className={`${th} text-center`}>{c.group}</th> : <Fragment key={i} />))}</tr>
                <tr>{t.cols.filter((c) => c.group).map((c, i) => <th key={i} className={th}>{c.label}</th>)}</tr>
              </>
            ) : <tr>{t.cols.map((c, i) => <th key={i} className={th}>{c.label}</th>)}</tr>}
          </thead>
          <tbody>
            {t.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={td(t.cols[j]?.kind)}>{fmt(v, t.cols[j]?.kind)}</td>)}</tr>)}
            {t.rows.length === 0 && <tr><td colSpan={t.cols.length} className="px-3 py-6 text-center text-slate-500">Tidak ada data</td></tr>}
            {t.foot && <tr className="font-semibold">{t.foot.map((v, i) => <td key={i} className={td(t.cols[i]?.kind)}>{fmt(v, t.cols[i]?.kind)}</td>)}</tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
