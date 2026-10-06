import { beforeAll, describe, expect, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import { assetEvents, assets, qrTokens, rooms, schoolSettings, schools, users } from "@/db/schema";
import { db } from "@/db";
import { withSchool } from "@/lib/tenant-core";
import { createAssets, moveAssets, setCondition, type NewAssetsInput } from "@/lib/server/assets";
import { UserError } from "@/lib/server/errors";
import { pgCode } from "@/lib/server/activity";
import { isIntraFor, registerCode } from "@/lib/assets-shared";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string;
let sess: SchoolSession;
let R1: string, R2: string;
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : `pg:${pgCode(e)}`));
const base = (o: Partial<NewAssetsInput> = {}): NewAssetsInput => ({
  bmdCode: "1.3.2.10.01.02.002", name: "Laptop Lenovo", brand: "Lenovo", attrs: {}, acqDate: "2026-02-10", acqPrice: "8500000.00",
  acquisition: "PEMBELIAN", fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: null,
  roomId: R1, unitId: null, condition: "BAIK", note: null, qty: 1, startRegNo: null, ...o,
});

beforeAll(async () => {
  await resetTestData();
  const { schoolId } = await makeSchool({ level: "SMK" });
  S = schoolId;
  await tx(async (t) => {
    const [u] = await t.select().from(users);
    sess = { userId: u.id, userName: u.name, schoolId: S, npsn: "", roles: ["ADMIN"], mustChangePassword: false };
    [{ id: R1 }, { id: R2 }] = await t.insert(rooms).values([{ schoolId: S, name: "Lab Komputer" }, { schoolId: S, name: "Ruang Guru" }]).returning();
  });
});

describe("kapitalisasi", () => {
  test("batas Rp2.000.000: tepat 2 juta intrakomptabel, di bawahnya ekstrakomptabel", () => {
    const cap = { default: 2_000_000 };
    expect(isIntraFor("B", 200_000_000n, cap)).toBe(true);
    expect(isIntraFor("B", 199_999_999n, cap)).toBe(false);
    expect(isIntraFor("A", 0n, cap)).toBe(true); // tanah selalu intra
    expect(isIntraFor("C", 500_000_000n, { default: 2_000_000, C: 10_000_000 })).toBe(false); // batas khusus golongan
  });
});

describe("pencatatan aset per unit", () => {
  test("30 kursi → 30 unit dengan nomor register berurutan, ekstrakomptabel", async () => {
    const r = await tx((t) => createAssets(t, sess, base({ bmdCode: "1.3.2.05.02.01.034", name: "Bangku siswa", brand: null, acqPrice: "450000", qty: 30 })));
    expect([r.first, r.last, r.isIntra, r.kib]).toEqual([1, 30, false, "B"]);
    const rows = await tx((t) => t.select().from(assets).where(eq(assets.batchId, r.batchId)).orderBy(asc(assets.regNo)));
    expect(rows.length).toBe(30);
    expect(new Set(rows.map((x) => x.qrToken)).size).toBe(30);
    const ev = await tx((t) => t.select().from(assetEvents).where(eq(assetEvents.kind, "DICATAT")));
    expect(ev.length).toBe(30);
    const qr = await db.select().from(qrTokens).where(eq(qrTokens.schoolId, S));
    expect(qr.length).toBe(30);
  });

  test("lanjut nomor terakhir, atau mulai dari nomor register Dinas", async () => {
    const a = await tx((t) => createAssets(t, sess, base({ bmdCode: "1.3.2.05.02.01.034", name: "Bangku siswa", acqPrice: "450000", qty: 2 })));
    expect([a.first, a.last]).toEqual([31, 32]);
    const b = await tx((t) => createAssets(t, sess, base({ startRegNo: 70, qty: 3 })));
    expect([b.first, b.last, b.isIntra]).toEqual([70, 72, true]);
    expect(await err(tx((t) => createAssets(t, sess, base({ startRegNo: 71 }))))).toContain("000071");
  });

  test("kode persediaan & tanggal masa depan ditolak", async () => {
    expect(await err(tx((t) => createAssets(t, sess, base({ bmdCode: "1.1.7.01.03.02.001" }))))).toContain("aset tetap");
    expect(await err(tx((t) => createAssets(t, sess, base({ acqDate: "2099-01-01" }))))).toContain("masa depan");
  });

  test("kode register dua baris; SEMENTARA bila kode pengguna kosong", async () => {
    const [sc] = await db.select().from(schools).where(eq(schools.id, S));
    const [st] = await tx((t) => t.select().from(schoolSettings));
    const parts = { ownershipCode: sc.ownershipCode, provinceCode: sc.provinceCode, regencyCode: sc.regencyCode, kodePengguna: st.kodePengguna, kodeKuasaPengguna: st.kodeKuasaPengguna, kodeSubKuasa: st.kodeSubKuasa };
    const a = { isIntra: true, acqDate: "2026-02-10", bmdCode: "1.3.2.10.01.02.002", regNo: 70 };
    expect(registerCode(parts, a)).toEqual({ top: "11.01.65.00.??????.?????.00000.2026", bottom: "1.3.2.10.01.02.002.000070", provisional: true });
    expect(registerCode({ ...parts, kodePengguna: "010101", kodeKuasaPengguna: "00103" }, { ...a, isIntra: false }).top).toBe("11.02.65.00.010101.00103.00000.2026");
    expect(registerCode({ ...parts, ownershipCode: "12" }, a).top.startsWith("12.01.65.02.")).toBe(true);
  });
});

describe("pindah & kondisi", () => {
  test("pindah ruangan mencatat riwayat; yang sudah di ruangan tujuan dilewati", async () => {
    const r = await tx((t) => createAssets(t, sess, base({ qty: 2, startRegNo: 200 })));
    expect(await tx((t) => moveAssets(t, sess, r.ids, R2, "2026-03-01", "pindah ke ruang guru"))).toBe(2);
    expect(await err(tx((t) => moveAssets(t, sess, r.ids, R2, "2026-03-02", null)))).toContain("sudah berada");
    const ev = await tx((t) => t.select().from(assetEvents).where(eq(assetEvents.assetId, r.ids[0])).orderBy(asc(assetEvents.id)));
    expect(ev.map((e) => [e.kind, e.fromRoomId, e.toRoomId])).toEqual([["DICATAT", null, R1], ["PINDAH", R1, R2]]);
    expect(await tx((t) => setCondition(t, sess, [r.ids[0]], "RUSAK_RINGAN", "2026-03-05", "engsel layar"))).toBe(1);
  });

  test("riwayat tidak bisa diubah/dihapus", async () => {
    expect(await err(tx((t) => t.update(assetEvents).set({ note: "x" })))).toBe("pg:42501");
    expect(await err(tx((t) => t.delete(assetEvents)))).toBe("pg:42501");
  });
});
