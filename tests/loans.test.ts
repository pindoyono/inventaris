import { beforeAll, describe, expect, test } from "bun:test";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, emailOutbox, loanLines, loans, notifications, rooms, userRoles, users } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { createAssets } from "@/lib/server/assets";
import { approveLoan, createLoan, rejectOrCancelLoan, returnLoanItems } from "@/lib/server/loans";
import { processOutbox } from "@/lib/server/inbox";
import { UserError } from "@/lib/server/errors";
import { pgCode } from "@/lib/server/activity";
import type { Role } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";
import { makeSchool, resetTestData } from "./helpers";

let S: string;
let laptop: string[];
const who: Record<string, SchoolSession> = {};
const tx = <T>(fn: Parameters<typeof withSchool<T>>[1]) => withSchool(S, fn);
const err = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof UserError ? e.message : `pg:${pgCode(e)}`));
const tomorrow = () => new Date(Date.now() + 24 * 3600_000);
const asset = (id: string) => tx(async (t) => (await t.select().from(assets).where(eq(assets.id, id)))[0]);

beforeAll(async () => {
  await resetTestData();
  S = (await makeSchool()).schoolId;
  await tx(async (t) => {
    const mk = async (username: string, roles: Role[], email: string | null) => {
      const [u] = await t.insert(users).values({ schoolId: S, username, name: username.toUpperCase(), passwordHash: "x", email }).returning();
      for (const role of roles) await t.insert(userRoles).values({ schoolId: S, userId: u.id, role });
      who[username] = { userId: u.id, userName: u.name, schoolId: S, npsn: "", roles, mustChangePassword: false };
    };
    await mk("petugas", ["PETUGAS"], "petugas@contoh.sch.id");
    await mk("guru", ["PEMINJAM"], "guru@contoh.sch.id");
    await mk("siswa", ["PEMINJAM"], null);
    const [room] = await t.insert(rooms).values({ schoolId: S, name: "Lab" }).returning();
    const r = await createAssets(t, who.petugas, {
      bmdCode: "1.3.2.10.01.02.002", name: "Laptop praktik", brand: null, attrs: {}, acqDate: "2026-01-10", acqPrice: "7000000.00", acquisition: "PEMBELIAN",
      fundingSourceId: null, fundingComponentId: null, vendorId: null, refNumber: null, roomId: room.id, unitId: null, condition: "BAIK", note: null, qty: 3, startRegNo: null,
    });
    laptop = r.ids;
  });
});

describe("peminjaman langsung oleh petugas", () => {
  test("siswa tanpa akun meminjam 2 laptop; aset berstatus dipinjam", async () => {
    const l = await tx((t) => createLoan(t, who.petugas, { borrowerUserId: null, borrowerName: "Andi Siswa", borrowerInfo: "XI TKJ 1 / 2324101", purpose: "praktik", dueAt: tomorrow(), assetIds: laptop.slice(0, 2) }, true));
    expect(l.number).toMatch(/^PJ\/\d{4}\/0001$/);
    expect((await asset(laptop[0])).status).toBe("DIPINJAM");
    // laptop yang sama tidak bisa dipinjam lagi
    expect(await err(tx((t) => createLoan(t, who.petugas, { borrowerUserId: null, borrowerName: "Budi", borrowerInfo: null, purpose: null, dueAt: tomorrow(), assetIds: [laptop[0]] }, true)))).toContain("tidak tersedia");
    // kembali sebagian: satu rusak ringan
    const lines = await tx((t) => t.select().from(loanLines).where(eq(loanLines.loanId, l.id)).orderBy(asc(loanLines.id)));
    const first = await tx((t) => returnLoanItems(t, who.petugas, l.id, [{ lineId: lines[0].id, condition: "RUSAK_RINGAN", note: "engsel longgar" }]));
    expect(first.left).toBe(1);
    const back = await asset(lines[0].assetId);
    expect([back.status, back.condition]).toEqual(["DIGUNAKAN", "RUSAK_RINGAN"]);
    await tx((t) => returnLoanItems(t, who.petugas, l.id, [{ lineId: lines[1].id, condition: "BAIK", note: null }]));
    const [done] = await tx((t) => t.select().from(loans).where(eq(loans.id, l.id)));
    expect(done.status).toBe("SELESAI");
  });

  test("batas kembali di masa lalu ditolak; peminjam tidak bisa menyerahkan barang sendiri", async () => {
    expect(await err(tx((t) => createLoan(t, who.petugas, { borrowerUserId: null, borrowerName: "Andi", borrowerInfo: null, purpose: null, dueAt: new Date(Date.now() - 1000), assetIds: [laptop[2]] }, true)))).toContain("setelah sekarang");
    expect(await err(tx((t) => createLoan(t, who.guru, { borrowerUserId: null, borrowerName: "x", borrowerInfo: null, purpose: null, dueAt: tomorrow(), assetIds: [laptop[2]] }, true)))).toContain("Hanya Petugas");
  });
});

describe("pengajuan oleh peminjam berakun + notifikasi", () => {
  test("guru mengajukan → petugas dapat notifikasi & email → disetujui → guru dapat notifikasi", async () => {
    const l = await tx((t) => createLoan(t, who.guru, { borrowerUserId: who.petugas.userId, borrowerName: "dipaksa", borrowerInfo: null, purpose: "rapat", dueAt: tomorrow(), assetIds: [laptop[2]] }, false));
    const [row] = await tx((t) => t.select().from(loans).where(eq(loans.id, l.id)));
    expect([row.status, row.borrowerUserId, row.borrowerName]).toEqual(["DIAJUKAN", who.guru.userId, "GURU"]); // selalu atas nama sendiri
    expect((await asset(laptop[2])).status).toBe("DIGUNAKAN"); // belum diserahkan
    const pn = await tx((t) => t.select().from(notifications).where(eq(notifications.userId, who.petugas.userId)));
    expect(pn.some((n) => n.title.includes(l.number))).toBe(true);
    const mails = await db.select().from(emailOutbox).where(eq(emailOutbox.to, "petugas@contoh.sch.id"));
    expect(mails.length).toBe(1);

    expect(await err(tx((t) => approveLoan(t, who.guru, l.id)))).toContain("Hanya Petugas");
    await tx((t) => approveLoan(t, who.petugas, l.id));
    expect((await asset(laptop[2])).status).toBe("DIPINJAM");
    const gn = await tx((t) => t.select().from(notifications).where(eq(notifications.userId, who.guru.userId)));
    expect(gn.some((n) => n.title.includes("disetujui"))).toBe(true);
  });

  test("tolak butuh alasan; peminjam bisa membatalkan pengajuannya sendiri", async () => {
    // kembalikan dulu laptop[2]
    const [active] = await tx((t) => t.select().from(loanLines).where(sql`${loanLines.assetId} = ${laptop[2]} and ${loanLines.returnedAt} is null`));
    await tx((t) => returnLoanItems(t, who.petugas, active.loanId, [{ lineId: active.id, condition: "BAIK", note: null }]));
    const a = await tx((t) => createLoan(t, who.siswa, { borrowerUserId: null, borrowerName: "", borrowerInfo: "X RPL", purpose: null, dueAt: tomorrow(), assetIds: [laptop[2]] }, false));
    expect(await err(tx((t) => rejectOrCancelLoan(t, who.petugas, a.id, "x")))).toContain("alasan");
    expect(await tx((t) => rejectOrCancelLoan(t, who.siswa, a.id, ""))).toBe("DIBATALKAN");
  });

  test("antrean email terkirim (tanpa SMTP di tes = dianggap terkirim) dan tidak dikirim dua kali", async () => {
    const n = await processOutbox(50);
    expect(n).toBeGreaterThan(0);
    expect(await processOutbox(50)).toBe(0);
  });

  test("satu aset tidak bisa sedang dipinjam di dua peminjaman (indeks unik DB)", async () => {
    const res = await err(
      tx(async (t) => {
        const [l1] = await t.insert(loans).values({ schoolId: S, status: "DIPINJAM", borrowerName: "x", dueAt: tomorrow(), createdBy: who.petugas.userId }).returning();
        const [l2] = await t.insert(loans).values({ schoolId: S, status: "DIPINJAM", borrowerName: "y", dueAt: tomorrow(), createdBy: who.petugas.userId }).returning();
        await t.insert(loanLines).values({ schoolId: S, loanId: l1.id, assetId: laptop[1], outAt: new Date() });
        await t.insert(loanLines).values({ schoolId: S, loanId: l2.id, assetId: laptop[1], outAt: new Date() });
      }),
    );
    expect(res).toBe("pg:23505");
  });
});

describe("pengingat harian", () => {
  test("peminjaman terlambat & stok minimum → notifikasi; tidak ganda di hari yang sama", async () => {
    const { runDailyReminders } = await import("@/lib/server/reminders");
    await db.update((await import("@/db/schema")).schools).set({ status: "ACTIVE" }).where(eq((await import("@/db/schema")).schools.id, S));
    const l = await tx((t) => createLoan(t, who.petugas, { borrowerUserId: who.guru.userId, borrowerName: "", borrowerInfo: null, purpose: null, dueAt: new Date(Date.now() + 3600_000), assetIds: [laptop[0]] }, true));
    await tx((t) => t.update(loans).set({ dueAt: new Date(Date.now() - 3600_000) }).where(eq(loans.id, l.id)));
    const n1 = await runDailyReminders();
    expect(n1).toBeGreaterThanOrEqual(2); // peminjam + petugas
    const g = await tx((t) => t.select().from(notifications).where(eq(notifications.userId, who.guru.userId)));
    expect(g.some((x) => x.title.includes("terlambat"))).toBe(true);
    expect(await runDailyReminders()).toBe(0); // sudah diingatkan
  });
});
