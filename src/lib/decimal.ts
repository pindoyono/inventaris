/**
 * Angka desimal 2 digit (jumlah barang & rupiah) disimpan sebagai bigint perseratus agar tidak ada
 * galat floating point. "12.5" → 1250n, 1250n → "12.50".
 */
export function parseDec(v: string | number | null | undefined): bigint {
  if (v === null || v === undefined || v === "") return 0n;
  const s = typeof v === "number" ? v.toFixed(2) : v.trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`Angka tidak valid: ${v}`);
  const n = BigInt(m[2]) * 100n + BigInt((m[3] ?? "").padEnd(2, "0"));
  return m[1] ? -n : n;
}

export function toDec(n: bigint): string {
  const neg = n < 0n;
  const a = neg ? -n : n;
  return `${neg ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
}

/** Nilai = jumlah × harga, dibulatkan setengah ke atas ke sen */
export function mulDec(qty: bigint, price: bigint): bigint {
  const p = qty * price;
  return (p + (p >= 0n ? 50n : -50n)) / 100n;
}

/** Ubah isian pengguna gaya Indonesia ("1.250.000,50" / "12,5") jadi string desimal ("1250000.50") */
export function normalizeIdNumber(v: string): string {
  const s = v.trim().replace(/\s|Rp/gi, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) return s.replace(/\./g, "").replace(",", ".");
  return s.replace(",", ".");
}

const idFmt = (min: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: min, maximumFractionDigits: 2 });
/** Tampilan: 1250000.50 → "1.250.000,50"; bilangan bulat tanpa desimal */
export function fmtNum(v: string | bigint | number | null | undefined) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "bigint" ? toDec(v) : String(v);
  const n = Number(s);
  return idFmt(Number.isInteger(n) ? 0 : 2).format(n);
}
export const fmtRp = (v: string | bigint | number | null | undefined) => fmtNum(v);
