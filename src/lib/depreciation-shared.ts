/**
 * Masa manfaat bawaan (tahun) per objek kode barang Permendagri 108/2016, mengacu praktik umum
 * Buletin Teknis SAP 18. Pemda menetapkan sendiri lewat Perkada → bisa ditimpa per sekolah di Penyiapan.
 * 0 = tidak disusutkan (tanah, KDP, aset tetap lainnya berupa buku/kesenian/hewan/tanaman).
 */
export const DEFAULT_USEFUL_LIFE: Record<string, number> = {
  "1.3.1.01": 0,
  "1.3.2.01": 10,
  "1.3.2.02": 7,
  "1.3.2.03": 5,
  "1.3.2.04": 4,
  "1.3.2.05": 5,
  "1.3.2.06": 5,
  "1.3.2.07": 5,
  "1.3.2.08": 8,
  "1.3.2.09": 10,
  "1.3.2.10": 4,
  "1.3.2.11": 10,
  "1.3.2.12": 10,
  "1.3.2.13": 10,
  "1.3.2.14": 10,
  "1.3.2.15": 5,
  "1.3.2.16": 10,
  "1.3.2.17": 8,
  "1.3.2.18": 7,
  "1.3.2.19": 5,
  "1.3.3.01": 50,
  "1.3.3.02": 50,
  "1.3.3.03": 40,
  "1.3.3.04": 50,
  "1.3.4.01": 10,
  "1.3.4.02": 40,
  "1.3.4.03": 30,
  "1.3.4.04": 40,
  "1.3.5.01": 0,
  "1.3.5.02": 0,
  "1.3.5.03": 0,
  "1.3.5.04": 0,
  "1.3.5.05": 0,
  "1.3.5.06": 0,
  "1.3.5.07": 0,
  "1.3.6.01": 0,
  "1.5.3.01": 4,
};

export const objekOf = (code: string) => code.split(".").slice(0, 4).join(".");
export const jenisOf = (code: string) => code.split(".").slice(0, 3).join(".");

export function usefulLife(code: string, overrides: Record<string, number> | null | undefined) {
  const o = objekOf(code);
  const v = overrides?.[o] ?? DEFAULT_USEFUL_LIFE[o];
  return typeof v === "number" && v > 0 ? v : 0;
}

/** Nomor urut semester: 2026 semester I → 4052, semester II → 4053 */
export const semIndex = (iso: string) => Number(iso.slice(0, 4)) * 2 + (Number(iso.slice(5, 7)) <= 6 ? 0 : 1);
export const semEnd = (idx: number) => `${Math.floor(idx / 2)}-${idx % 2 ? "12-31" : "06-30"}`;
export const semLabel = (idx: number) => `Semester ${idx % 2 ? "II" : "I"} ${Math.floor(idx / 2)}`;
