import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { rooms, uoms, users, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { createAssets, moveAssets, setCondition, type NewAssetsInput } from "@/lib/server/assets";
import { cancelDoc, postDoc } from "@/lib/server/ledger";
import { createSupplyItem, saveDraftDoc, type DocInput } from "@/lib/server/supply";
import { kibData, kirData, mutasiData } from "@/lib/server/reports";
import { compressRegNos } from "@/lib/assets-shared";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string, R1: string, R2: string, G1: string, G2: string, sess: SchoolSession, hvs: string;
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const asset = (o: Partial<NewAssetsInput>): NewAssetsInput => ({
  bmdCode: "1.3.2.05.02.01.034", name: "Bangku siswa", brand: null, attrs: {}, acqDate: "2026-01-10", acqPrice: "450000.00", acquisition: "PEMBELIAN",
  fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: null, roomId: R1, unitId: null, condition: "BAIK", note: null, qty: 1, startRegNo: null, ...o,
});
const post = (d: Omit<DocInput, "warehouseId"> & { warehouseId?: string }) =>
  tx(async (t) => { const id = await saveDraftDoc(t, S, sess.userId, { warehouseId: G1, ...d }); await postDoc(t, S, sess.userId, id); return id; });

test("compressRegNos", () => {
  expect(compressRegNos([5, 1, 2, 3, 7, 8])).toBe("000001 s/d 000003, 000005, 000007 s/d 000008");
});

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    const [u] = await t.select().from(users);
    sess = { userId: u.id, userName: u.name, schoolId: S, npsn: "", roles: ["ADMIN"], mustChangePassword: false };
    [{ id: R1 }, { id: R2 }] = await t.insert(rooms).values([{ schoolId: S, name: "Kelas X-1", picName: "Wali kelas" }, { schoolId: S, name: "Kelas X-2" }]).returning();
    G1 = (await t.select().from(warehouses))[0].id;
    [{ id: G2 }] = await t.insert(warehouses).values({ schoolId: S, name: "Gudang Lab" }).returning();
    const rim = (await t.select().from(uoms).where(eq(uoms.name, "Rim")))[0].id;
    hvs = (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.02.001", name: "HVS", spec: null, uomId: rim, minStock: "0" })).id;
  });
});

describe("KIR per tanggal", () => {
  test("isi & kondisi ruangan direkonstruksi dari riwayat", async () => {
    const r = await tx((t) => createAssets(t, sess, asset({ qty: 30 })));
    await tx((t) => createAssets(t, sess, asset({ bmdCode: "1.3.2.05.01.05.043", name: "Proyektor", brand: "Epson", acqPrice: "6250000", acqDate: "2025-08-01" })));
    await tx((t) => moveAssets(t, sess, r.ids.slice(0, 5), R2, "2026-07-15", null));
    await tx((t) => setCondition(t, sess, r.ids.slice(5, 7), "RUSAK_RINGAN", "2026-08-01", null));

    const sem1 = await tx((t) => kirData(t, R1, "2026-06-30"));
    const bangku1 = sem1!.rows.find((x) => x.name === "Bangku siswa")!;
    expect([bangku1.qty, bangku1.regNos, bangku1.baik, bangku1.rr, bangku1.ekstra]).toEqual([30, "000001 s/d 000030", 30, 0, 30]);
    expect(sem1!.rows.find((x) => x.name === "Proyektor")!.total).toBe(625_000_000n);

    const now = await tx((t) => kirData(t, R1, "2026-12-31"));
    const bangku2 = now!.rows.find((x) => x.name === "Bangku siswa")!;
    expect([bangku2.qty, bangku2.regNos, bangku2.baik, bangku2.rr]).toEqual([25, "000006 s/d 000030", 23, 2]);
    expect((await tx((t) => kirData(t, R2, "2026-12-31")))!.rows[0].regNos).toBe("000001 s/d 000005");
    // sebelum diperoleh: kosong
    expect((await tx((t) => kirData(t, R1, "2025-01-01")))!.rows.length).toBe(0);
  });
});

describe("KIB", () => {
  test("unit bernomor seri berbeda tidak digabung; ekstrakomptabel bisa disertakan", async () => {
    await tx((t) => createAssets(t, sess, asset({ bmdCode: "1.3.2.10.01.02.002", name: "Laptop", acqPrice: "8000000", attrs: { noPabrik: "SN-1" } })));
    await tx((t) => createAssets(t, sess, asset({ bmdCode: "1.3.2.10.01.02.002", name: "Laptop", acqPrice: "8000000", attrs: { noPabrik: "SN-2" } })));
    const intra = await tx((t) => kibData(t, "B", false));
    expect(intra.rows.filter((x) => x.name === "Laptop").length).toBe(2);
    expect(intra.rows.some((x) => x.name === "Bangku siswa")).toBe(false);
    const all = await tx((t) => kibData(t, "B", true));
    expect(all.rows.find((x) => x.name === "Bangku siswa")!.qty).toBe(30);
  });
});

describe("mutasi persediaan", () => {
  test("saldo awal/masuk/keluar/akhir; pembatalan netral; mutasi gudang internal", async () => {
    await post({ kind: "SALDO_AWAL", date: "2026-01-02", lines: [{ itemId: hvs, qty: "10", unitPrice: "50000" }] });
    await post({ kind: "PENERIMAAN", date: "2026-07-05", lines: [{ itemId: hvs, qty: "20", unitPrice: "52000" }] });
    const wrong = await post({ kind: "PENERIMAAN", date: "2026-07-06", lines: [{ itemId: hvs, qty: "3", unitPrice: "1000" }] });
    await post({ kind: "PENYALURAN", date: "2026-07-10", lines: [{ itemId: hvs, qty: "12" }] });
    await post({ kind: "MUTASI", date: "2026-07-11", toWarehouseId: G2, lines: [{ itemId: hvs, qty: "5" }] });
    await tx((t) => cancelDoc(t, S, sess.userId, wrong, "salah input")); // pembalik bertanggal hari ini (dalam periode)

    const all = await tx((t) => mutasiData(t, "2026-07-01", "2026-12-31", null));
    const r = all.rows.find((x) => x.itemId === hvs)!;
    expect([r.openQ, r.openV, r.inQ, r.inV, r.outQ, r.outV, r.closeQ, r.closeV]).toEqual([
      1000n, 50_000_000n, 2000n, 104_000_000n, 1200n, 60_400_000n, 1800n, 50_000_000n + 104_000_000n - 60_400_000n,
    ]);
    const g2 = await tx((t) => mutasiData(t, "2026-07-01", "2026-12-31", G2));
    expect(g2.rows.find((x) => x.itemId === hvs)!.inQ).toBe(500n); // mutasi masuk dihitung di gudang tujuan
  });
});
