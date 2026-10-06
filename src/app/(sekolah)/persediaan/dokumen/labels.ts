export const KIND_LABEL = {
  SALDO_AWAL: "Saldo awal",
  PENERIMAAN: "Penerimaan",
  PENYALURAN: "Penyaluran",
  MUTASI: "Mutasi antar gudang",
  PENYESUAIAN_TAMBAH: "Penyesuaian (tambah)",
  PENYESUAIAN_KURANG: "Penyesuaian (kurang)",
  RUSAK_USANG: "Rusak/usang",
} as const;
export type FormKind = "SALDO_AWAL" | "PENERIMAAN" | "PENYALURAN" | "MUTASI" | "RUSAK_USANG";
export const FORM_KINDS: FormKind[] = ["SALDO_AWAL", "PENERIMAAN", "PENYALURAN", "MUTASI", "RUSAK_USANG"];
export const STATUS_LABEL = { DRAF: "Draf", DIPOSTING: "Diposting", DIBATALKAN: "Dibatalkan" } as const;
export const STATUS_CLASS = {
  DRAF: "bg-amber-100 text-amber-800",
  DIPOSTING: "bg-emerald-100 text-emerald-800",
  DIBATALKAN: "bg-slate-200 text-slate-600 line-through",
} as const;
/** Cara perolehan persediaan (Permendagri 47/2021 Pasal 7) */
export const ACQUISITION = [
  ["PEMBELIAN", "Pembelian"],
  ["HIBAH", "Hibah/sumbangan"],
  ["PRODUKSI", "Produksi sendiri"],
  ["LAINNYA", "Perolehan lain yang sah"],
] as const;
export const KIND_HINT: Record<FormKind, string> = {
  SALDO_AWAL: "Stok yang sudah ada saat sekolah mulai memakai Inventaris. Isi harga perolehan per batch; bila satu barang punya beberapa harga, buat dokumen saldo awal terpisah per tanggal perolehan.",
  PENERIMAAN: "Barang persediaan masuk dari pembelian, hibah, atau perolehan lain.",
  PENYALURAN: "Barang keluar ke unit pemakai. Nilai dihitung otomatis FIFO (batch tertua lebih dulu).",
  MUTASI: "Pindah barang antar gudang sekolah; batch pindah dengan tanggal dan harga aslinya.",
  RUSAK_USANG: "Berita Acara Perubahan Fisik: persediaan rusak berat/usang dikeluarkan dari stok (FIFO) ke daftar persediaan rusak/usang (Permendagri 47/2021 Ps. 38). Jelaskan sebabnya di catatan.",
};
