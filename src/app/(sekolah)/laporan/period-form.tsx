import type { ReactNode } from "react";

export function PeriodForm({ year, sem, children }: { year: number; sem: string; children?: ReactNode }) {
  return (
    <form className="flex flex-wrap gap-2 text-sm">
      {children}
      <select name="semester" defaultValue={sem} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
        <option value="1">Semester I</option>
        <option value="2">Semester II</option>
        <option value="0">Setahun</option>
      </select>
      <input name="tahun" defaultValue={year} inputMode="numeric" className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5" />
      <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5">Tampilkan</button>
    </form>
  );
}
