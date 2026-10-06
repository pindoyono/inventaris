import "server-only";

/** CSV untuk Excel berlokal Indonesia: pemisah ";", desimal koma, BOM UTF-8 */
export function csvResponse(filename: string, rows: (string | number | bigint | null | undefined)[][]) {
  const cell = (v: string | number | bigint | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "bigint" ? centsToId(v) : typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** bigint perseratus → "1250000,5" / "1250000" */
function centsToId(v: bigint) {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const frac = a % 100n;
  return `${neg ? "-" : ""}${a / 100n}${frac ? "," + String(frac).padStart(2, "0").replace(/0$/, "") : ""}`;
}
