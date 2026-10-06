import { beforeAll, describe, expect, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import { requestEvents, schoolSettings, stockBalances, stockDocs, supplyRequestLines, supplyRequests, units, uoms, userUnits, users, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { actOnRequest, pendingForUser, saveRequestDraft } from "@/lib/server/requests";
import { createSupplyItem, saveDraftDoc } from "@/lib/server/supply";
import { postDoc } from "@/lib/server/ledger";
import { UserError } from "@/lib/server/errors";
import { pgCode } from "@/lib/server/activity";
import type { Role } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string, G: string, U1: string, U2: string, hvs: string, tinta: string;
const who: Record<string, SchoolSession> = {};
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : `pg:${pgCode(e)}`));
const act = (as: string, id: string, input: Parameters<typeof actOnRequest>[3]) => tx((t) => actOnRequest(t, who[as], id, input));
const draft = (as: string, unitId = U1, lines = [{ itemId: hvs, qty: "5" }, { itemId: tinta, qty: "2" }]) =>
  tx((t) => saveRequestDraft(t, who[as], { unitId, date: "2026-05-02", purpose: "ujian semester", lines }));
const status = (id: string) => tx(async (t) => (await t.select().from(supplyRequests).where(eq(supplyRequests.id, id)))[0]);
const setFlow = (mode: "LENGKAP" | "RINGKAS", levels: number) => tx((t) => t.update(schoolSettings).set({ distributionMode: mode, approvalLevels: levels }));
const bal = (itemId: string) => tx(async (t) => (await t.select().from(stockBalances).where(eq(stockBalances.itemId, itemId)))[0]?.qty);

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    const [admin] = await t.select().from(users);
    G = (await t.select().from(warehouses))[0].id;
    [{ id: U1 }, { id: U2 }] = await t.insert(units).values([{ schoolId: S, name: "TKJ" }, { schoolId: S, name: "Tata Usaha" }]).returning();
    const mk = async (username: string, roles: Role[]) => {
      const [u] = await t.insert(users).values({ schoolId: S, username, name: username.toUpperCase(), passwordHash: "x" }).returning();
      who[username] = { userId: u.id, userName: u.name, schoolId: S, npsn: "", roles, mustChangePassword: false };
      return u.id;
    };
    who.admin = { userId: admin.id, userName: admin.name, schoolId: S, npsn: "", roles: ["ADMIN"], mustChangePassword: false };
    const guru = await mk("guru", ["PENGUSUL"]);
    await mk("petugas", ["PETUGAS"]);
    await mk("verif", ["VERIFIKATOR"]);
    await mk("kepsek", ["KEPSEK"]);
    await t.insert(userUnits).values({ schoolId: S, userId: guru, unitId: U1 });
    const rim = (await t.select().from(uoms).where(eq(uoms.name, "Rim")))[0].id;
    hvs = (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.02.001", name: "HVS A4", spec: null, uomId: rim, minStock: "0" })).id;
    tinta = (await createSupplyItem(t, S, { bmdCode: "1.1.7.01.03.06.004", name: "Tinta printer hitam", spec: null, uomId: rim, minStock: "0" })).id;
    const d = await saveDraftDoc(t, S, admin.id, { kind: "SALDO_AWAL", date: "2026-05-01", warehouseId: G, lines: [{ itemId: hvs, qty: "50", unitPrice: "50000" }, { itemId: tinta, qty: "10", unitPrice: "90000" }] });
    await postDoc(t, S, admin.id, d);
  });
});

describe("hak membuat nota", () => {
  test("pengusul hanya untuk unit lingkupnya", async () => {
    expect(await err(draft("guru", U2))).toContain("unit yang ditetapkan");
    expect(await err(draft("guru", U1))).toBe("ok");
  });
});

describe("mode ringkas", () => {
  test("ajukan → petugas salurkan sebagian → selesai, stok berkurang, BAST terbit", async () => {
    await setFlow("RINGKAS", 2);
    const id = await draft("guru");
    const sub = await act("guru", id, { action: "AJUKAN" });
    expect(sub.docNumber).toMatch(/^NP\/\d{4}\/0001$/);
    // kepsek/verifikator tidak punya langkah di mode ringkas
    expect(await err(act("kepsek", id, { action: "SETUJUI" }))).toContain("tidak tersedia");
    const lines = await tx((t) => t.select().from(supplyRequestLines).where(eq(supplyRequestLines.requestId, id)).orderBy(asc(supplyRequestLines.lineNo)));
    expect(await err(act("petugas", id, { action: "SALURKAN", warehouseId: G, qty: { [lines[0].id]: "6" } }))).toContain("melebihi");
    const done = await act("petugas", id, { action: "SALURKAN", warehouseId: G, date: "2026-05-03", qty: { [lines[0].id]: "4" } });
    expect(done.status).toBe("SELESAI");
    expect(done.docNumber).toMatch(/^BAST\//);
    expect(await bal(hvs)).toBe("46.00");
    expect(await bal(tinta)).toBe("8.00");
    const r = await status(id);
    expect(r.issueDocId).not.toBeNull();
    const [doc] = await tx((t) => t.select().from(stockDocs).where(eq(stockDocs.id, r.issueDocId!)));
    expect([doc.requestId, doc.unitId, doc.status]).toEqual([id, U1, "DIPOSTING"]);
  });
});

describe("mode lengkap 2 tingkat", () => {
  test("ajukan → surat permintaan → verifikasi → SPPB → salurkan", async () => {
    await setFlow("LENGKAP", 2);
    const id = await draft("guru");
    await act("guru", id, { action: "AJUKAN" });
    expect(await tx((t) => pendingForUser(t, who.petugas))).toBe(1);
    expect(await tx((t) => pendingForUser(t, who.kepsek))).toBe(0);
    const lines = await tx((t) => t.select().from(supplyRequestLines).where(eq(supplyRequestLines.requestId, id)).orderBy(asc(supplyRequestLines.lineNo)));
    const sp = await act("petugas", id, { action: "TERUSKAN", qty: { [lines[1].id]: "1" } });
    expect(sp.docNumber).toMatch(/^SP\//);
    expect(await err(act("kepsek", id, { action: "SETUJUI" }))).toContain("tidak tersedia"); // harus diverifikasi dulu
    expect(await err(act("admin", id, { action: "VERIFIKASI" }))).toContain("tidak tersedia"); // admin tidak mewakili verifikator
    await act("verif", id, { action: "VERIFIKASI" });
    const sppb = await act("kepsek", id, { action: "SETUJUI" });
    expect(sppb.docNumber).toMatch(/^SPPB\//);
    // tidak boleh melebihi jumlah di SPPB (tinta disetujui 1)
    expect(await err(act("petugas", id, { action: "SALURKAN", warehouseId: G, qty: { [lines[1].id]: "2" } }))).toContain("melebihi");
    await act("petugas", id, { action: "SALURKAN", warehouseId: G, date: "2026-05-04" });
    expect(await bal(hvs)).toBe("41.00");
    expect(await bal(tinta)).toBe("7.00");
    const ev = await tx((t) => t.select().from(requestEvents).where(eq(requestEvents.requestId, id)).orderBy(asc(requestEvents.id)));
    expect(ev.map((e) => e.action)).toEqual(["BUAT", "AJUKAN", "TERUSKAN", "VERIFIKASI", "SETUJUI", "SALURKAN"]);
  });

  test("kembalikan → perbaiki → ajukan ulang dengan nomor sama; tolak butuh alasan", async () => {
    await setFlow("LENGKAP", 1);
    const id = await draft("guru");
    const first = await act("guru", id, { action: "AJUKAN" });
    expect(await err(act("petugas", id, { action: "KEMBALIKAN", reason: "x" }))).toContain("alasan");
    await act("petugas", id, { action: "KEMBALIKAN", reason: "jumlah terlalu banyak" });
    expect((await status(id)).status).toBe("DRAF");
    await tx((t) => saveRequestDraft(t, who.guru, { id, unitId: U1, date: "2026-05-02", purpose: "revisi", lines: [{ itemId: hvs, qty: "2" }] }));
    const again = await act("guru", id, { action: "AJUKAN" });
    expect(again.docNumber).toBe(first.docNumber);
    await act("petugas", id, { action: "TERUSKAN" });
    await act("kepsek", id, { action: "TOLAK", reason: "anggaran semester habis" }); // 1 tingkat: langsung kepsek
    expect((await status(id)).status).toBe("DITOLAK");
  });

  test("stok kurang saat salurkan → gagal tanpa perubahan apa pun", async () => {
    await setFlow("RINGKAS", 1);
    const id = await draft("admin", U2, [{ itemId: tinta, qty: "100" }]);
    await act("admin", id, { action: "AJUKAN" });
    expect(await err(act("admin", id, { action: "SALURKAN", warehouseId: G }))).toContain("tidak cukup");
    expect((await status(id)).status).toBe("DIAJUKAN");
    expect(await bal(tinta)).toBe("7.00");
  });

  test("jejak alur tidak bisa diubah", async () => {
    expect(await err(tx((t) => t.update(requestEvents).set({ note: "x" })))).toBe("pg:42501");
  });
});
