import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { rooms, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { createAssets, moveAssets } from "@/lib/server/assets";
import { kirStatus, saveKirSnapshot } from "@/lib/server/kir";
import { addAttachment, listAttachments, removeAttachment } from "@/lib/server/attachments";
import { emit, subscribe } from "@/lib/server/realtime";
import { todayWita } from "@/lib/server/ledger";
import { UserError } from "@/lib/server/errors";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string, R1: string, R2: string, sess: SchoolSession, assetIds: string[];
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : String(e)));
const png = () => {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  return new File([Buffer.from(b64, "base64")], "foto.png", { type: "image/png" });
};

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    const [u] = await t.select().from(users);
    sess = { userId: u.id, userName: u.name, schoolId: S, npsn: "", roles: ["ADMIN"], mustChangePassword: false };
    [{ id: R1 }, { id: R2 }] = await t.insert(rooms).values([{ schoolId: S, name: "Lab", picName: "Andi" }, { schoolId: S, name: "Kelas" }]).returning();
    assetIds = (await createAssets(t, sess, { bmdCode: "1.3.2.05.02.01.034", name: "Kursi", brand: null, attrs: {}, acqDate: "2026-01-05", acqPrice: "400000", acquisition: "PEMBELIAN",
      fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: null, roomId: R1, unitId: null, condition: "BAIK", note: null, qty: 3, startRegNo: null })).ids;
  });
});

describe("status KIR", () => {
  test("belum dicetak → arsip → mutakhir → pindah barang & ganti PJ → perlu diperbarui", async () => {
    const st = () => tx((t) => kirStatus(t, todayWita())).then((l) => l.find((x) => x.roomId === R1)!.reasons);
    expect(await st()).toEqual(["belum pernah dicetak"]);
    await tx((t) => saveKirSnapshot(t, sess, R1, todayWita()));
    expect(await st()).toEqual([]);
    await new Promise((r) => setTimeout(r, 20));
    await tx((t) => moveAssets(t, sess, [assetIds[0]], R2, todayWita(), null));
    await tx((t) => t.update(rooms).set({ picName: "Budi" }).where(eq(rooms.id, R1)));
    const r = await st();
    expect(r.some((x) => x.includes("perubahan barang"))).toBe(true);
    expect(r).toContain("penanggung jawab berganti");
  });
});

describe("lampiran", () => {
  test("unggah foto ke aset, isi berkas diperiksa, hapus", async () => {
    const a = await tx((t) => addAttachment(t, sess, "aset", assetIds[1], png(), "kondisi awal"));
    expect(a.storedName).toMatch(/^lampiran-aset-[a-z0-9]+\.png$/);
    expect((await tx((t) => listAttachments(t, "aset", assetIds[1]))).length).toBe(1);
    const fake = new File([Buffer.from("<script>alert(1)</script>")], "x.png");
    expect(await err(tx((t) => addAttachment(t, sess, "aset", assetIds[1], fake, null)))).toContain("Format");
    expect(await err(tx((t) => addAttachment(t, sess, "aset", "00000000-0000-0000-0000-000000000000", png(), null)))).toContain("tidak ditemukan");
    await tx((t) => removeAttachment(t, sess, a.id));
    expect((await tx((t) => listAttachments(t, "aset", assetIds[1]))).length).toBe(0);
  });
});

describe("realtime LISTEN/NOTIFY", () => {
  test("sinyal terkirim setelah COMMIT, tidak terkirim bila ROLLBACK; disaring per sekolah", async () => {
    const got: string[] = [];
    const unsub = await subscribe({ schoolId: S, userId: sess.userId, send: (e) => got.push(e.k) });
    await new Promise((r) => setTimeout(r, 200));
    await tx((t) => emit(t, { s: S, k: "data" }));
    await tx(async (t) => { await emit(t, { s: S, k: "notif", u: ["lain"] }); }); // bukan untuk pengguna ini
    await tx((t) => emit(t, { s: "sekolah-lain", k: "data" }));
    await tx(async (t) => { await emit(t, { s: S, k: "data" }); throw new Error("batal"); }).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    unsub();
    expect(got).toEqual(["data"]);
  });
});
