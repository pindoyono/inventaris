export const ROLES = ["ADMIN", "KEPSEK", "VERIFIKATOR", "PETUGAS", "PENGUSUL", "PEMINJAM"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin Sekolah",
  KEPSEK: "Kepala Sekolah",
  VERIFIKATOR: "Verifikator",
  PETUGAS: "Petugas Barang",
  PENGUSUL: "Pengusul",
  PEMINJAM: "Peminjam",
};

/** Padanan jabatan BMD yang dicetak di dokumen */
export const ROLE_BMD: Partial<Record<Role, string>> = {
  KEPSEK: "Kuasa Pengguna Barang",
  PETUGAS: "Pengurus Barang Pembantu",
};

export function hasAnyRole(userRoles: readonly string[] | undefined, required: readonly Role[]) {
  return !!userRoles?.some((r) => (required as readonly string[]).includes(r));
}
