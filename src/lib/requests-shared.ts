/** Alur nota permintaan persediaan — dipakai server & klien */

export type ReqStatus = "DRAF" | "DIAJUKAN" | "DITERUSKAN" | "DIVERIFIKASI" | "DISETUJUI" | "SELESAI" | "DITOLAK" | "DIBATALKAN";
export type ReqAction = "AJUKAN" | "BATAL" | "TERUSKAN" | "VERIFIKASI" | "SETUJUI" | "SALURKAN" | "TOLAK" | "KEMBALIKAN";

export const REQ_STATUS_LABEL: Record<ReqStatus, string> = {
  DRAF: "Draf",
  DIAJUKAN: "Diajukan",
  DITERUSKAN: "Surat permintaan",
  DIVERIFIKASI: "Diverifikasi",
  DISETUJUI: "Disetujui (SPPB)",
  SELESAI: "Selesai disalurkan",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
};
export const REQ_STATUS_CLASS: Record<ReqStatus, string> = {
  DRAF: "bg-slate-100 text-slate-700",
  DIAJUKAN: "bg-sky-100 text-sky-800",
  DITERUSKAN: "bg-indigo-100 text-indigo-800",
  DIVERIFIKASI: "bg-violet-100 text-violet-800",
  DISETUJUI: "bg-amber-100 text-amber-800",
  SELESAI: "bg-emerald-100 text-emerald-800",
  DITOLAK: "bg-red-100 text-red-700",
  DIBATALKAN: "bg-slate-200 text-slate-500",
};
export const ACTION_LABEL: Record<ReqAction, string> = {
  AJUKAN: "Ajukan",
  BATAL: "Batalkan",
  TERUSKAN: "Teruskan (surat permintaan)",
  VERIFIKASI: "Verifikasi",
  SETUJUI: "Setujui (terbitkan SPPB)",
  SALURKAN: "Salurkan",
  TOLAK: "Tolak",
  KEMBALIKAN: "Kembalikan untuk diperbaiki",
};

type Flow = { mode: "LENGKAP" | "RINGKAS"; levels: number };

/**
 * Siapa yang boleh melakukan apa pada status tertentu. `owner` = pembuat nota.
 * ADMIN boleh mewakili langkah Petugas, tetapi tidak langkah Verifikator/Kepala Sekolah (pemisahan tugas).
 */
export function allowedActions(status: ReqStatus, flow: Flow, roles: string[], isOwner: boolean): ReqAction[] {
  const has = (...r: string[]) => r.some((x) => roles.includes(x));
  const petugas = has("PETUGAS", "ADMIN");
  const out: ReqAction[] = [];
  switch (status) {
    case "DRAF":
      if (isOwner || petugas) out.push("AJUKAN", "BATAL");
      break;
    case "DIAJUKAN":
      if (petugas) out.push(flow.mode === "RINGKAS" ? "SALURKAN" : "TERUSKAN", "KEMBALIKAN", "TOLAK");
      if (isOwner) out.push("BATAL");
      break;
    case "DITERUSKAN":
      if (flow.levels >= 2 && has("VERIFIKATOR")) out.push("VERIFIKASI", "KEMBALIKAN", "TOLAK");
      if (flow.levels < 2 && has("KEPSEK")) out.push("SETUJUI", "KEMBALIKAN", "TOLAK");
      break;
    case "DIVERIFIKASI":
      if (has("KEPSEK")) out.push("SETUJUI", "KEMBALIKAN", "TOLAK");
      break;
    case "DISETUJUI":
      if (petugas) out.push("SALURKAN");
      break;
  }
  return [...new Set(out)];
}

/** Tahap berikutnya untuk ditampilkan ("menunggu …") */
export function waitingFor(status: ReqStatus, flow: Flow | null) {
  if (status === "DRAF") return "pengusul mengajukan";
  if (status === "DIAJUKAN") return flow?.mode === "RINGKAS" ? "Petugas Barang menyalurkan" : "Petugas Barang membuat surat permintaan";
  if (status === "DITERUSKAN") return (flow?.levels ?? 1) >= 2 ? "Verifikator memeriksa" : "Kepala Sekolah menyetujui";
  if (status === "DIVERIFIKASI") return "Kepala Sekolah menyetujui";
  if (status === "DISETUJUI") return "Petugas Barang menyalurkan";
  return null;
}
