import { reportPeriod } from "@/lib/assets-shared";

/** Baca tahun & semester dari query; bawaan: semester berjalan */
export function periodFrom(sp: Record<string, string | string[] | undefined>, today: string) {
  const year = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? Number(sp.tahun) : Number(today.slice(0, 4));
  const sem = typeof sp.semester === "string" && ["1", "2", "0"].includes(sp.semester) ? sp.semester : Number(today.slice(5, 7)) <= 6 ? "1" : "2";
  const p = reportPeriod(year, sem);
  return { year, sem, ...p, asOf: p.to < today ? p.to : today };
}
export const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
