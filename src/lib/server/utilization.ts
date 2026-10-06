import "server-only";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { assets, utilizationLines, utilizations } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { todayWita } from "@/lib/server/ledger";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

type Kind = (typeof utilizations.$inferSelect)["kind"];
type Form = NonNullable<(typeof utilizations.$inferSelect)["form"]>;
type Status = (typeof utilizations.$inferSelect)["status"];

function mustManage(s: SchoolSession) {
  if (!hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya Petugas Barang");
}

export type UtilizationInput = {
  kind: Kind;
  form: Form | null;
  planYear: number;
  partner: string | null;
  purpose: string;
  term: string | null;
  contribution: string;
  note: string | null;
  lines: { assetId: string; portion: string | null }[];
  /** Mencatat yang sudah berjalan: tanpa tahap rencana */
  running?: { startDate: string; endDate: string | null; agreementNo: string | null; agreementDate: string | null; approvalNo: string | null; approvalDate: string | null } | null;
};

async function checkLines(tx: Tx, lines: UtilizationInput["lines"], exceptId?: string) {
  if (!lines.length || lines.length > 200) throw new UserError("Pilih 1–200 barang");
  const ids = [...new Set(lines.map((l) => l.assetId))];
  if (ids.length !== lines.length) throw new UserError("Barang yang sama dipilih dua kali");
  const rows = await tx.select({ id: assets.id, name: assets.name, status: assets.status, kib: assets.kib, code: assets.bmdCode }).from(assets).where(inArray(assets.id, ids));
  if (rows.length !== ids.length) throw new UserError("Sebagian barang tidak ditemukan");
  const bad = rows.find((r) => r.status === "DIHAPUS" || r.status === "HILANG" || r.status === "DIUSULKAN_HAPUS");
  if (bad) throw new UserError(`${bad.name} berstatus ${bad.status.toLowerCase().replaceAll("_", " ")}`);
  const wip = rows.find((r) => r.kib === "F" || r.code.startsWith("1.3.5.07."));
  if (wip) throw new UserError(`${wip.name} masih KDP/dalam renovasi`);
  // satu barang tidak boleh dalam dua pemanfaatan aktif sekaligus
  const busy = await tx
    .select({ name: assets.name })
    .from(utilizationLines)
    .innerJoin(utilizations, eq(utilizations.id, utilizationLines.utilizationId))
    .innerJoin(assets, eq(assets.id, utilizationLines.assetId))
    .where(and(inArray(utilizationLines.assetId, ids), inArray(utilizations.status, ["RENCANA", "DISETUJUI", "BERJALAN"]), exceptId ? sql`${utilizations.id} <> ${exceptId}` : sql`true`));
  if (busy.length) throw new UserError(`${busy[0].name} sudah tercantum di pemanfaatan/penggunaan lain yang masih aktif`);
}

function validate(u: UtilizationInput) {
  if ((u.kind === "PEMANFAATAN") !== !!u.form) throw new UserError(u.kind === "PEMANFAATAN" ? "Pilih bentuk pemanfaatan" : "Bentuk hanya untuk pemanfaatan");
  if (u.purpose.trim().length < 3) throw new UserError("Isi peruntukan");
  const y = Number(todayWita().slice(0, 4));
  if (u.planYear < y - 10 || u.planYear > y + 5) throw new UserError("Tahun rencana tidak valid");
}

export async function createUtilization(tx: Tx, s: SchoolSession, u: UtilizationInput) {
  mustManage(s);
  validate(u);
  await checkLines(tx, u.lines);
  const r = u.running;
  if (r) {
    if (r.startDate > todayWita()) throw new UserError("Tanggal mulai tidak boleh di masa depan");
    if (r.endDate && r.endDate < r.startDate) throw new UserError("Tanggal berakhir sebelum tanggal mulai");
    if (!u.partner?.trim()) throw new UserError("Isi nama mitra/pihak pengguna");
  }
  const [row] = await tx
    .insert(utilizations)
    .values({
      schoolId: s.schoolId, kind: u.kind, form: u.form, planYear: u.planYear, partner: u.partner?.trim() || null, purpose: u.purpose.trim(), term: u.term,
      contribution: u.contribution, note: u.note, createdBy: s.userId,
      ...(r
        ? { status: "BERJALAN" as const, startDate: r.startDate, endDate: r.endDate, agreementNo: r.agreementNo, agreementDate: r.agreementDate,
            approvalNo: r.approvalNo, approvalDate: r.approvalDate, withoutApproval: !r.approvalNo }
        : {}),
    })
    .returning({ id: utilizations.id });
  await tx.insert(utilizationLines).values(u.lines.map((l) => ({ schoolId: s.schoolId, utilizationId: row.id, assetId: l.assetId, portion: l.portion })));
  return row.id;
}

async function lockU(tx: Tx, id: string) {
  const [u] = await tx.select().from(utilizations).where(eq(utilizations.id, id)).for("update");
  if (!u) throw new UserError("Data pemanfaatan tidak ditemukan");
  return u;
}

export async function updateUtilizationPlan(tx: Tx, s: SchoolSession, id: string, u: UtilizationInput) {
  mustManage(s);
  const cur = await lockU(tx, id);
  if (cur.status !== "RENCANA") throw new UserError("Hanya rencana yang bisa diubah");
  validate(u);
  await checkLines(tx, u.lines, id);
  await tx
    .update(utilizations)
    .set({ kind: u.kind, form: u.form, planYear: u.planYear, partner: u.partner?.trim() || null, purpose: u.purpose.trim(), term: u.term, contribution: u.contribution, note: u.note, updatedAt: new Date() })
    .where(eq(utilizations.id, id));
  await tx.delete(utilizationLines).where(and(eq(utilizationLines.utilizationId, id), notInArray(utilizationLines.assetId, u.lines.map((l) => l.assetId))));
  for (const l of u.lines)
    await tx
      .insert(utilizationLines)
      .values({ schoolId: s.schoolId, utilizationId: id, assetId: l.assetId, portion: l.portion })
      .onConflictDoUpdate({ target: [utilizationLines.utilizationId, utilizationLines.assetId], set: { portion: l.portion } });
}

export type Step =
  | { step: "setujui"; approvalNo: string; approvalDate: string }
  | { step: "tolak"; reason: string }
  | { step: "mulai"; partner: string; agreementNo: string | null; agreementDate: string | null; startDate: string; endDate: string | null; contribution: string }
  | { step: "selesai"; endedDate: string }
  | { step: "batal"; reason: string };

const FROM: Record<Step["step"], Status[]> = { setujui: ["RENCANA"], tolak: ["RENCANA"], mulai: ["DISETUJUI"], selesai: ["BERJALAN"], batal: ["RENCANA", "DISETUJUI"] };

/** Alur: RENCANA → DISETUJUI (persetujuan Pengelola/Kepala Daerah) → BERJALAN (perjanjian) → SELESAI */
export async function stepUtilization(tx: Tx, s: SchoolSession, id: string, st: Step) {
  mustManage(s);
  const u = await lockU(tx, id);
  if (!FROM[st.step].includes(u.status)) throw new UserError(`Tidak bisa dari status ${u.status.toLowerCase()}`);
  const today = todayWita();
  const now = new Date();
  switch (st.step) {
    case "setujui":
      if (st.approvalNo.trim().length < 3) throw new UserError("Isi nomor surat persetujuan");
      if (st.approvalDate > today) throw new UserError("Tanggal persetujuan tidak valid");
      await tx.update(utilizations).set({ status: "DISETUJUI", approvalNo: st.approvalNo.trim(), approvalDate: st.approvalDate, updatedAt: now }).where(eq(utilizations.id, id));
      break;
    case "tolak":
    case "batal":
      if (st.reason.trim().length < 5) throw new UserError("Isi alasan");
      await tx.update(utilizations).set({ status: st.step === "tolak" ? "DITOLAK" : "DIBATALKAN", lastReason: st.reason.trim(), updatedAt: now }).where(eq(utilizations.id, id));
      break;
    case "mulai":
      if (st.partner.trim().length < 3) throw new UserError("Isi nama mitra");
      if (st.startDate > today || (u.approvalDate && st.startDate < u.approvalDate)) throw new UserError("Tanggal mulai tidak valid");
      if (st.endDate && st.endDate < st.startDate) throw new UserError("Tanggal berakhir sebelum tanggal mulai");
      await tx
        .update(utilizations)
        .set({ status: "BERJALAN", partner: st.partner.trim(), agreementNo: st.agreementNo, agreementDate: st.agreementDate, startDate: st.startDate, endDate: st.endDate, contribution: st.contribution, updatedAt: now })
        .where(eq(utilizations.id, id));
      break;
    case "selesai":
      if (st.endedDate > today || (u.startDate && st.endedDate < u.startDate)) throw new UserError("Tanggal selesai tidak valid");
      await tx.update(utilizations).set({ status: "SELESAI", endedDate: st.endedDate, updatedAt: now }).where(eq(utilizations.id, id));
      break;
  }
}

/** Pemanfaatan aktif untuk satu aset (ditampilkan di halaman aset) */
export async function activeUtilizationOf(tx: Tx, assetId: string) {
  const [r] = await tx
    .select({ id: utilizations.id, kind: utilizations.kind, form: utilizations.form, status: utilizations.status, partner: utilizations.partner, endDate: utilizations.endDate })
    .from(utilizationLines)
    .innerJoin(utilizations, eq(utilizations.id, utilizationLines.utilizationId))
    .where(and(eq(utilizationLines.assetId, assetId), inArray(utilizations.status, ["RENCANA", "DISETUJUI", "BERJALAN"])));
  return r ?? null;
}
