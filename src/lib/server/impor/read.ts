import "server-only";
import ExcelJS from "exceljs";
import { UserError } from "@/lib/server/errors";
import { mapHeaders, type ImportKind } from "./spec";

const MAX_ROWS = 2000;

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v).trim();
}

function parseCsv(text: string) {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) >= (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Baca .xlsx/.csv → baris {kunci: teks}. Baris judul = baris pertama yang memuat kolom wajib. */
export async function readImportFile(kind: ImportKind, file: File) {
  if (file.size === 0) throw new UserError("Berkas kosong");
  if (file.size > 3 * 1024 * 1024) throw new UserError("Ukuran berkas maksimal 3 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  let grid: string[][];
  if (buf.subarray(0, 2).toString("latin1") === "PK") {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } catch {
      throw new UserError("Berkas Excel tidak bisa dibaca. Simpan sebagai .xlsx (Excel 2007 ke atas).");
    }
    const ws = wb.worksheets.find((w) => w.name.toLowerCase() !== "petunjuk") ?? wb.worksheets[0];
    if (!ws) throw new UserError("Lembar kerja tidak ditemukan");
    grid = [];
    ws.eachRow({ includeEmpty: true }, (r, n) => {
      const vals = (r.values as ExcelJS.CellValue[]).slice(1);
      grid[n - 1] = vals.map(cellText);
    });
    grid = Array.from(grid, (r) => r ?? []);
  } else if (/\.(csv|txt)$/i.test(file.name)) {
    grid = parseCsv(buf.toString("utf8").replace(/^﻿/, ""));
  } else {
    throw new UserError("Format berkas harus .xlsx atau .csv (file .xls lama: buka di Excel lalu Simpan Sebagai .xlsx)");
  }
  // cari baris judul dalam 10 baris pertama
  let headerAt = -1, mapping: ReturnType<typeof mapHeaders> | null = null;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const m = mapHeaders(kind, grid[i] ?? []);
    if (m.map.size && !m.missing.length) { headerAt = i; mapping = m; break; }
    if (!mapping || m.map.size > mapping.map.size) mapping = m;
  }
  if (headerAt < 0) throw new UserError(`Kolom wajib tidak ditemukan: ${mapping?.missing.join(", ") || "periksa baris judul"}. Gunakan template dari halaman ini.`);
  const rows: { row: number; data: Record<string, string> }[] = [];
  for (let i = headerAt + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    if (!r.some((c) => c && c.trim())) continue;
    const data: Record<string, string> = {};
    for (const [col, key] of mapping!.map) data[key] = (r[col] ?? "").trim();
    rows.push({ row: i + 1, data });
    if (rows.length > MAX_ROWS) throw new UserError(`Maksimal ${MAX_ROWS} baris per impor; bagi berkas menjadi beberapa bagian`);
  }
  if (!rows.length) throw new UserError("Tidak ada baris data di bawah baris judul");
  return rows;
}
