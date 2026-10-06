/** KDP & aset tetap renovasi — logika bersama server & klien */

export const CONSTRUCTION_KIND_LABEL = { KDP: "Konstruksi Dalam Pengerjaan (KDP)", ATR: "Aset Tetap Renovasi (renovasi aset pihak lain)" } as const;
export const CONSTRUCTION_STATUS_LABEL = { BERJALAN: "Berjalan", DIHENTIKAN: "Dihentikan", SELESAI: "Selesai" } as const;
export const ATR_FOLLOW_UP_LABEL = { PEMINDAHTANGANAN: "Diusulkan pemindahtanganan", PENGALIHAN_STATUS: "Diusulkan pengalihan status penggunaan" } as const;

/** Kode tingkat 7 Permendagri 108/2016 */
export const CONSTRUCTION_CODES = {
  KDP: [
    { code: "1.3.6.01.01.01.001", name: "Tanah Dalam Pengerjaan" },
    { code: "1.3.6.01.01.01.002", name: "Peralatan dan Mesin Dalam Pengerjaan" },
    { code: "1.3.6.01.01.01.003", name: "Gedung dan Bangunan Dalam Pengerjaan" },
    { code: "1.3.6.01.01.01.004", name: "Jalan, Irigasi, dan Jaringan Dalam Pengerjaan" },
    { code: "1.3.6.01.01.01.005", name: "Aset Tetap Lainnya Dalam Pengerjaan" },
  ],
  ATR: [
    { code: "1.3.5.07.01.01.001", name: "Tanah Dalam Renovasi" },
    { code: "1.3.5.07.01.01.002", name: "Peralatan dan Mesin Dalam Renovasi" },
    { code: "1.3.5.07.01.01.003", name: "Gedung dan Bangunan Dalam Renovasi" },
    { code: "1.3.5.07.01.01.004", name: "Jalan, Irigasi, dan Jaringan Dalam Renovasi" },
    { code: "1.3.5.07.01.01.005", name: "Aset Tetap Lainnya Dalam Renovasi" },
  ],
} as const;

export const isConstructionCode = (kind: "KDP" | "ATR", code: string) => CONSTRUCTION_CODES[kind].some((c) => c.code === code);
/** Kode yang hanya boleh dicatat lewat menu KDP & Renovasi */
export const isReservedConstructionCode = (code: string) => code.startsWith("1.3.6.") || code.startsWith("1.3.5.07.");
