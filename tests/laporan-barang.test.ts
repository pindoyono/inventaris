import { beforeAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { assets, rooms, transfers, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { createAssets } from "@/lib/server/assets";
import { correctAsset, reclassifyAsset } from "@/lib/server/asset-changes";
import { addConstructionPayment, createConstruction, finishConstruction } from "@/lib/server/construction";
import { recordMaintenance } from "@/lib/server/maintenance";
import { actOnDisposal, saveDisposalDraft } from "@/lib/server/disposal";
import { CAUSE, depreciationAt, loadTimelines, movements } from "@/lib/server/bmd-ledger";
import { cancelTransfer, createTransfer, handOverTransfer, receiveTransfer, rejectTransfer, transferDestinations } from "@/lib/server/transfers";
import { semIndex } from "@/lib/depreciation-shared";
import { UserError } from "@/lib/server/errors";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, owner, resetTestData } from "./helpers";

let A: string, B: string, sa: SchoolSession, sb: SchoolSession, kepsekA: SchoolSession, roomB: string;
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : String(e)));
const sess = async (school: string): Promise<SchoolSession> => {
  const [u] = await withSchool(school, (t) => t.select().from(users));
  return { userId: u.id, userName: u.name, schoolId: school, npsn: "", roles: ["ADMIN"], mustChangePassword: false };
};
const asset = (s: SchoolSession, over: Partial<Parameters<typeof createAssets>[2]> = {}) =>
  withSchool(s.schoolId, (t) =>
    createAssets(t, s, {
      bmdCode: "1.3.2.10.01.02.001", name: "Laptop", brand: null, attrs: {}, acqDate: "2024-03-10", acqPrice: "12000000", acquisition: "PEMBELIAN",
      fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: null, roomId: null, unitId: null, condition: "BAIK", note: null, qty: 1, startRegNo: null, ...over,
    }),
  ).then((r) => r.ids[0]);
const moves = (school: string, from: string, to: string) => withSchool(school, async (t) => movements(await loadTimelines(t, school), from, to));
const row = (rs: Awaited<ReturnType<typeof moves>>, code: string, intra = true) => rs.find((r) => r.code === code && r.intra === intra)!;

beforeAll(async () => {
  await resetTestData();
  A = (await makeSchool({ name: "SMA Negeri A" })).schoolId;
  B = (await makeSchool({ name: "SMA Negeri B" })).schoolId;
  await owner`update schools set status = 'ACTIVE'`;
  sa = await sess(A);
  sb = await sess(B);
  kepsekA = { ...sa, roles: ["KEPSEK"] };
  [{ id: roomB }] = await withSchool(B, (t) => t.insert(rooms).values({ schoolId: B, name: "Lab B" }).returning());
});

describe("laporan mutasi aset tetap", () => {
  test("saldo awal + tambah − kurang = saldo akhir, dengan sebab yang benar", async () => {
    const laptop = await asset(sa); // 2024, komputer
    const kursi = await asset(sa, { bmdCode: "1.3.2.05.02.01.034", name: "Kursi", acqPrice: "500000", qty: 1 }); // ekstra
    const lemari = await asset(sa, { bmdCode: "1.3.2.05.01.04.001", name: "Lemari", acqDate: "2026-02-01", acqPrice: "3000000" });
    // semester I 2026: kapitalisasi laptop, koreksi kursi, reklasifikasi kursi → intra, KDP selesai
    await withSchool(A, (t) => recordMaintenance(t, sa, { assetId: laptop, kind: "PENINGKATAN", startDate: "2026-03-01", executor: null, description: "Tambah RAM", cost: "2000000", fundingSourceId: null, fundingComponentId: null, finish: { endDate: "2026-03-01", conditionAfter: "BAIK" }, capitalize: true }));
    await withSchool(A, (t) => correctAsset(t, sa, { assetId: kursi, date: "2026-03-05", acqPrice: "450000.00", acqDate: null, acquisition: null, reason: "salah ketik", docNo: null }));
    await withSchool(A, (t) => reclassifyAsset(t, sa, { assetId: kursi, date: "2026-04-01", bmdCode: "1.3.2.05.02.01.034", intra: "intra", reason: "kebijakan baru", docNo: null }));
    const kdp = await withSchool(A, (t) => createConstruction(t, sa, { kind: "KDP", bmdCode: "1.3.6.01.01.01.003", name: "RKB", attrs: {}, ownerName: null, contractNo: null, contractDate: null, vendorId: null, contractValue: "0", startDate: "2025-11-01", targetDate: null, fundingSourceId: null, fundingComponentId: null, note: null }));
    await withSchool(A, (t) => addConstructionPayment(t, sa, kdp.id, { date: "2025-12-01", amount: "100000000", docNo: null, note: null }));
    await withSchool(A, (t) => addConstructionPayment(t, sa, kdp.id, { date: "2026-02-01", amount: "50000000", docNo: null, note: null }));
    await withSchool(A, (t) => finishConstruction(t, sa, kdp.id, { date: "2026-05-02", bastNo: "BAST-1", bmdCode: "1.3.3.01.01.01.001", name: null, roomId: null }));
    // penghapusan lemari (SK Juni)
    await withSchool(A, (t) => t.update(assets).set({ condition: "RUSAK_BERAT" }).where(eq(assets.id, lemari)));
    const d = await withSchool(A, (t) => saveDisposalDraft(t, sa, { date: "2026-06-01", note: null, lines: [{ assetId: lemari, reason: "RUSAK_BERAT" }] }));
    await withSchool(A, (t) => actOnDisposal(t, kepsekA, d, { action: "AJUKAN" }));
    await withSchool(A, (t) => actOnDisposal(t, sa, d, { action: "KIRIM", letterNumber: "S-1", letterDate: "2026-06-02" }));
    await withSchool(A, (t) => actOnDisposal(t, sa, d, { action: "SK", skNumber: "SK-9", skDate: "2026-06-20" }));

    const rs = await moves(A, "2026-01-01", "2026-06-30");
    for (const r of rs) {
      expect({ code: r.code, n: r.open.n + r.addT.n - r.subT.n, v: r.open.v + r.addT.v - r.subT.v }).toEqual({ code: r.code, n: r.close.n, v: r.close.v });
    }
    const komputer = row(rs, "1.3.2.10");
    expect([komputer.open.n, komputer.open.v, komputer.add[CAUSE.KAPITALISASI].v, komputer.close.v]).toEqual([1, 1_200_000_000n, 200_000_000n, 1_400_000_000n]);
    const alatKantorIntra = row(rs, "1.3.2.05");
    expect(alatKantorIntra.add[CAUSE.PEMBELIAN].n).toBe(1); // lemari Feb 2026
    expect(alatKantorIntra.add[CAUSE.RECLASS_IN]).toEqual({ n: 1, v: 45_000_000n });
    expect(alatKantorIntra.sub[CAUSE.HAPUS]).toEqual({ n: 1, v: 300_000_000n });
    const ekstra = row(rs, "1.3.2.05", false);
    expect([ekstra.open.v, ekstra.sub[CAUSE.KOREKSI_KURANG].v, ekstra.sub[CAUSE.RECLASS_OUT].v, ekstra.close.n]).toEqual([50_000_000n, 5_000_000n, 45_000_000n, 0]);
    const f = row(rs, "1.3.6.01");
    expect([f.open.v, f.add[CAUSE.PEMBAYARAN_KDP].v, f.sub[CAUSE.RECLASS_OUT].v, f.close.n]).toEqual([10_000_000_000n, 5_000_000_000n, 15_000_000_000n, 0]);
    expect(row(rs, "1.3.3.01").close).toEqual({ n: 1, v: 15_000_000_000n });
    // semester sebelumnya tidak terpengaruh transaksi sesudahnya
    const prev = await moves(A, "2025-07-01", "2025-12-31");
    expect(row(prev, "1.3.6.01").close.v).toBe(10_000_000_000n);
    expect(row(prev, "1.3.2.10").close.v).toBe(1_200_000_000n);
  });

  test("penyusutan garis lurus per semester; kapitalisasi prospektif; ekstra & KDP tidak disusutkan", async () => {
    const tl = await withSchool(A, (t) => loadTimelines(t, A));
    const byName = async (name: string) => {
      const [a] = await withSchool(A, (t) => t.select().from(assets).where(eq(assets.name, name)));
      return tl.find((x) => x.id === a.id)!;
    };
    const laptop = await byName("Laptop");
    // 12 jt, 4 tahun = 8 semester mulai sem I 2024; akhir 2025 = 4 semester → 6 jt
    expect(depreciationAt(laptop, semIndex("2025-12-31"), {})!.acc).toBe(600_000_000n);
    // sem I 2026: base 12 jt 5/8 = 7,5 jt + kapitalisasi 2 jt atas sisa 4 semester, 1/4 = 0,5 jt
    expect(depreciationAt(laptop, semIndex("2026-06-30"), {})!.acc).toBe(800_000_000n);
    // masa manfaat ditimpa Perkada: komputer 5 tahun
    expect(depreciationAt(laptop, semIndex("2025-12-31"), { "1.3.2.10": 5 })!.acc).toBe(480_000_000n);
    // lunas pada akhir masa manfaat
    expect(depreciationAt(laptop, semIndex("2030-12-31"), {})!.acc).toBe(1_400_000_000n);
    const gedung = await byName("RKB");
    expect(depreciationAt(gedung, semIndex("2025-12-31"), {})!.depreciable).toBe(false); // masih KDP
    // gedung 50 tahun mulai sem I 2026 (BAST Mei): 150 jt / 100 semester
    expect(depreciationAt(gedung, semIndex("2026-06-30"), {})!.acc).toBe(150_000_000n);
  });
});

describe("pengeluaran & penerimaan internal", () => {
  test("serahkan ke sekolah lain → keluar dari A, diterima B dengan nilai & tahun asal", async () => {
    expect((await transferDestinations(A)).map((d) => d.id)).toContain(B);
    const proj = await asset(sa, { bmdCode: "1.3.2.06.01.04.001", name: "Proyektor", acqDate: "2023-08-01", acqPrice: "7000000" });
    const id = await withSchool(A, (t) => createTransfer(t, sa, { toSchoolId: B, toName: null, date: "2026-07-01", reason: "Kebutuhan sekolah B", approvalNo: null, approvalDate: null, assetIds: [proj], note: null }));
    expect(await err(withSchool(A, (t) => handOverTransfer(t, sa, id, { bastNo: "BAST-PI-1", bastDate: "2026-07-02" })))).toContain("persetujuan");
    await withSchool(A, (t) => handOverTransfer(t, sa, id, { bastNo: "BAST-PI-1", bastDate: "2026-07-02", approvalNo: "800/12/DISDIK", approvalDate: "2026-06-30" }));
    const [p] = await withSchool(A, (t) => t.select().from(assets).where(eq(assets.id, proj)));
    expect(p.status).toBe("DIHAPUS");
    const mA = await moves(A, "2026-07-01", "2026-12-31");
    expect(row(mA, "1.3.2.06").sub[CAUSE.KELUAR_INTERNAL]).toEqual({ n: 1, v: 700_000_000n });
    // B melihat penyerahan masuk, A tidak bisa menerima sendiri
    expect(await err(withSchool(A, (t) => receiveTransfer(t, sa, id, { date: "2026-07-03", roomId: null, note: null })))).toContain("Tidak ada");
    const seen = await withSchool(B, (t) => t.select().from(transfers));
    expect(seen.map((x) => x.id)).toEqual([id]);
    await withSchool(B, (t) => receiveTransfer(t, sb, id, { date: "2026-07-03", roomId: roomB, note: null }));
    const [nb] = await withSchool(B, (t) => t.select().from(assets).where(eq(assets.name, "Proyektor")));
    expect([nb.acqDate, nb.acqPrice, nb.acquisition, nb.roomId, nb.isIntra]).toEqual(["2023-08-01", "7000000.00", "PENERIMAAN_INTERNAL", roomB, true]);
    const mB = await moves(B, "2026-07-01", "2026-12-31");
    expect(row(mB, "1.3.2.06").add[CAUSE.PENERIMAAN_INTERNAL]).toEqual({ n: 1, v: 700_000_000n });
    expect(row(await moves(B, "2026-01-01", "2026-06-30"), "1.3.2.06")).toBeUndefined();
    // penyusutan tetap dari tahun perolehan asal
    const tlB = await withSchool(B, (t) => loadTimelines(t, B));
    expect(depreciationAt(tlB.find((x) => x.id === nb.id)!, semIndex("2026-12-31"), {})!.acc).toBe(490_000_000n); // 5 th = 10 smt; sem II 2023–sem II 2026 = 7 smt
    // sekolah ketiga tidak melihat apa pun
    const C = (await makeSchool({ name: "SMA Negeri C" })).schoolId;
    expect((await withSchool(C, (t) => t.execute(sql`select count(*)::int n from transfers`)) as unknown as { n: number }[])[0].n).toBe(0);
  });

  test("ditolak penerima → pengirim membatalkan, barang kembali", async () => {
    const meja = await asset(sa, { bmdCode: "1.3.2.05.02.01.034", name: "Meja", acqPrice: "2500000" });
    const id = await withSchool(A, (t) => createTransfer(t, sa, { toSchoolId: B, toName: null, date: "2026-07-05", reason: "Uji tolak", approvalNo: "S-2", approvalDate: null, assetIds: [meja], note: null }));
    await withSchool(A, (t) => handOverTransfer(t, sa, id, { bastNo: "BAST-2", bastDate: "2026-07-05" }));
    await withSchool(B, (t) => rejectTransfer(t, sb, id, "Barang tidak sesuai"));
    await withSchool(A, (t) => cancelTransfer(t, sa, id, "Ditolak penerima"));
    const [m] = await withSchool(A, (t) => t.select().from(assets).where(eq(assets.id, meja)));
    expect(m.status).toBe("DIGUNAKAN");
  });
});
