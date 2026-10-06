import { reportPeriod } from "@/lib/assets-shared";
import { namaBulan } from "@/lib/terbilang";

/** Periode cetak: ?bulan=1..12 (bulanan) atau ?semester=1|2|0 (semester/setahun), ?tahun= */
export function printPeriod(sp: Record<string, string | string[] | undefined>, today: string) {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const year = /^\d{4}$/.test(s("tahun")) ? Number(s("tahun")) : Number(today.slice(0, 4));
  const month = Number(s("bulan"));
  if (month >= 1 && month <= 12) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, "0");
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${last}`, label: `${namaBulan(month)} ${year}` };
  }
  const sem = ["1", "2", "0"].includes(s("semester")) ? s("semester") : Number(today.slice(5, 7)) <= 6 ? "1" : "2";
  return reportPeriod(year, sem);
}
export const endOrToday = (to: string, today: string) => (to < today ? to : today);
