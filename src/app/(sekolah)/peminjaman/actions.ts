"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { assets, rooms } from "@/db/schema";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { processOutbox } from "@/lib/server/inbox";
import { approveLoan, createLoan, rejectOrCancelLoan, returnLoanItems } from "@/lib/server/loans";
import { requireSchoolUser, withSchool } from "@/lib/tenant";
import { fieldErrors } from "@/lib/validations";

const ROLES = ["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR", "PEMINJAM"] as const;
const cond = z.enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]);
const flushMail = () => after(() => processOutbox().catch((e) => console.error("outbox", e)));

/** "2026-10-07T15:00" dari input datetime-local ditafsirkan sebagai WITA */
const witaDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Isi batas pengembalian")
  .transform((v) => new Date(`${v}:00+08:00`));

/** Aset yang bisa dipinjam (status Digunakan), untuk pemilih barang */
export async function searchLoanableAssets(q: string) {
  const s = await requireSchoolUser();
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const e = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  return withSchool(s.schoolId, (tx) =>
    tx
      .select({ id: assets.id, name: assets.name, brand: assets.brand, bmdCode: assets.bmdCode, regNo: assets.regNo, condition: assets.condition, room: rooms.name })
      .from(assets)
      .leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(and(eq(assets.status, "DIGUNAKAN"), or(ilike(assets.name, e), ilike(assets.brand, e), sql`lpad(${assets.regNo}::text, 6, '0') like ${e}`)))
      .orderBy(asc(assets.name), asc(assets.regNo))
      .limit(30),
  );
}

const createSchema = z.object({
  borrowerUserId: z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null),
  borrowerName: z.string().trim().max(100).default(""),
  borrowerInfo: z.string().trim().max(100).optional().transform((v) => v || null),
  purpose: z.string().trim().max(300).optional().transform((v) => v || null),
  dueAt: witaDateTime,
  assets: z.array(z.object({ id: z.uuid(), condition: cond })).min(1, "Pilih minimal satu barang").max(50),
});
export type LoanPayload = z.input<typeof createSchema>;

export async function createLoanAction(payload: LoanPayload, handNow: boolean): Promise<FormState> {
  const p = createSchema.safeParse(payload);
  if (!p.success) return { errors: fieldErrors(p.error) };
  const d = p.data;
  let id = "";
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    const r = await createLoan(
      tx, s,
      { borrowerUserId: d.borrowerUserId, borrowerName: d.borrowerName, borrowerInfo: d.borrowerInfo, purpose: d.purpose, dueAt: d.dueAt, assetIds: d.assets.map((a) => a.id) },
      handNow,
      Object.fromEntries(d.assets.map((a) => [a.id, a.condition])),
    );
    id = r.id;
    await logActivity(tx, s, handNow ? "PINJAM" : "AJUKAN", "peminjaman", r.id, null, { number: r.number, assets: d.assets.length });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  revalidatePath("/peminjaman", "layout");
  revalidatePath("/aset", "layout");
  flushMail();
  redirect(`/peminjaman/${id}`);
}

export async function loanAction(id: string, input: { action: "SERAHKAN" | "TOLAK" | "BATAL" | "KEMBALI"; reason?: string; conditions?: Record<string, string>; returns?: { lineId: string; condition: string; note?: string }[] }): Promise<FormState> {
  if (!z.uuid().safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    if (input.action === "SERAHKAN") {
      const c = z.record(z.string(), cond).parse(input.conditions ?? {});
      await approveLoan(tx, s, id, c);
      await logActivity(tx, s, "SERAHKAN", "peminjaman", id);
      return { ok: "Barang diserahkan; peminjaman berjalan." };
    }
    if (input.action === "KEMBALI") {
      const items = z.array(z.object({ lineId: z.uuid(), condition: cond, note: z.string().max(200).optional() })).parse(input.returns ?? []);
      const r = await returnLoanItems(tx, s, id, items.map((i) => ({ ...i, note: i.note?.trim() || null })));
      await logActivity(tx, s, "KEMBALI", "peminjaman", id, null, { items });
      return { ok: r.left ? `Diterima kembali; ${r.left} barang belum kembali.` : "Semua barang sudah kembali. Peminjaman selesai." };
    }
    const st = await rejectOrCancelLoan(tx, s, id, input.reason ?? "");
    await logActivity(tx, s, st === "DITOLAK" ? "TOLAK" : "BATAL", "peminjaman", id, null, { reason: input.reason ?? null });
    return { ok: st === "DITOLAK" ? "Pengajuan ditolak." : "Pengajuan dibatalkan." };
  });
  revalidatePath("/peminjaman", "layout");
  revalidatePath("/aset", "layout");
  flushMail();
  return res;
}
