import { beforeAll, describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { assets, rooms, stockBalances, supplyItems, userRoles, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { readImportFile } from "@/lib/server/impor/read";
import { applyRows, validateRows } from "@/lib/server/impor/process";
import { buildTemplate } from "@/lib/server/impor/template";
import type { ImportKind } from "@/lib/server/impor/spec";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string, sess: SchoolSession;
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
async function xlsx(rows: (string | number | Date)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  rows.forEach((r) => ws.addRow(r));
  return new File([await wb.xlsx.writeBuffer()], "data.xlsx");
}
async function run(kind: ImportKind, file: File) {
  const rows = await readImportFile(kind, file);
  const v = await tx((t) => validateRows(t, kind, rows));
  return { v, res: await tx((t) => applyRows(t, sess, kind, v)) };
}

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    const [u] = await t.select().from(users);
    sess = { userId: u.id, userName: u.name, schoolId: S, npsn: "", roles: ["ADMIN"], mustChangePassword: false };
  });
});

describe("impor Excel", () => {
  test("template bisa dibaca kembali (judul cocok, tanpa baris data)", async () => {
    const buf = await buildTemplate("aset");
    await expect(readImportFile("aset", new File([buf], "t.xlsx"))).rejects.toThrow("Tidak ada baris data");
  }, 20_000);

  test("ruangan: gedung & unit dibuat otomatis; nama ganda ditolak", async () => {
    const f = await xlsx([["Nama Ruangan", "Gedung", "Unit", "Penanggung Jawab", "NIP Penanggung Jawab"], ["Lab Komputer 1", "Gedung B", "TKJ", "Andi", "198804042011011004"], ["Kelas X-1", "Gedung A", "", "", ""], ["lab komputer 1", "", "", "", ""]]);
    const { v, res } = await run("ruangan", f);
    expect(v.map((r) => r.errors.length)).toEqual([0, 0, 1]);
    expect(res.created).toBe(2);
    expect((await tx((t) => t.select().from(rooms))).length).toBe(2);
  });

  test("pengguna: peran dari nama, password otomatis hanya dikembalikan sekali", async () => {
    const f = await xlsx([["Nama Lengkap", "Username", "Peran", "Unit"], ["Budi", "budi", "Pengusul, Peminjam", "TKJ"], ["Sari", "sari", "Kepala Sekolah", ""], ["Joko", "j", "Dewa", ""]]);
    const { v, res } = await run("pengguna", f);
    expect(v[2].errors.join()).toContain("Username");
    expect(v[2].errors.join()).toContain("Peran tidak dikenal");
    expect(res.created).toBe(2);
    expect(res.passwords!.map((p) => p.username)).toEqual(["budi", "sari"]);
    const [b] = await tx((t) => t.select().from(users).where(eq(users.username, "budi")));
    expect(b.mustChangePassword).toBe(true);
    expect((await tx((t) => t.select().from(userRoles).where(eq(userRoles.userId, b.id)))).map((r) => r.role).sort()).toEqual(["PEMINJAM", "PENGUSUL"]);
  });

  test("aset: rentang register, tahun saja, kondisi singkat, register bentrok ditolak", async () => {
    const f = await xlsx([
      ["Kode Barang", "Jenis Barang", "Merk/Type", "Tahun Pembelian", "Harga", "Jumlah", "No. Register", "Ruangan", "Kondisi", "Asal-usul"],
      ["1.3.2.10.01.02.001", "PC lab", "Lenovo", "2019", "9.850.000", "24", "000021 s/d 000044", "Lab Komputer 1", "B", "Pembelian"],
      ["1.3.2.05.02.01.034", "Bangku siswa", "", new Date(Date.UTC(2020, 6, 1)), 450000, 3, "", "Kelas X-1", "RR", "Hibah"],
      ["1.3.2.10.01.02.001", "PC lab lama", "", "2018", "5000000", "2", "000043", "Lab Komputer 1", "", ""],
      ["1.1.7.01.03.02.001", "Kertas", "", "2020", "50000", "1", "", "", "", ""],
      ["1.3.2.05.02.01.034", "Kursi", "", "2099", "1", "1", "", "Gudang", "Hancur", ""],
    ]);
    const { v, res } = await run("aset", f);
    expect(v.map((r) => r.errors.length > 0)).toEqual([false, false, true, true, true]);
    expect(v[2].errors.join()).toContain("000043");
    expect(v[4].errors.length).toBeGreaterThanOrEqual(3);
    expect(res.created).toBe(27);
    const pcs = await tx((t) => t.select().from(assets).where(eq(assets.bmdCode, "1.3.2.10.01.02.001")));
    expect([Math.min(...pcs.map((a) => a.regNo)), Math.max(...pcs.map((a) => a.regNo)), pcs[0].isIntra, pcs[0].acqDate]).toEqual([21, 44, true, "2019-01-01"]);
    const kursi = await tx((t) => t.select().from(assets).where(eq(assets.bmdCode, "1.3.2.05.02.01.034")));
    expect([kursi.length, kursi[0].condition, kursi[0].acquisition, kursi[0].isIntra, kursi[0].acqDate]).toEqual([3, "RUSAK_RINGAN", "HIBAH", false, "2020-07-01"]);
  });

  test("persediaan: barang + saldo awal diposting; CSV titik-koma", async () => {
    const csv = "Kode Barang;Nama Barang;Satuan;Jumlah Saldo Awal;Harga Satuan;Tanggal Saldo Awal\n1.1.7.01.03.02.001;Kertas HVS A4;Rim;20;52.000;01/07/2026\n1.1.7.01.03.01.001;Spidol hitam;Batang Spidol;48;9500;01/07/2026\n1.1.7.01.03.02.001;Kertas F4;Rim;5;;\n";
    const { v, res } = await run("persediaan", new File([csv], "p.csv"));
    expect(v.map((r) => r.errors.length > 0)).toEqual([false, false, true]);
    expect(res.created).toBe(2);
    expect(res.detail.join()).toContain("SA/2026/");
    const items = await tx((t) => t.select().from(supplyItems));
    const bal = await tx((t) => t.select().from(stockBalances));
    expect([items.length, bal.length, bal.find((b) => b.itemId === items.find((i) => i.name === "Kertas HVS A4")!.id)!.value]).toEqual([2, 2, "1040000.00"]);
  });

  test("kolom wajib hilang → pesan jelas", async () => {
    const f = await xlsx([["Nama", "Merk"], ["x", "y"]]);
    await expect(readImportFile("aset", f)).rejects.toThrow("Kolom wajib tidak ditemukan");
  });
});
