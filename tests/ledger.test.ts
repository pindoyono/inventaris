import { beforeAll, describe, expect, test } from "bun:test";
import { and, asc, eq, sql } from "drizzle-orm";
import { schoolSettings, stockBalances, stockDocs, stockLots, stockMovements, uoms, users, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { cancelDoc, postDoc, StockError } from "@/lib/server/ledger";
import { createSupplyItem, saveDraftDoc, type DocInput } from "@/lib/server/supply";
import { pgCode } from "@/lib/server/activity";
import { parseDec, toDec } from "@/lib/decimal";
import { makeSchool, resetTestData } from "./helpers";

let S: string; // sekolah
let U: string; // pengguna
let G1: string; // gudang utama
let G2: string; // gudang kedua
let uomRim: string;

const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const item = (name: string, code = "1.1.7.01.03.02.001") => tx((t) => createSupplyItem(t, S, { bmdCode: code, name, spec: null, uomId: uomRim, minStock: "0" }));
async function post(kind: DocInput["kind"], date: string, lines: DocInput["lines"], extra: Partial<DocInput> = {}) {
  return tx(async (t) => {
    const id = await saveDraftDoc(t, S, U, { kind, date, warehouseId: G1, lines, ...extra });
    return { id, number: await postDoc(t, S, U, id) };
  });
}
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof StockError ? e.message : `pg:${pgCode(e)}`));

async function balance(itemId: string, wh = G1) {
  return tx(async (t) => {
    const [b] = await t.select().from(stockBalances).where(and(eq(stockBalances.itemId, itemId), eq(stockBalances.warehouseId, wh)));
    return b ? { qty: b.qty, value: b.value } : { qty: "0.00", value: "0.00" };
  });
}

/** Invarian: saldo = Σ buku besar = Σ sisa lot (qty & nilai) untuk setiap barang × gudang */
async function checkInvariants() {
  await tx(async (t) => {
    const bal = await t.select().from(stockBalances);
    for (const b of bal) {
      const [m] = await t
        .select({ q: sql<string>`coalesce(sum(qty_in - qty_out),0)`, v: sql<string>`coalesce(sum(case when qty_in > 0 then value else -value end),0)` })
        .from(stockMovements)
        .where(and(eq(stockMovements.itemId, b.itemId), eq(stockMovements.warehouseId, b.warehouseId)));
      const [l] = await t
        .select({ q: sql<string>`coalesce(sum(qty_left),0)` })
        .from(stockLots)
        .where(and(eq(stockLots.itemId, b.itemId), eq(stockLots.warehouseId, b.warehouseId)));
      expect(parseDec(m.q)).toBe(parseDec(b.qty));
      expect(parseDec(m.v)).toBe(parseDec(b.value));
      expect(parseDec(l.q)).toBe(parseDec(b.qty));
      // saldo pada baris buku besar terakhir = saldo tersimpan
      const [last] = await t
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.itemId, b.itemId), eq(stockMovements.warehouseId, b.warehouseId)))
        .orderBy(sql`id desc`)
        .limit(1);
      if (last) expect([last.balanceQty, last.balanceValue]).toEqual([b.qty, b.value]);
    }
  });
}

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    U = (await t.select().from(users))[0].id;
    G1 = (await t.select().from(warehouses))[0].id;
    [{ id: G2 }] = await t.insert(warehouses).values({ schoolId: S, name: "Gudang Lab" }).returning();
    uomRim = (await t.select().from(uoms).where(eq(uoms.name, "Rim")))[0].id;
  });
});

describe("barang persediaan (NUSP)", () => {
  test("nomor urut spesifikasi bertambah per kode barang", async () => {
    const a = await item("Kertas HVS A4 70 gram");
    const b = await item("Kertas HVS F4 70 gram");
    expect(a.nusp).toBe("1.1.7.01.03.02.001.0001");
    expect(b.nusp).toBe("1.1.7.01.03.02.001.0002");
  });
  test("nama barang ganda ditolak (tanpa beda huruf besar/kecil)", async () => {
    expect(await err(item("kertas hvs a4 70 GRAM"))).toContain("sudah ada");
  });
  test("kode aset (bukan persediaan) ditolak", async () => {
    expect(await err(item("Laptop", "1.3.2.10.01.02.002"))).toContain("persediaan");
  });
});

describe("FIFO seperti contoh Kartu Barang Persediaan", () => {
  let hvs: string;
  beforeAll(async () => {
    hvs = (await item("Kertas HVS uji FIFO")).id;
  });

  test("saldo awal → penerimaan → dua penyaluran mengambil lot tertua", async () => {
    const sa = await post("SALDO_AWAL", "2026-01-01", [{ itemId: hvs, qty: "8", unitPrice: "50000" }]);
    expect(sa.number).toBe("SA/2026/0001");
    await post("PENERIMAAN", "2026-01-05", [{ itemId: hvs, qty: "20", unitPrice: "52000" }]);
    expect(await balance(hvs)).toEqual({ qty: "28.00", value: "1440000.00" });

    await post("PENYALURAN", "2026-01-12", [{ itemId: hvs, qty: "5" }]);
    expect(await balance(hvs)).toEqual({ qty: "23.00", value: "1190000.00" });

    const out2 = await post("PENYALURAN", "2026-01-20", [{ itemId: hvs, qty: "7" }]);
    const rows = await tx((t) => t.select().from(stockMovements).where(eq(stockMovements.docId, out2.id)).orderBy(asc(stockMovements.id)));
    // 3 rim sisa saldo awal @50.000 lalu 4 rim penerimaan @52.000 = 358.000
    expect(rows.map((r) => [r.qtyOut, r.unitPrice, r.value])).toEqual([
      ["3.00", "50000.00", "150000.00"],
      ["4.00", "52000.00", "208000.00"],
    ]);
    expect(await balance(hvs)).toEqual({ qty: "16.00", value: "832000.00" });
    await checkInvariants();
  });

  test("stok kurang ditolak dan tidak ada yang tersimpan", async () => {
    expect(await err(post("PENYALURAN", "2026-01-21", [{ itemId: hvs, qty: "17" }]))).toContain("tidak cukup");
    expect(await balance(hvs)).toEqual({ qty: "16.00", value: "832000.00" });
    const drafts = await tx((t) => t.select().from(stockDocs).where(eq(stockDocs.status, "DRAF")));
    expect(drafts.length).toBe(0); // seluruh transaksi dibatalkan
  });

  test("tanggal lebih awal dari transaksi terakhir ditolak", async () => {
    expect(await err(post("PENERIMAAN", "2026-01-10", [{ itemId: hvs, qty: "1", unitPrice: "1" }]))).toContain("lebih awal");
  });

  test("tanggal masa depan ditolak", async () => {
    expect(await err(post("PENERIMAAN", "2099-01-01", [{ itemId: hvs, qty: "1", unitPrice: "1" }]))).toContain("masa depan");
  });

  test("periode yang sudah ditutup ditolak", async () => {
    await tx((t) => t.update(schoolSettings).set({ booksClosedUntil: "2026-01-31" }));
    expect(await err(post("PENERIMAAN", "2026-01-25", [{ itemId: hvs, qty: "1", unitPrice: "1" }]))).toContain("ditutup");
    await tx((t) => t.update(schoolSettings).set({ booksClosedUntil: null }));
  });

  test("mutasi antar gudang membawa harga & urutan FIFO lot asal", async () => {
    await post("MUTASI", "2026-02-01", [{ itemId: hvs, qty: "10" }], { toWarehouseId: G2 });
    expect(await balance(hvs, G1)).toEqual({ qty: "6.00", value: "312000.00" });
    expect(await balance(hvs, G2)).toEqual({ qty: "10.00", value: "520000.00" });
    const lots = await tx((t) => t.select().from(stockLots).where(eq(stockLots.warehouseId, G2)));
    expect(lots.map((l) => [l.receivedDate, l.unitPrice, l.qtyLeft])).toEqual([["2026-01-05", "52000.00", "10.00"]]);
    await checkInvariants();
  });
});

describe("pembatalan", () => {
  test("pengeluaran dibatalkan → stok kembali ke lot yang sama", async () => {
    const a = (await item("Map uji batal")).id;
    await post("SALDO_AWAL", "2026-03-01", [{ itemId: a, qty: "10", unitPrice: "1000" }]);
    const out = await post("PENYALURAN", "2026-03-02", [{ itemId: a, qty: "4" }]);
    await tx((t) => cancelDoc(t, S, U, out.id, "salah input"));
    expect(await balance(a)).toEqual({ qty: "10.00", value: "10000.00" });
    const [d] = await tx((t) => t.select().from(stockDocs).where(eq(stockDocs.id, out.id)));
    expect(d.status).toBe("DIBATALKAN");
    await checkInvariants();
  });

  test("penerimaan yang barangnya sudah keluar tidak bisa dibatalkan", async () => {
    const a = (await item("Tinta uji batal")).id;
    const inn = await post("PENERIMAAN", "2026-03-01", [{ itemId: a, qty: "5", unitPrice: "20000" }]);
    await post("PENYALURAN", "2026-03-03", [{ itemId: a, qty: "1" }]);
    expect(await err(tx((t) => cancelDoc(t, S, U, inn.id, "uji")))).toContain("sudah dikeluarkan");
  });
});

describe("pengaman database", () => {
  test("buku besar tidak bisa diubah atau dihapus", async () => {
    expect(await err(tx((t) => t.update(stockMovements).set({ description: "palsu" })))).toBe("pg:42501");
    expect(await err(tx((t) => t.delete(stockMovements)))).toBe("pg:42501");
  });
  test("saldo tidak bisa negatif walau diubah langsung", async () => {
    expect(await err(tx((t) => t.update(stockBalances).set({ qty: "-1" })))).toBe("pg:23514");
  });
});

describe("konkurensi", () => {
  test("dua penyaluran bersamaan tidak membuat stok minus", async () => {
    const a = (await item("Spidol uji konkurensi")).id;
    await post("SALDO_AWAL", "2026-04-01", [{ itemId: a, qty: "100", unitPrice: "5000" }]);
    const res = await Promise.allSettled(Array.from({ length: 4 }, () => post("PENYALURAN", "2026-04-02", [{ itemId: a, qty: "30" }])));
    expect(res.filter((r) => r.status === "fulfilled").length).toBe(3);
    expect(await balance(a)).toEqual({ qty: "10.00", value: "50000.00" });
    await checkInvariants();
  });

  test("nomor dokumen unik & berurutan walau bersamaan", async () => {
    const a = (await item("Amplop uji nomor")).id;
    const res = await Promise.all(Array.from({ length: 5 }, () => post("SALDO_AWAL", "2026-04-03", [{ itemId: a, qty: "1", unitPrice: "100" }])));
    const nums = res.map((r) => r.number).sort();
    expect(new Set(nums).size).toBe(5);
  });

  test("pembulatan pecahan habis tanpa sisa nilai", async () => {
    const a = (await item("Cairan uji pecahan")).id;
    await post("SALDO_AWAL", "2026-04-04", [{ itemId: a, qty: "3", unitPrice: "333.33" }]);
    for (const q of ["0.5", "0.5", "1.25", "0.75"]) await post("PENYALURAN", "2026-04-05", [{ itemId: a, qty: q }]);
    expect(await balance(a)).toEqual({ qty: "0.00", value: "0.00" });
    await checkInvariants();
  });
});

test("toDec/parseDec", () => {
  expect(toDec(parseDec("12.5"))).toBe("12.50");
  expect(toDec(parseDec("0.05"))).toBe("0.05");
});
