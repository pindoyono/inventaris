import "server-only";
import ExcelJS from "exceljs";

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

export type Cell = string | number | bigint | null | undefined;

function addSheet(wb: ExcelJS.Workbook, name: string, rows: Cell[][]) {
  const ws = wb.addWorksheet(name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  // baris judul = baris pertama yang berisi lebih dari satu sel
  const headerAt = rows.findIndex((r) => r.filter((c) => c !== "" && c !== null && c !== undefined).length > 1);
  rows.forEach((r, i) => {
    const row = ws.addRow(r.map((c) => (typeof c === "bigint" ? Number(c) / 100 : c ?? "")));
    if (i < headerAt) row.font = { bold: true, size: 12 };
    if (i === headerAt) { row.font = { bold: true }; row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }; }
    r.forEach((c, j) => { if (typeof c === "bigint") row.getCell(j + 1).numFmt = Number(c) % 100 === 0 ? "#,##0" : "#,##0.00"; });
  });
  if (headerAt >= 0) ws.views = [{ state: "frozen", ySplit: headerAt + 1 }];
  ws.columns.forEach((col) => {
    let w = 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => { w = Math.max(w, Math.min(50, String(cell.value ?? "").length + 2)); });
    col.width = w;
  });
}

async function xlsxResponse(filename: string, wb: ExcelJS.Workbook) {
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/\.(csv|xlsx)$/, "").replace(/[^\w.-]/g, "_")}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Ekspor tabel sebagai .xlsx (format=xlsx) atau CSV. bigint = nilai perseratus (Rp/jumlah). */
export async function tableResponse(filename: string, rows: Cell[][], format: string | null) {
  if (format !== "xlsx") return csvResponse(filename, rows);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Inventaris";
  addSheet(wb, "Data", rows);
  return xlsxResponse(filename, wb);
}

/** Satu berkas .xlsx berisi beberapa sheet */
export async function workbookResponse(filename: string, sheets: { name: string; rows: Cell[][] }[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Inventaris";
  for (const sh of sheets) addSheet(wb, sh.name, sh.rows);
  return xlsxResponse(filename, wb);
}
