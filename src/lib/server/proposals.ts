import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { budgetCeilings, proposalEvents, proposalLines, proposals, schoolSettings, supplyItems } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, todayWita } from "@/lib/server/ledger";
import { allowedUnitIds } from "@/lib/server/requests";
import { notifyUsers, userIdsWithRoles } from "@/lib/server/inbox";
import { mulDec, normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { P_STATUS_LABEL, proposalActions, type PAction, type PStatus } from "@/lib/proposals-shared";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";

const dec = (v: string, label: string) => {
  try {
    const n = parseDec(normalizeIdNumber(v));
    if (n < 0n) throw new Error();
    return n;
  } catch {
    throw new UserError(`${label} tidak valid`);
  }
};

export type ProposalLineInput = { kind: "PERSEDIAAN" | "ASET"; itemId?: string | null; bmdCode?: string | null; description: string; uom: string; qty: string; estPrice: string; reason?: string | null; priority?: number };
export type ProposalInput = { id?: string; unitId: string; year: number; fundingSourceId: string | null; fundingComponentId: string | null; title: string; lines: ProposalLineInput[] };

export async function saveProposalDraft(tx: Tx, s: SchoolSession, input: ProposalInput) {
  const allowed = await allowedUnitIds(tx, s);
  if (allowed !== "ALL" && !allowed.includes(input.unitId)) throw new UserError("Anda hanya bisa mengusulkan untuk unit yang ditetapkan pada akun Anda");
  if (!input.lines.length) throw new UserError("Isi minimal satu barang");
  if (input.title.trim().length < 5) throw new UserError("Isi judul/keperluan usulan");
  const lines = input.lines.map((l, i) => {
    if (l.description.trim().length < 3) throw new UserError(`Uraian barang baris ${i + 1} wajib diisi`);
    const q = dec(l.qty, `Jumlah baris ${i + 1}`);
    if (q <= 0n) throw new UserError(`Jumlah baris ${i + 1} harus lebih dari 0`);
    return {
      schoolId: s.schoolId, lineNo: i + 1, kind: l.kind, itemId: l.itemId || null, bmdCode: l.bmdCode || null, description: l.description.trim(),
      uom: (l.uom || "Buah").trim().slice(0, 30), qty: toDec(q), estPrice: toDec(dec(l.estPrice || "0", `Harga baris ${i + 1}`)),
      reason: l.reason?.trim() || null, priority: Math.min(3, Math.max(1, l.priority ?? 2)),
    };
  });
  let id = input.id;
  const head = { unitId: input.unitId, year: input.year, fundingSourceId: input.fundingSourceId, fundingComponentId: input.fundingComponentId, title: input.title.trim() };
  if (id) {
    const [p] = await tx.select().from(proposals).where(eq(proposals.id, id)).for("update");
    if (!p) throw new UserError("Usulan tidak ditemukan");
    if (p.status !== "DRAF") throw new UserError("Hanya draf yang bisa diubah");
    if (p.requestedBy !== s.userId && !hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya pengusul yang bisa mengubah");
    await tx.update(proposals).set({ ...head, updatedAt: new Date() }).where(eq(proposals.id, id));
    await tx.delete(proposalLines).where(eq(proposalLines.proposalId, id));
  } else {
    [{ id }] = await tx.insert(proposals).values({ ...head, schoolId: s.schoolId, requestedBy: s.userId }).returning({ id: proposals.id });
    await event(tx, s, id!, "BUAT", null, "DRAF", null);
  }
  await tx.insert(proposalLines).values(lines.map((l) => ({ ...l, proposalId: id! })));
  return id!;
}

async function event(tx: Tx, s: SchoolSession, proposalId: string, action: string, from: PStatus | null, to: PStatus, note: string | null) {
  await tx.insert(proposalEvents).values({ schoolId: s.schoolId, proposalId, action, fromStatus: from, toStatus: to, note, userId: s.userId, userName: s.userName });
}

/** Pagu & pemakaian (nilai usulan yang disetujui) untuk unit × sumber dana × tahun */
export async function budgetStatus(tx: Tx, unitId: string, fundingSourceId: string | null, year: number, exceptProposalId?: string) {
  if (!fundingSourceId) return null;
  const [c] = await tx.select().from(budgetCeilings).where(and(eq(budgetCeilings.unitId, unitId), eq(budgetCeilings.fundingSourceId, fundingSourceId), eq(budgetCeilings.year, year)));
  if (!c) return null;
  const [u] = await tx
    .select({ v: sql<string>`coalesce(sum(round(coalesce(${proposalLines.qtyApproved}, 0) * ${proposalLines.estPrice}, 2)), 0)` })
    .from(proposalLines)
    .innerJoin(proposals, eq(proposals.id, proposalLines.proposalId))
    .where(and(eq(proposals.unitId, unitId), eq(proposals.fundingSourceId, fundingSourceId), eq(proposals.year, year), inArray(proposals.status, ["DISETUJUI", "SELESAI"]), exceptProposalId ? ne(proposals.id, exceptProposalId) : undefined));
  const ceiling = parseDec(c.amount), used = parseDec(u.v);
  return { ceiling, used, left: ceiling - used };
}

export type PActInput = { action: PAction; reason?: string | null; qty?: Record<string, string> };

export async function actOnProposal(tx: Tx, s: SchoolSession, id: string, a: PActInput) {
  const [p] = await tx.select().from(proposals).where(eq(proposals.id, id)).for("update");
  if (!p) throw new UserError("Usulan tidak ditemukan");
  const [st] = await tx.select({ levels: schoolSettings.approvalLevels }).from(schoolSettings);
  const levels = p.levels ?? st.levels;
  if (!proposalActions(p.status, levels, s.roles, p.requestedBy === s.userId).includes(a.action)) throw new UserError("Tindakan ini tidak tersedia untuk Anda pada tahap sekarang");
  const lines = await tx.select().from(proposalLines).where(eq(proposalLines.proposalId, id)).orderBy(asc(proposalLines.lineNo));
  const now = new Date();
  const reason = a.reason?.trim() || null;
  let to: PStatus;
  let number: string | null = null;

  const applyQty = async () => {
    let total = 0n;
    for (const l of lines) {
      const raw = a.qty?.[l.id];
      const max = parseDec(l.qtyApproved ?? l.qty);
      const q = raw === undefined || raw === "" ? max : dec(raw, `Jumlah baris ${l.lineNo}`);
      if (q > parseDec(l.qty)) throw new UserError(`Jumlah baris ${l.lineNo} melebihi yang diusulkan`);
      await tx.update(proposalLines).set({ qtyApproved: toDec(q) }).where(eq(proposalLines.id, l.id));
      total += mulDec(q, parseDec(l.estPrice));
    }
    if (total === 0n) throw new UserError("Semua jumlah 0 — gunakan Tolak bila usulan tidak disetujui");
    const b = await budgetStatus(tx, p.unitId, p.fundingSourceId, p.year, p.id);
    if (b && total > b.left) throw new UserError(`Melebihi sisa pagu: sisa Rp${toDec(b.left)}, usulan Rp${toDec(total)}. Kurangi jumlah yang disetujui.`);
    return total;
  };

  switch (a.action) {
    case "AJUKAN":
      to = "DIAJUKAN";
      number = p.number ?? (await nextDocNumber(tx, s.schoolId, "UK", p.year));
      await tx.update(proposalLines).set({ qtyApproved: null }).where(eq(proposalLines.proposalId, id));
      await tx.update(proposals).set({ status: to, number, levels: st.levels, submittedAt: now, lastReason: null, verifiedBy: null, verifiedAt: null, approvedBy: null, approvedAt: null, updatedAt: now }).where(eq(proposals.id, id));
      await notifyUsers(tx, s.schoolId, await userIdsWithRoles(tx, st.levels >= 2 ? ["VERIFIKATOR"] : ["KEPSEK"]), { title: `Usulan kebutuhan ${number} menunggu ${st.levels >= 2 ? "verifikasi" : "persetujuan"}`, body: p.title, link: `/usulan/${id}` }, s.userId);
      break;
    case "VERIFIKASI":
      await applyQty();
      to = "DIVERIFIKASI";
      await tx.update(proposals).set({ status: to, verifiedBy: s.userId, verifiedAt: now, updatedAt: now }).where(eq(proposals.id, id));
      await notifyUsers(tx, s.schoolId, await userIdsWithRoles(tx, ["KEPSEK"]), { title: `Usulan kebutuhan ${p.number} menunggu persetujuan`, body: p.title, link: `/usulan/${id}` }, s.userId);
      break;
    case "SETUJUI":
      await applyQty();
      to = "DISETUJUI";
      await tx.update(proposals).set({ status: to, approvedBy: s.userId, approvedAt: now, updatedAt: now }).where(eq(proposals.id, id));
      await notifyUsers(tx, s.schoolId, [p.requestedBy, ...(await userIdsWithRoles(tx, ["PETUGAS"]))], { title: `Usulan kebutuhan ${p.number} disetujui`, body: "Petugas Barang dapat memproses pengadaan.", link: `/usulan/${id}` }, s.userId);
      break;
    case "KEMBALIKAN":
    case "TOLAK":
      if (!reason || reason.length < 5) throw new UserError("Tulis alasan (minimal 5 karakter)");
      to = a.action === "TOLAK" ? "DITOLAK" : "DRAF";
      await tx.update(proposals).set({ status: to, lastReason: reason, updatedAt: now, ...(to === "DITOLAK" ? { closedAt: now } : {}) }).where(eq(proposals.id, id));
      await notifyUsers(tx, s.schoolId, [p.requestedBy], { title: `Usulan kebutuhan ${p.number}: ${P_STATUS_LABEL[to]}`, body: `Alasan: ${reason}`, link: `/usulan/${id}` }, s.userId);
      break;
    case "BATAL":
      to = "DIBATALKAN";
      await tx.update(proposals).set({ status: to, closedAt: now, updatedAt: now }).where(eq(proposals.id, id));
      break;
    case "SELESAI":
      to = "SELESAI";
      await tx.update(proposals).set({ status: to, closedAt: now, updatedAt: now }).where(eq(proposals.id, id));
      break;
  }
  await event(tx, s, id, a.action, p.status, to!, [number, reason].filter(Boolean).join(" — ") || null);
  return { status: to!, number };
}

/** Persediaan yang dipilih dari daftar barang */
export async function itemName(tx: Tx, itemId: string) {
  const [i] = await tx.select({ name: supplyItems.name }).from(supplyItems).where(eq(supplyItems.id, itemId));
  return i?.name ?? null;
}
export const thisYear = () => Number(todayWita().slice(0, 4));

/** Jumlah usulan yang menunggu tindakan pengguna (dasbor) */
export async function pendingProposals(tx: Tx, s: SchoolSession) {
  const [st] = await tx.select({ levels: schoolSettings.approvalLevels }).from(schoolSettings);
  const rows = await tx.select({ status: proposals.status, levels: proposals.levels, by: proposals.requestedBy }).from(proposals).where(inArray(proposals.status, ["DIAJUKAN", "DIVERIFIKASI"]));
  return rows.filter((r) => proposalActions(r.status, r.levels ?? st.levels, s.roles, r.by === s.userId).some((a) => a === "VERIFIKASI" || a === "SETUJUI")).length;
}
