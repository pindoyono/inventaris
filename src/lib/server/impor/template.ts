import "server-only";
import ExcelJS from "exceljs";
import { IMPORT_SPECS, type ImportKind } from "./spec";

/** Template .xlsx: lembar "Data" (judul kolom) + lembar "Petunjuk" (penjelasan & contoh) */
export async function buildTemplate(kind: ImportKind) {
  const spec = IMPORT_SPECS[kind];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Inventaris";
  const ws = wb.addWorksheet("Data", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = spec.cols.map((c) => ({ header: c.header + (c.required ? " *" : ""), key: c.key, width: Math.max(14, c.header.length + 4, c.example.length + 2) }));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle", wrapText: true };
  spec.cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? "FFFDE68A" : "FFE5E7EB" } };
    cell.note = c.help || c.header;
    // teks agar kode barang/NIP/register tidak berubah jadi angka
    if (["kode", "nip", "nip_pj", "register", "username"].includes(c.key)) ws.getColumn(i + 1).numFmt = "@";
  });
  const p = wb.addWorksheet("Petunjuk");
  p.columns = [{ header: "Kolom", width: 26 }, { header: "Wajib", width: 8 }, { header: "Contoh", width: 30 }, { header: "Keterangan", width: 80 }];
  p.getRow(1).font = { bold: true };
  for (const c of spec.cols) p.addRow([c.header, c.required ? "Ya" : "", c.example, c.help]);
  p.addRow([]);
  p.addRow(["Catatan", "", "", `${spec.title}: ${spec.desc}`]);
  p.addRow(["", "", "", "Isi data mulai baris ke-2 lembar \"Data\". Judul kolom boleh tidak berurutan; kolom berwarna kuning wajib diisi. Simpan sebagai .xlsx."]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
