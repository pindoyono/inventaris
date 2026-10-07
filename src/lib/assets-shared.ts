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
  PENERIMAAN_INTERNAL: "Penerimaan internal Pengguna Barang",
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
  provinceCode: string; // kode wilayah, mis. "65" (cadangan bila kode provinsi SIMDA kosong)
  regencyCode: string; // "65.02"
  /** Format SIMDA BMD (label Dinas) */
  kodeProvinsi: string | null; // mis. "34" (Kalimantan Utara di SIMDA)
  kodeKab: string | null;
  kodeBidang: string | null; // "08" Bidang Pendidikan dan Kebudayaan
  kodeUnit: string | null; // "01" Dinas Pendidikan, Kebudayaan
  kodeSubUnit: string | null; // "058" SMKN 2 Malinau
  /** UPB bawaan (barang tanpa sumber dana / sumber dana tanpa kode UPB) */
  kodeUpb: string;
  /** id sumber dana → kode UPB */
  upbByFunding: Record<string, string>;
};

/** Kode lokasi belum lengkap → kode register ditandai SEMENTARA */
export const lokasiProvisional = (p: RegisterParts) => !p.kodeBidang || !p.kodeUnit || !p.kodeSubUnit;

/** UPB barang: dari sumber dananya, bila tidak ada pakai UPB bawaan */
export const upbOf = (p: RegisterParts, fundingSourceId: string | null | undefined) => (fundingSourceId && p.upbByFunding[fundingSourceId]) || p.kodeUpb || "01";

/**
 * Kode register dua baris seperti label SIMDA BMD:
 * atas  = kepemilikan.intra/ekstra.provinsi.kab/kota.bidang.unit.sub unit.UPB.tahun   → 11.01.34.00.08.01.058.02.2026
 * bawah = kode barang (rincian & sub rincian 3 digit).nomor register                   → 1.3.2.05.002.007.001.000001
 */
export function registerCode(p: RegisterParts, a: { isIntra: boolean; acqDate: string; bmdCode: string; regNo: number; fundingSourceId?: string | null }) {
  const kab = p.kodeKab ?? (p.ownershipCode === "11" ? "00" : p.regencyCode.split(".")[1]);
  const top = [
    p.ownershipCode,
    a.isIntra ? "01" : "02",
    p.kodeProvinsi ?? p.provinceCode,
    kab,
    p.kodeBidang ?? "??",
    p.kodeUnit ?? "??",
    p.kodeSubUnit ?? "???",
    upbOf(p, a.fundingSourceId),
    a.acqDate.slice(0, 4),
  ].join(".");
  const bottom = `${kodeBarang(a.bmdCode)}.${String(a.regNo).padStart(6, "0")}`;
  return { top, bottom, provisional: lokasiProvisional(p) };
}

/**
 * Kode barang aset ditampilkan seperti SIMDA BMD: rincian objek & sub rincian objek 3 digit
 * (1.3.2.05.02.07.001 → 1.3.2.05.002.007.001). Disimpan tetap mengikuti referensi Permendagri 108 (2 digit).
 */
export function kodeBarang(code: string) {
  if (!/^1\.[35]\./.test(code)) return code;
  const p = code.split(".");
  for (const i of [4, 5]) if (p[i] !== undefined && /^\d{1,2}$/.test(p[i])) p[i] = p[i].padStart(3, "0");
  return p.join(".");
}

/** Kebalikan kodeBarang: terima ketikan/impor format SIMDA (3 digit) atau Permendagri (2 digit) */
export function kodeBarangInternal(code: string) {
  const c = code.trim();
  if (!/^1\.[35]\./.test(c)) return c;
  const p = c.split(".");
  for (const i of [4, 5]) if (p[i] !== undefined && /^0\d{2}$/.test(p[i])) p[i] = p[i].slice(1);
  return p.join(".");
}

/** [1,2,3,5,7,8] → "000001 s/d 000003, 000005, 000007 s/d 000008" */
export function compressRegNos(nos: number[]) {
  const sorted = [...new Set(nos)].sort((a, b) => a - b);
  const pad = (n: number) => String(n).padStart(6, "0");
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${pad(sorted[i])} s/d ${pad(sorted[j])}` : pad(sorted[i]));
    i = j + 1;
  }
  return parts.join(", ");
}

/** Periode laporan: semester (Permendagri 47/2021) atau setahun */
export function reportPeriod(year: number, sem: string) {
  if (sem === "1") return { from: `${year}-01-01`, to: `${year}-06-30`, label: `Semester I Tahun ${year}` };
  if (sem === "2") return { from: `${year}-07-01`, to: `${year}-12-31`, label: `Semester II Tahun ${year}` };
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Tahun ${year}` };
}
