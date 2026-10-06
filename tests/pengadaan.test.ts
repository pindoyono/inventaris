import { beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { assets, budgetCeilings, procurementLines, fundingSources, proposalLines, proposals, rooms, schoolSettings, stockBalances, supplyItems, uoms, units, userRoles, users, userUnits, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { actOnProposal, budgetStatus, saveProposalDraft } from "@/lib/server/proposals";
import { cancelProcurement, orderProcurement, proposalRemaining, receiveProcurement, saveProcurementDraft } from "@/lib/server/procurement";
import { createSupplyItem } from "@/lib/server/supply";
import { todayWita } from "@/lib/server/ledger";
import { UserError } from "@/lib/server/errors";
import type { Role } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string, U: string, FS: string, G: string, R: string, hvs: string;
const who: Record<string, SchoolSession> = {};
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : String(e)));
const year = Number(todayWita().slice(0, 4));
const draft = (lines: Parameters<typeof saveProposalDraft>[2]["lines"]) => tx((t) => saveProposalDraft(t, who.guru, { unitId: U, year, fundingSourceId: FS, fundingComponentId: null, title: "Kebutuhan praktik semester", lines }));

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    for (const [u, roles] of [["guru", ["PENGUSUL"]], ["petugas", ["PETUGAS"]], ["verif", ["VERIFIKATOR"]], ["kepsek", ["KEPSEK"]]] as [string, Role[]][]) {
      const [row] = await t.insert(users).values({ schoolId: S, username: u, name: u.toUpperCase(), passwordHash: "x" }).returning();
      for (const role of roles) await t.insert(userRoles).values({ schoolId: S, userId: row.id, role });
      who[u] = { userId: row.id, userName: row.name, schoolId: S, npsn: "", roles, mustChangePassword: false };
    }
    [{ id: U }] = await t.insert(units).values({ schoolId: S, name: "TKJ" }).returning();
    await t.insert(userUnits).values({ schoolId: S, userId: who.guru.userId, unitId: U });
    FS = (await t.select().from(fundingSources).where(eq(fundingSources.code, "BOS_REGULER")))[0].id;
    G = (await t.select().from(warehouses))[0].id;
    [{ id: R }] = await t.insert(rooms).values({ schoolId: S, name: "Lab TKJ" }).returning();
    const rim = (await t.select().from(uoms).where(eq(uoms.name, "Rim")))[0].id;
    hvs = (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.02.001", name: "HVS A4", spec: null, uomId: rim, minStock: "0" })).id;
    await t.insert(budgetCeilings).values({ schoolId: S, year, unitId: U, fundingSourceId: FS, amount: "20000000" });
    await t.update(schoolSettings).set({ approvalLevels: 2 });
  });
});

describe("usulan kebutuhan", () => {
  test("verifikator memangkas jumlah agar muat pagu; kepsek menyetujui", async () => {
    const id = await draft([
      { kind: "ASET", bmdCode: "1.3.2.10.01.02.002", description: "Laptop praktik", uom: "Unit", qty: "3", estPrice: "8.000.000", priority: 1 },
      { kind: "PERSEDIAAN", itemId: hvs, description: "HVS A4", uom: "Rim", qty: "20", estPrice: "52000" },
    ]);
    await tx((t) => actOnProposal(t, who.guru, id, { action: "AJUKAN" }));
    expect(await err(tx((t) => actOnProposal(t, who.kepsek, id, { action: "SETUJUI" })))).toContain("tidak tersedia");
    const lines = await tx((t) => t.select().from(proposalLines).where(eq(proposalLines.proposalId, id)));
    const lap = lines.find((l) => l.kind === "ASET")!;
    // 3 × 8 jt + 20 × 52 rb = 25,04 jt > pagu 20 jt
    expect(await err(tx((t) => actOnProposal(t, who.verif, id, { action: "VERIFIKASI" })))).toContain("Melebihi sisa pagu");
    await tx((t) => actOnProposal(t, who.verif, id, { action: "VERIFIKASI", qty: { [lap.id]: "2" } }));
    await tx((t) => actOnProposal(t, who.kepsek, id, { action: "SETUJUI" }));
    const b = await tx((t) => budgetStatus(t, U, FS, year));
    expect([b!.used, b!.left]).toEqual([1_704_000_000n, 296_000_000n]); // 17,04 jt terpakai
  });
});

describe("pengadaan dari usulan", () => {
  test("tidak bisa melebihi jumlah disetujui; terima sebagian; persediaan & aset tercatat; usulan selesai", async () => {
    const [p] = await tx((t) => t.select().from(proposals).where(eq(proposals.status, "DISETUJUI")));
    const rem = await tx((t) => proposalRemaining(t, p.id));
    const lap = rem.find((r) => r.kind === "ASET")!, kertas = rem.find((r) => r.kind === "PERSEDIAAN")!;
    expect(await err(tx((t) => saveProcurementDraft(t, who.petugas, { proposalId: p.id, vendorId: null, fundingSourceId: FS, fundingComponentId: null, orderDate: todayWita(), refNumber: null, refDate: null, note: null,
      lines: [{ proposalLineId: lap.id, kind: "ASET", bmdCode: lap.bmdCode, description: "Laptop praktik", qty: "3", unitPrice: "7900000" }] })))).toContain("melebihi sisa");
    expect(await err(tx((t) => saveProcurementDraft(t, who.guru, { proposalId: p.id, vendorId: null, fundingSourceId: FS, fundingComponentId: null, orderDate: todayWita(), refNumber: null, refDate: null, note: null, lines: [] })))).toContain("Petugas");
    const id = await tx((t) => saveProcurementDraft(t, who.petugas, { proposalId: p.id, vendorId: null, fundingSourceId: FS, fundingComponentId: null, orderDate: todayWita(), refNumber: "INV-77", refDate: todayWita(), taxAmount: "1.738.000", note: null,
      lines: [
        { proposalLineId: lap.id, kind: "ASET", bmdCode: lap.bmdCode, description: "Laptop praktik", brand: "Lenovo", qty: "2", unitPrice: "7.900.000" },
        { proposalLineId: kertas.id, kind: "PERSEDIAAN", itemId: hvs, description: "HVS A4", qty: "20", unitPrice: "51.500" },
      ] }));
    expect(await err(tx((t) => receiveProcurement(t, who.petugas, id, { date: todayWita(), warehouseId: G, lines: [] })))).toContain("dipesan");
    await tx((t) => orderProcurement(t, who.petugas, id));
    const pl = await tx((t) => t.select().from(procurementLines).where(eq(procurementLines.procurementId, id)));
    const L = (k: string) => pl.find((x) => x.kind === k)!.id;
    const r1 = await tx((t) => receiveProcurement(t, who.petugas, id, { date: todayWita(), warehouseId: G, lines: [{ lineId: L("PERSEDIAAN"), qty: "12" }, { lineId: L("ASET"), qty: "1", roomId: R }] }));
    expect([r1.done, r1.assetUnits, r1.docs.length]).toEqual([false, 1, 1]);
    expect(await err(tx((t) => cancelProcurement(t, who.petugas, id)))).toContain("tidak bisa dibatalkan");
    const r2 = await tx((t) => receiveProcurement(t, who.petugas, id, { date: todayWita(), warehouseId: G, lines: [{ lineId: L("PERSEDIAAN"), qty: "8" }, { lineId: L("ASET"), qty: "1", roomId: R }] }));
    expect(r2.done).toBe(true);
    const [bal] = await tx((t) => t.select().from(stockBalances).where(and(eq(stockBalances.itemId, hvs), eq(stockBalances.warehouseId, G))));
    expect([bal.qty, bal.value]).toEqual(["20.00", "1030000.00"]);
    const laps = await tx((t) => t.select().from(assets).where(eq(assets.procurementId, id)));
    expect([laps.length, laps[0].isIntra, laps[0].roomId, laps[0].refNumber]).toEqual([2, true, R, "INV-77"]);
    const [after] = await tx((t) => t.select().from(proposals).where(eq(proposals.id, p.id)));
    expect(after.status).toBe("SELESAI");
  });

  test("pengadaan langsung (tanpa usulan) untuk persediaan wajib pilih NUSP saat diterima", async () => {
    const id = await tx((t) => saveProcurementDraft(t, who.petugas, { vendorId: null, fundingSourceId: null, fundingComponentId: null, orderDate: todayWita(), refNumber: null, refDate: null, note: null,
      lines: [{ kind: "PERSEDIAAN", description: "Tinta printer", qty: "4", unitPrice: "95000" }] }));
    await tx((t) => orderProcurement(t, who.petugas, id));
    const [line] = await tx((t) => t.select().from(procurementLines).where(eq(procurementLines.procurementId, id)));
    expect(await err(tx((t) => receiveProcurement(t, who.petugas, id, { date: todayWita(), warehouseId: G, lines: [{ lineId: line.id, qty: "4" }] })))).toContain("pilih barang persediaan");
    const tinta = await tx(async (t) => (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.06.004", name: "Tinta hitam", spec: null, uomId: (await t.select().from(uoms))[0].id, minStock: "0" })).id);
    const r = await tx((t) => receiveProcurement(t, who.petugas, id, { date: todayWita(), warehouseId: G, lines: [{ lineId: line.id, qty: "4", itemId: tinta }] }));
    expect(r.done).toBe(true);
    expect((await tx((t) => t.select().from(supplyItems).where(eq(supplyItems.id, tinta))))[0].name).toBe("Tinta hitam");
  });
});
