import { beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { assetInventoryLines, assets, disposalLines, rooms, stockBalances, stockOpnameLines, stockDocs, uoms, userRoles, users, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { createAssets, moveAssets, type NewAssetsInput } from "@/lib/server/assets";
import { postDoc, todayWita } from "@/lib/server/ledger";
import { createSupplyItem, saveDraftDoc, type DocInput } from "@/lib/server/supply";
import { addOpnameItem, approveOpname, saveCounts, startOpname, submitOpname } from "@/lib/server/opname";
import { finishInventory, saveChecks, startInventory } from "@/lib/server/inventory";
import { actOnDisposal, saveDisposalDraft } from "@/lib/server/disposal";
import { finishMaintenance, recordMaintenance } from "@/lib/server/maintenance";
import { createLoan } from "@/lib/server/loans";
import { UserError } from "@/lib/server/errors";
import type { Role } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string, G: string, R1: string, hvs: string, tinta: string, map: string;
const who: Record<string, SchoolSession> = {};
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : String(e)));
const post = (d: Omit<DocInput, "warehouseId">) => tx(async (t) => { const id = await saveDraftDoc(t, S, who.petugas.userId, { warehouseId: G, ...d }); return postDoc(t, S, who.petugas.userId, id); });
const bal = (itemId: string) => tx(async (t) => (await t.select().from(stockBalances).where(and(eq(stockBalances.itemId, itemId), eq(stockBalances.warehouseId, G))))[0]);
const asset = (id: string) => tx(async (t) => (await t.select().from(assets).where(eq(assets.id, id)))[0]);
const newAssets = (o: Partial<NewAssetsInput>) => tx((t) => createAssets(t, who.petugas, {
  bmdCode: "1.3.2.10.01.02.002", name: "Laptop", brand: null, attrs: {}, acqDate: "2026-01-10", acqPrice: "7000000", acquisition: "PEMBELIAN",
  fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: null, roomId: R1, unitId: null, condition: "BAIK", note: null, qty: 1, startRegNo: null, ...o,
}));

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    for (const [u, roles] of [["petugas", ["PETUGAS"]], ["kepsek", ["KEPSEK"]]] as [string, Role[]][]) {
      const [row] = await t.insert(users).values({ schoolId: S, username: u, name: u.toUpperCase(), passwordHash: "x" }).returning();
      for (const role of roles) await t.insert(userRoles).values({ schoolId: S, userId: row.id, role });
      who[u] = { userId: row.id, userName: row.name, schoolId: S, npsn: "", roles, mustChangePassword: false };
    }
    G = (await t.select().from(warehouses))[0].id;
    [{ id: R1 }] = await t.insert(rooms).values({ schoolId: S, name: "Lab" }).returning();
    const u = (await t.select().from(uoms).where(eq(uoms.name, "Buah")))[0].id;
    hvs = (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.02.001", name: "HVS", spec: null, uomId: u, minStock: "0" })).id;
    tinta = (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.06.004", name: "Tinta", spec: null, uomId: u, minStock: "0" })).id;
    map = (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.01.006", name: "Map", spec: null, uomId: u, minStock: "0" })).id;
  });
  await post({ kind: "SALDO_AWAL", date: "2026-01-02", lines: [{ itemId: hvs, qty: "10", unitPrice: "50000" }, { itemId: tinta, qty: "5", unitPrice: "90000" }] });
});

describe("stock opname", () => {
  test("gudang dibekukan; selisih & rusak dibukukan saat disetujui Kepala Sekolah", async () => {
    const o = await tx((t) => startOpname(t, who.petugas, G, null));
    expect(await err(tx((t) => startOpname(t, who.petugas, G, null)))).toContain("sedang dalam stock opname");
    expect(await err(post({ kind: "PENERIMAAN", date: "2026-01-03", lines: [{ itemId: hvs, qty: "1", unitPrice: "1" }] }))).toContain("stock opname");
    await tx((t) => addOpnameItem(t, who.petugas, o.id, map)); // ditemukan fisik, saldo sistem 0
    const lines = await tx((t) => t.select().from(stockOpnameLines).where(eq(stockOpnameLines.opnameId, o.id)));
    const L = (id: string) => lines.find((l) => l.itemId === id)!.id;
    expect(await err(tx((t) => submitOpname(t, who.petugas, o.id)))).toContain("Isi jumlah fisik");
    await tx((t) => saveCounts(t, who.petugas, o.id, [
      { lineId: L(hvs), physicalQty: "7", damagedQty: "1" },  // sistem 10 → kurang 2, rusak 1
      { lineId: L(tinta), physicalQty: "6" },                  // sistem 5 → lebih 1 @ harga lot terakhir
      { lineId: L(map), physicalQty: "3", surplusPrice: "2.500" }, // lebih 3 @ 2.500
    ]));
    await tx((t) => submitOpname(t, who.petugas, o.id));
    expect(await err(tx((t) => approveOpname(t, who.petugas, o.id)))).toContain("Kepala Sekolah");
    const docs = await tx((t) => approveOpname(t, who.kepsek, o.id));
    expect(docs.length).toBe(3);
    expect((await bal(hvs)).qty).toBe("7.00");
    expect((await bal(tinta)).qty).toBe("6.00");
    expect([(await bal(map)).qty, (await bal(map)).value]).toEqual(["3.00", "7500.00"]);
    const ru = await tx((t) => t.select().from(stockDocs).where(and(eq(stockDocs.opnameId, o.id), eq(stockDocs.kind, "RUSAK_USANG"))));
    expect(ru.length).toBe(1);
    // gudang dibuka kembali
    expect(await err(post({ kind: "PENERIMAAN", date: todayWita(), lines: [{ itemId: hvs, qty: "1", unitPrice: "50000" }] }))).toBe("ok");
  });
});

describe("inventarisasi aset", () => {
  test("tidak ditemukan → HILANG; kondisi berubah; barang belum tercatat dicatat", async () => {
    const r = await newAssets({ qty: 3 });
    const inv = await tx((t) => startInventory(t, who.petugas, R1, null));
    const lines = await tx((t) => t.select().from(assetInventoryLines));
    const byAsset = (id: string) => lines.find((l) => l.assetId === id)!.id;
    expect(await err(tx((t) => finishInventory(t, who.petugas, inv.id)))).toContain("Periksa semua");
    await tx((t) => saveChecks(t, who.petugas, inv.id, [
      { lineId: byAsset(r.ids[0]), found: true, condition: "BAIK" },
      { lineId: byAsset(r.ids[1]), found: true, condition: "RUSAK_BERAT", note: "layar pecah" },
      { lineId: byAsset(r.ids[2]), found: false, note: "tidak ada di lab" },
    ], [{ name: "Printer tanpa label", qty: 1 }]));
    const sum = await tx((t) => finishInventory(t, who.petugas, inv.id));
    expect(sum).toEqual({ checked: 3, missing: 1, changed: 1, recovered: 0, extras: 1 });
    expect((await asset(r.ids[1])).condition).toBe("RUSAK_BERAT");
    expect((await asset(r.ids[2])).status).toBe("HILANG");
  });
});

describe("usulan penghapusan", () => {
  test("draf → ajukan (Kepsek) → kirim → SK sebagian → dihapus / dipulihkan", async () => {
    const r = await newAssets({ qty: 3, name: "Laptop lama" });
    const id = await tx((t) => saveDisposalDraft(t, who.petugas, { date: "2026-10-01", note: null, lines: [
      { assetId: r.ids[0], reason: "RUSAK_BERAT" },
      { assetId: r.ids[1], reason: "KECURIAN" },
      { assetId: r.ids[2], reason: "USANG" },
    ] }));
    expect(await err(tx((t) => actOnDisposal(t, who.petugas, id, { action: "AJUKAN" })))).toContain("Kepala Sekolah");
    expect(await err(tx((t) => actOnDisposal(t, who.kepsek, id, { action: "AJUKAN" })))).toContain("kepolisian");
    await tx((t) => saveDisposalDraft(t, who.petugas, { id, date: "2026-10-01", note: null, lines: [
      { assetId: r.ids[0], reason: "RUSAK_BERAT" },
      { assetId: r.ids[1], reason: "KECURIAN", policeLetter: "STPL/123/X/2026" },
      { assetId: r.ids[2], reason: "USANG" },
    ] }));
    const no = await tx((t) => actOnDisposal(t, who.kepsek, id, { action: "AJUKAN" }));
    expect(no).toMatch(/^UPH\//);
    expect((await asset(r.ids[0])).status).toBe("DIUSULKAN_HAPUS");
    expect(await err(tx((t) => moveAssets(t, who.petugas, [r.ids[0]], R1, "2026-10-02", null)))).toContain("diusulkan penghapusan");
    expect(await err(tx((t) => createLoan(t, who.petugas, { borrowerUserId: null, borrowerName: "Andi", borrowerInfo: null, purpose: null, dueAt: new Date(Date.now() + 3600_000), assetIds: [r.ids[0]] }, true)))).toContain("tidak tersedia");
    expect(await err(tx((t) => actOnDisposal(t, who.petugas, id, { action: "SK", skNumber: "x", skDate: "2026-10-05" })))).toContain("setelah usulan dikirim");
    await tx((t) => actOnDisposal(t, who.petugas, id, { action: "KIRIM", letterNumber: "421/123/SMKN2", letterDate: "2026-10-03" }));
    const dl = await tx((t) => t.select().from(disposalLines));
    const lineOf = (aid: string) => dl.find((l) => l.assetId === aid)!.id;
    await tx((t) => actOnDisposal(t, who.petugas, id, { action: "SK", skNumber: "188.45/77/2026", skDate: "2026-10-05", approvedLineIds: [lineOf(r.ids[0]), lineOf(r.ids[1])] }));
    expect((await asset(r.ids[0])).status).toBe("DIHAPUS");
    expect((await asset(r.ids[1])).status).toBe("DIHAPUS");
    expect((await asset(r.ids[2])).status).toBe("DIGUNAKAN"); // tidak termasuk SK → dipulihkan
  });
});

describe("pemeliharaan", () => {
  test("berjalan → aset dalam pemeliharaan (tidak bisa dipinjam) → selesai, kondisi membaik", async () => {
    const r = await newAssets({ name: "Proyektor", bmdCode: "1.3.2.05.01.05.043", condition: "RUSAK_RINGAN" });
    const id = await tx((t) => recordMaintenance(t, who.petugas, { assetId: r.ids[0], kind: "PERBAIKAN", startDate: "2026-10-01", executor: "Toko Elektronik", description: "Ganti lampu proyektor", cost: "850.000", fundingSourceId: null, fundingComponentId: null }));
    expect((await asset(r.ids[0])).status).toBe("DALAM_PEMELIHARAAN");
    expect(await err(tx((t) => createLoan(t, who.petugas, { borrowerUserId: null, borrowerName: "Andi", borrowerInfo: null, purpose: null, dueAt: new Date(Date.now() + 3600_000), assetIds: [r.ids[0]] }, true)))).toContain("tidak tersedia");
    await tx((t) => finishMaintenance(t, who.petugas, id, { endDate: "2026-10-03", conditionAfter: "BAIK" }));
    const a = await asset(r.ids[0]);
    expect([a.status, a.condition]).toEqual(["DIGUNAKAN", "BAIK"]);
  });
});
