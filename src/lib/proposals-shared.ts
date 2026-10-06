export type PStatus = "DRAF" | "DIAJUKAN" | "DIVERIFIKASI" | "DISETUJUI" | "SELESAI" | "DITOLAK" | "DIBATALKAN";
export type PAction = "AJUKAN" | "BATAL" | "VERIFIKASI" | "SETUJUI" | "KEMBALIKAN" | "TOLAK" | "SELESAI";

export const P_STATUS_LABEL: Record<PStatus, string> = {
  DRAF: "Draf", DIAJUKAN: "Diajukan", DIVERIFIKASI: "Diverifikasi", DISETUJUI: "Disetujui", SELESAI: "Selesai", DITOLAK: "Ditolak", DIBATALKAN: "Dibatalkan",
};
export const P_STATUS_CLASS: Record<PStatus, string> = {
  DRAF: "bg-slate-100 text-slate-700", DIAJUKAN: "bg-sky-100 text-sky-800", DIVERIFIKASI: "bg-violet-100 text-violet-800", DISETUJUI: "bg-emerald-100 text-emerald-800",
  SELESAI: "bg-teal-100 text-teal-800", DITOLAK: "bg-red-100 text-red-700", DIBATALKAN: "bg-slate-200 text-slate-500",
};
export const P_ACTION_LABEL: Record<PAction, string> = {
  AJUKAN: "Ajukan", BATAL: "Batalkan", VERIFIKASI: "Verifikasi", SETUJUI: "Setujui", KEMBALIKAN: "Kembalikan", TOLAK: "Tolak", SELESAI: "Tandai selesai",
};
export const PRIORITY_LABEL: Record<number, string> = { 1: "Tinggi", 2: "Sedang", 3: "Rendah" };

export function proposalActions(status: PStatus, levels: number, roles: string[], isOwner: boolean): PAction[] {
  const has = (...r: string[]) => r.some((x) => roles.includes(x));
  const out: PAction[] = [];
  if (status === "DRAF" && (isOwner || has("ADMIN", "PETUGAS"))) out.push("AJUKAN", "BATAL");
  if (status === "DIAJUKAN" && levels >= 2 && has("VERIFIKATOR")) out.push("VERIFIKASI", "KEMBALIKAN", "TOLAK");
  if (status === "DIAJUKAN" && levels < 2 && has("KEPSEK")) out.push("SETUJUI", "KEMBALIKAN", "TOLAK");
  if (status === "DIVERIFIKASI" && has("KEPSEK")) out.push("SETUJUI", "KEMBALIKAN", "TOLAK");
  if (status === "DIAJUKAN" && isOwner) out.push("BATAL");
  if (status === "DISETUJUI" && has("ADMIN", "PETUGAS", "KEPSEK")) out.push("SELESAI");
  return [...new Set(out)];
}
