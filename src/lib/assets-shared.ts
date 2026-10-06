/** Logika aset yang dipakai server & klien (tanpa akses database) */

export const KIB_PREFIX: Record<string, string> = { "1.3.1": "A", "1.3.2": "B", "1.3.3": "C", "1.3.4": "D", "1.3.5": "E", "1.3.6": "F", "1.5.3": "ATB" };
export const kibOfCode = (code: string) => KIB_PREFIX[code.split(".").slice(0, 3).join(".")] ?? null;

export const KIB_LABEL: Record<string, string> = {
  A: "KIB A — Tanah",
  B: "KIB B — Peralatan dan Mesin",
  C: "KIB C — Gedung dan Bangunan",
  D: "KIB D — Jalan, Irigasi, dan Jaringan",
  E: "KIB E — Aset Tetap Lainnya",
  F: "KIB F — Konstruksi dalam Pengerjaan",
  ATB: "Aset Tak Berwujud",
};

export const CONDITION_LABEL = { BAIK: "Baik", RUSAK_RINGAN: "Rusak ringan", RUSAK_BERAT: "Rusak berat" } as const;
export const STATUS_LABEL = {
  DIGUNAKAN: "Digunakan",
  DIPINJAM: "Dipinjam",
  DALAM_PEMELIHARAAN: "Dalam pemeliharaan",
  DIUSULKAN_HAPUS: "Diusulkan hapus",
  DIHAPUS: "Dihapus",
  HILANG: "Hilang",
} as const;
export const ACQUISITION_LABEL: Record<string, string> = {
  PEMBELIAN: "Pembelian",
  HIBAH: "Hibah/sumbangan",
  PRODUKSI: "Produksi/pembuatan sendiri",
  INVENTARISASI: "Hasil inventarisasi",
  LAINNYA: "Perolehan lain yang sah",
};

/** Atribut khusus per KIB (mengikuti kolom KIB Permendagri 47/2021) */
export const KIB_ATTRS: Record<string, { key: string; label: string }[]> = {
  A: [
    { key: "luas", label: "Luas (m²)" },
    { key: "alamat", label: "Letak/alamat" },
    { key: "hak", label: "Status hak" },
    { key: "sertifikatNo", label: "Nomor sertifikat" },
    { key: "sertifikatTgl", label: "Tanggal sertifikat" },
    { key: "penggunaan", label: "Penggunaan" },
  ],
  B: [
    { key: "ukuran", label: "Ukuran/CC" },
    { key: "bahan", label: "Bahan" },
    { key: "noPabrik", label: "Nomor pabrik/seri" },
    { key: "noRangka", label: "Nomor rangka" },
    { key: "noMesin", label: "Nomor mesin" },
    { key: "noPolisi", label: "Nomor polisi" },
    { key: "noBpkb", label: "Nomor BPKB" },
  ],
  C: [
    { key: "bertingkat", label: "Bertingkat/tidak" },
    { key: "beton", label: "Beton/tidak" },
    { key: "luasLantai", label: "Luas lantai (m²)" },
    { key: "alamat", label: "Letak/alamat" },
    { key: "dokumenNo", label: "Nomor dokumen gedung" },
    { key: "dokumenTgl", label: "Tanggal dokumen" },
    { key: "statusTanah", label: "Status tanah" },
  ],
  D: [
    { key: "konstruksi", label: "Konstruksi" },
    { key: "panjang", label: "Panjang (m)" },
    { key: "lebar", label: "Lebar (m)" },
    { key: "luas", label: "Luas (m²)" },
    { key: "letak", label: "Letak/lokasi" },
  ],
  E: [
    { key: "judul", label: "Judul/pencipta (buku)" },
    { key: "spesifikasi", label: "Spesifikasi" },
    { key: "asalDaerah", label: "Asal daerah (barang seni)" },
    { key: "jenis", label: "Jenis (hewan/tumbuhan)" },
    { key: "ukuran", label: "Ukuran" },
  ],
  F: [
    { key: "konstruksi", label: "Bangunan (P/SP/D)" },
    { key: "luas", label: "Luas (m²)" },
    { key: "letak", label: "Letak/lokasi" },
    { key: "tglMulai", label: "Tanggal mulai" },
  ],
  ATB: [{ key: "spesifikasi", label: "Spesifikasi/lisensi" }],
};

/**
 * Intrakomptabel bila harga satuan ≥ batas kapitalisasi golongannya (atau batas umum).
 * Tanah (A) dan KDP (F) selalu intrakomptabel.
 */
export function isIntraFor(kib: string, priceCents: bigint, capitalization: Record<string, number>) {
  if (kib === "A" || kib === "F") return true;
  const limit = capitalization[kib] ?? capitalization.default ?? 0;
  return priceCents >= BigInt(Math.round(limit * 100));
}

export type RegisterParts = {
  ownershipCode: string; // 11 provinsi / 12 kab/kota
  provinceCode: string; // "65"
  regencyCode: string; // "65.02"
  kodePengguna: string | null;
  kodeKuasaPengguna: string | null;
  kodeSubKuasa: string;
};

/** Kode register dua baris (Permendagri 108/2016). `provisional` bila kode pengguna/kuasa belum diisi. */
export function registerCode(p: RegisterParts, a: { isIntra: boolean; acqDate: string; bmdCode: string; regNo: number }) {
  const kab = p.ownershipCode === "11" ? "00" : p.regencyCode.split(".")[1];
  const provisional = !p.kodePengguna || !p.kodeKuasaPengguna;
  const top = [
    p.ownershipCode,
    a.isIntra ? "01" : "02",
    p.provinceCode,
    kab,
    p.kodePengguna ?? "??????",
    p.kodeKuasaPengguna ?? "?????",
    p.kodeSubKuasa,
    a.acqDate.slice(0, 4),
  ].join(".");
  const bottom = `${a.bmdCode}.${String(a.regNo).padStart(6, "0")}`;
  return { top, bottom, provisional };
}
