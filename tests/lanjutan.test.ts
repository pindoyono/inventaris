import { beforeAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { assets, assetValueChanges, constructions, disposalLines, maintenances, rooms, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { createAssets } from "@/lib/server/assets";
import { correctAsset, openFindings, reclassifyAsset } from "@/lib/server/asset-changes";
import { addConstructionPayment, createConstruction, finishConstruction, setConstructionProgress, stopConstruction } from "@/lib/server/construction";
import { recordMaintenance } from "@/lib/server/maintenance";
import { createUtilization, stepUtilization } from "@/lib/server/utilization";
import { finishInventory, saveChecks, startInventory } from "@/lib/server/inventory";
import { actOnDisposal, saveDisposalDraft } from "@/lib/server/disposal";
import { kirData } from "@/lib/server/reports";
import { kdpData, lhiData, pemindahtangananData, utilNoApprovalData, utilStageData } from "@/lib/server/reports-7-2024";
import { todayWita } from "@/lib/server/ledger";
import { UserError } from "@/lib/server/errors";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, owner, resetTestData } from "./helpers";

let S: string, R1: string, sess: SchoolSession, kepsek: SchoolSession;
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : `${e} ${(e as { cause?: unknown }).cause ?? ""}`));
const today = todayWita();
const Y = Number(today.slice(0, 4));
const asset = (over: Partial<Parameters<typeof createAssets>[2]> = {}) =>
  tx((t) =>
    createAssets(t, sess, {
      bmdCode: "1.3.2.05.02.01.034", name: "Kursi", brand: null, attrs: {}, acqDate: `${Y}-01-05`, acqPrice: "400000", acquisition: "PEMBELIAN",
      fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: null, roomId: R1, unitId: null, condition: "BAIK", note: null, qty: 1, startRegNo: null, ...over,
    }),
  ).then((r) => r.ids[0]);
const get = (id: string) => tx((t) => t.select().from(assets).where(eq(assets.id, id))).then((r) => r[0]);

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    const [u] = await t.select().from(users);
    sess = { userId: u.id, userName: u.name, schoolId: S, npsn: "", roles: ["ADMIN"], mustChangePassword: false };
    kepsek = { ...sess, roles: ["KEPSEK"] };
    [{ id: R1 }] = await t.insert(rooms).values([{ schoolId: S, name: "Lab", picName: "Andi" }]).returning();
  });
});

describe("KDP", () => {
  test("nilai dari pembayaran, riwayat tidak bisa diubah, selesai → reklasifikasi ke KIB C", async () => {
    const c = await tx((t) => createConstruction(t, sess, {
      kind: "KDP", bmdCode: "1.3.6.01.01.01.003", name: "Pembangunan RKB 2 lokal", attrs: { letak: "Blok B" }, ownerName: null, contractNo: "SPK-01", contractDate: `${Y}-01-10`,
      vendorId: null, contractValue: "300000000.00", startDate: `${Y}-01-10`, targetDate: null, fundingSourceId: null, fundingComponentId: null, note: null,
    }));
    let a = await get(c.assetId);
    expect([a.kib, a.isIntra, a.acqPrice]).toEqual(["F", true, "0.00"]);
    expect(await err(tx((t) => finishConstruction(t, sess, c.id, { date: today, bastNo: "BAST-1", bmdCode: "1.3.3.01.01.01.001", name: null, roomId: null })))).toContain("Belum ada biaya");
    await tx((t) => addConstructionPayment(t, sess, c.id, { date: `${Y}-02-01`, amount: "90000000.00", docNo: "SP2D-1", note: "Termin I" }));
    await tx((t) => addConstructionPayment(t, sess, c.id, { date: `${Y}-03-01`, amount: "120000000.00", docNo: "SP2D-2", note: null }));
    expect((await get(c.assetId)).acqPrice).toBe("210000000.00");
    // riwayat nilai hanya INSERT
    expect(await err(tx((t) => t.update(assetValueChanges).set({ amount: "1" }).where(eq(assetValueChanges.assetId, c.assetId))))).toMatch(/tidak boleh|riwayat|permission|denied/i);
    // C.21: akhir tahun lalu belum ada, tahun ini dilanjutkan senilai pembayaran
    expect(await tx((t) => kdpData(t, Y - 1))).toEqual([]);
    const k = await tx((t) => kdpData(t, Y));
    expect(k[0].code).toBe("1.3.3");
    expect([k[0].go.n, k[0].go.v, k[0].stop.n]).toEqual([1, 21_000_000_000n, 0]);
    await tx((t) => stopConstruction(t, sess, c.id, true, "Anggaran ditunda"));
    expect((await tx((t) => kdpData(t, Y)))[0].stop.n).toBe(1);
    expect(await err(tx((t) => setConstructionProgress(t, sess, c.id, 50, null)))).toContain("tidak sedang berjalan");
    await tx((t) => stopConstruction(t, sess, c.id, false, null));
    await tx((t) => finishConstruction(t, sess, c.id, { date: today, bastNo: "BAST-1", bmdCode: "1.3.3.01.01.01.001", name: "Gedung RKB", roomId: null }));
    a = await get(c.assetId);
    expect([a.kib, a.bmdCode, a.name, a.acqDate, a.isIntra, a.acqPrice]).toEqual(["C", "1.3.3.01.01.01.001", "Gedung RKB", today, true, "210000000.00"]);
    const [cc] = await tx((t) => t.select().from(constructions).where(eq(constructions.id, c.id)));
    expect([cc.status, cc.progress]).toEqual(["SELESAI", 100]);
    expect(await tx((t) => kdpData(t, Y))).toEqual([]);
  });

  test("kode KDP harus sesuai jenis; ATR wajib pemilik", async () => {
    const base = { name: "Rehab lab", attrs: {}, contractNo: null, contractDate: null, vendorId: null, contractValue: "0", startDate: today, targetDate: null, fundingSourceId: null, fundingComponentId: null, note: null };
    expect(await err(tx((t) => createConstruction(t, sess, { ...base, kind: "KDP", bmdCode: "1.3.5.07.01.01.003", ownerName: null })))).toContain("Konstruksi Dalam Pengerjaan");
    expect(await err(tx((t) => createConstruction(t, sess, { ...base, kind: "ATR", bmdCode: "1.3.5.07.01.01.003", ownerName: " " })))).toContain("pemilik");
    const c = await tx((t) => createConstruction(t, sess, { ...base, kind: "ATR", bmdCode: "1.3.5.07.01.01.003", ownerName: "Dinas Pendidikan" }));
    expect((await get(c.assetId)).isIntra).toBe(true);
  });
});

describe("nilai, reklasifikasi & koreksi", () => {
  test("kapitalisasi peningkatan menambah nilai; KIR tanggal lampau memakai nilai saat itu", async () => {
    const id = await asset({ name: "Server", acqPrice: "15000000" });
    expect(await err(tx((t) => recordMaintenance(t, sess, { assetId: id, kind: "RUTIN", startDate: today, executor: null, description: "Bersihkan debu", cost: "100000", fundingSourceId: null, fundingComponentId: null, finish: { endDate: today, conditionAfter: "BAIK" }, capitalize: true })))).toContain("peningkatan");
    await tx((t) => recordMaintenance(t, sess, { assetId: id, kind: "PENINGKATAN", startDate: today, executor: null, description: "Tambah RAM & SSD", cost: "4.500.000", fundingSourceId: null, fundingComponentId: null, finish: { endDate: today, conditionAfter: "BAIK" }, capitalize: true }));
    expect((await get(id)).acqPrice).toBe("19500000.00");
    const [m] = await tx((t) => t.select().from(maintenances).where(eq(maintenances.assetId, id)));
    expect(m.capitalized).toBe(true);
    const past = await tx((t) => kirData(t, R1, `${Y}-01-31`));
    const now = await tx((t) => kirData(t, R1, today));
    const v = (k: typeof past) => k!.rows.find((r) => r.name === "Server")!.total;
    expect([v(past), v(now)]).toEqual([1_500_000_000n, 1_950_000_000n]);
  });

  test("temuan inventarisasi → reklasifikasi (register baru, jadi intra) & koreksi nilai; laporan C.27/C.29", async () => {
    const a1 = await asset({ name: "Lemari", acqPrice: "1500000" });
    const a2 = await asset({ name: "Meja guru", acqPrice: "900000" });
    expect((await get(a1)).isIntra).toBe(false);
    const inv = await tx((t) => startInventory(t, sess, R1, null));
    const lines = await tx((t) => t.execute(sql`select id, asset_id from asset_inventory_lines where inventory_id = ${inv.id}`)).then((r) => [...r] as unknown as { id: string; asset_id: string }[]);
    const lineOf = (aid: string) => lines.find((l) => l.asset_id === aid)!.id;
    await tx((t) => saveChecks(t, sess, inv.id, lines.map((l) => ({
      lineId: l.id, found: true, condition: "BAIK",
      followUp: l.asset_id === a1 ? "REKLASIFIKASI" : l.asset_id === a2 ? "KOREKSI" : null, note: l.asset_id === a1 ? "seharusnya lemari arsip besi" : null,
    }))));
    await tx((t) => finishInventory(t, sess, inv.id));
    expect((await tx((t) => openFindings(t, a1))).map((f) => f.kind)).toEqual(["REKLASIFIKASI"]);
    let c27 = await tx((t) => lhiData(t, "REKLASIFIKASI", Y));
    expect([c27[0].lhi.n, c27[0].done.n, c27[0].todo.n]).toEqual([1, 0, 1]);

    // jenis temuan harus sesuai
    expect(await err(tx((t) => correctAsset(t, sess, { assetId: a1, date: today, acqPrice: "1600000.00", acqDate: null, acquisition: null, reason: "salah input", docNo: null, inventoryLineId: lineOf(a1) })))).toContain("reklasifikasi");
    const before = await get(a1);
    await tx((t) => reclassifyAsset(t, sess, { assetId: a1, date: today, bmdCode: "1.3.2.05.01.04.001", intra: "intra", reason: "Hasil inventarisasi", docNo: "BA-INV-1", inventoryLineId: lineOf(a1) }));
    const after = await get(a1);
    expect([after.bmdCode, after.kib, after.regNo, after.isIntra, after.qrToken]).toEqual(["1.3.2.05.01.04.001", "B", 1, true, before.qrToken]);
    expect(await tx((t) => openFindings(t, a1))).toEqual([]);
    c27 = await tx((t) => lhiData(t, "REKLASIFIKASI", Y));
    expect([c27[0].done.n, c27[0].todo.n]).toEqual([1, 0]);
    // temuan yang sudah ditindaklanjuti tidak bisa dipakai lagi
    expect(await err(tx((t) => reclassifyAsset(t, sess, { assetId: a1, date: today, bmdCode: "1.3.2.05.02.01.034", intra: "auto", reason: "uji ulang", docNo: null, inventoryLineId: lineOf(a1) })))).toContain("sudah ditindaklanjuti");

    await tx((t) => correctAsset(t, sess, { assetId: a2, date: today, acqPrice: "750000.00", acqDate: `${Y}-01-02`, acquisition: null, reason: "Sesuai kuitansi", docNo: null, inventoryLineId: lineOf(a2) }));
    const m2 = await get(a2);
    expect([m2.acqPrice, m2.acqDate]).toEqual(["750000.00", `${Y}-01-02`]);
    const [vc] = await tx((t) => t.select().from(assetValueChanges).where(eq(assetValueChanges.assetId, a2)));
    expect([vc.kind, vc.amount]).toEqual(["KOREKSI", "-150000.00"]);
    const c29 = await tx((t) => lhiData(t, "KOREKSI", Y));
    expect([c29[0].lhi.n, c29[0].done.n]).toEqual([1, 1]);
    expect(await err(tx((t) => correctAsset(t, sess, { assetId: a2, date: today, acqPrice: "750000.00", acqDate: null, acquisition: null, reason: "tanpa beda", docNo: null })))).toContain("Tidak ada data");
  });
});

describe("pemanfaatan", () => {
  test("rencana → disetujui → berjalan → selesai; satu barang tidak boleh di dua pemanfaatan aktif; C.9/C.11", async () => {
    const land = await asset({ bmdCode: "1.3.1.01.01.01.001", name: "Tanah sekolah", acqPrice: "500000000", roomId: null });
    const id = await tx((t) => createUtilization(t, sess, { kind: "PEMANFAATAN", form: "SEWA", planYear: Y, partner: null, purpose: "Menara telekomunikasi", term: "5 tahun", contribution: "0", note: null, lines: [{ assetId: land, portion: "100 m²" }] }));
    expect(await err(tx((t) => createUtilization(t, sess, { kind: "PEMANFAATAN", form: "KSP", planYear: Y, partner: null, purpose: "Kerja sama", term: null, contribution: "0", note: null, lines: [{ assetId: land, portion: null }] })))).toContain("sudah tercantum");
    expect(await err(tx((t) => createUtilization(t, sess, { kind: "PENGGUNAAN_SEMENTARA", form: "SEWA", planYear: Y, partner: null, purpose: "x yz", term: null, contribution: "0", note: null, lines: [{ assetId: land, portion: null }] })))).toContain("Bentuk hanya");
    expect(await err(tx((t) => stepUtilization(t, sess, id, { step: "mulai", partner: "PT Menara", agreementNo: null, agreementDate: null, startDate: today, endDate: null, contribution: "0" })))).toContain("Tidak bisa");
    await tx((t) => stepUtilization(t, sess, id, { step: "setujui", approvalNo: "SK-BUP-12", approvalDate: today }));
    await tx((t) => stepUtilization(t, sess, id, { step: "mulai", partner: "PT Menara", agreementNo: "PKS-1", agreementDate: today, startDate: today, endDate: `${Y + 5}-12-31`, contribution: "25000000.00" }));
    const [sewa] = await tx((t) => utilStageData(t, "PEMANFAATAN", Y));
    expect(sewa.label).toBe("Sewa");
    expect([sewa.rows[0].code, sewa.total.plan.n, sewa.total.ok.n, sewa.total.run.n, sewa.total.run.v]).toEqual(["1.3.1", 1, 1, 1, 50_000_000_000n]);
    await tx((t) => stepUtilization(t, sess, id, { step: "selesai", endedDate: today }));

    // kantin yang sudah berjalan tanpa persetujuan → C.11
    const room = await asset({ bmdCode: "1.3.3.01.01.01.001", name: "Ruang kantin", acqPrice: "80000000" });
    await tx((t) => createUtilization(t, sess, { kind: "PEMANFAATAN", form: "PINJAM_PAKAI", planYear: Y, partner: "Koperasi", purpose: "Kantin", term: null, contribution: "0", note: null, lines: [{ assetId: room, portion: null }], running: { startDate: `${Y}-01-01`, endDate: null, agreementNo: null, agreementDate: null, approvalNo: null, approvalDate: null } }));
    const c11 = await tx((t) => utilNoApprovalData(t, Y));
    expect(c11.find((g) => g.label === "Pinjam Pakai")!.total.run.n).toBe(1);
    expect((await tx((t) => utilStageData(t, "PEMANFAATAN", Y))).find((g) => g.label === "Pinjam Pakai")!.total.run.n).toBe(0);
  });
});

describe("pemindahtanganan", () => {
  test("bentuk pemindahtanganan tersimpan dan masuk C.13 sebagai rencana", async () => {
    const id = await asset({ name: "Mesin ketik", acqPrice: "2500000" });
    await tx((t) => t.update(assets).set({ condition: "RUSAK_BERAT" }).where(eq(assets.id, id)));
    const did = await tx((t) => saveDisposalDraft(t, sess, { date: today, note: null, lines: [{ assetId: id, reason: "RUSAK_BERAT", followUp: "PEMINDAHTANGANAN", transferForm: "HIBAH" }] }));
    await tx((t) => actOnDisposal(t, kepsek, did, { action: "AJUKAN" }));
    const [l] = await tx((t) => t.select().from(disposalLines).where(eq(disposalLines.disposalId, did)));
    expect(l.transferForm).toBe("HIBAH");
    const g = await tx((t) => pemindahtangananData(t, Y));
    const hibah = g.find((x) => x.label.startsWith("Hibah"))!;
    expect([hibah.total.plan.n, hibah.total.ok.n]).toEqual([1, 0]);
  });
});

describe("isolasi", () => {
  test("tabel baru dilindungi RLS FORCE", async () => {
    const r = await owner`select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('asset_value_changes','asset_changes','constructions','utilizations','utilization_lines') order by relname`;
    expect(r.length).toBe(5);
    expect(r.every((x) => x.relrowsecurity && x.relforcerowsecurity)).toBe(true);
    // sekolah lain tidak melihat data
    const other = (await makeSchool()).schoolId;
    const n = await withSchool(other, (t) => t.execute(sql`select count(*)::int n from utilizations`));
    expect((n as unknown as { n: number }[])[0].n).toBe(0);
  });
});
