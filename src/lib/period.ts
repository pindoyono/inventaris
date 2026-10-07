/** Periode laporan barang: bulanan, semesteran, atau tahunan (Permendagri 47/2021 Ps. 75) */
export type Period = { kind: "bulan" | "semester" | "tahun"; year: number; month: number; sem: 1 | 2; from: string; to: string; label: string; semX: number | null; prevSemX: number | null };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function parsePeriod(sp: Record<string, string | string[] | undefined>, today: string): Period {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const kind = (["bulan", "semester", "tahun"] as const).find((k) => k === str("periode")) ?? "semester";
  const year = /^\d{4}$/.test(str("tahun")) ? Number(str("tahun")) : Number(today.slice(0, 4));
  const month = Math.min(12, Math.max(1, Number(str("bulan")) || Number(today.slice(5, 7))));
  const sem = (str("semester") === "2" || (!str("semester") && Number(today.slice(5, 7)) > 6) ? 2 : 1) as 1 | 2;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (kind === "bulan") {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { kind, year, month, sem, from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${last}`, label: `Bulan ${BULAN[month - 1]} ${year}`, semX: null, prevSemX: null };
  }
  if (kind === "tahun") return { kind, year, month, sem, from: `${year}-01-01`, to: `${year}-12-31`, label: `Tahun ${year}`, semX: year * 2 + 1, prevSemX: year * 2 - 1 };
  const x = year * 2 + (sem - 1);
  return { kind, year, month, sem, from: `${year}-${sem === 1 ? "01-01" : "07-01"}`, to: `${year}-${sem === 1 ? "06-30" : "12-31"}`, label: `Semester ${sem === 1 ? "I" : "II"} Tahun ${year}`, semX: x, prevSemX: x - 1 };
}

export const periodQuery = (p: Period) => `periode=${p.kind}&tahun=${p.year}&bulan=${p.month}&semester=${p.sem}`;
