import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db";
import { requestEvents, schoolSettings, supplyItems, supplyRequestLines, supplyRequests, userUnits } from "@/db/schema";
import { UserError } from "@/lib/server/errors";
import { nextDocNumber, postDoc, todayWita } from "@/lib/server/ledger";
import { saveDraftDoc } from "@/lib/server/supply";
import { allowedActions, type ReqAction, type ReqStatus } from "@/lib/requests-shared";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { hasAnyRole } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";
import { notifyUsers, userIdsWithRoles } from "@/lib/server/inbox";
import { REQ_STATUS_LABEL } from "@/lib/requests-shared";
import { stockDocs } from "@/db/schema";

export type ReqLineInput = { itemId: string; qty: string; note?: string | null };

/** Unit yang boleh diajukan pengguna: Petugas/Admin semua unit; Pengusul hanya unit lingkupnya */
export async function allowedUnitIds(tx: Tx, s: SchoolSession): Promise<string[] | "ALL"> {
  if (hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) return "ALL";
  const rows = await tx.select({ unitId: userUnits.unitId }).from(userUnits).where(eq(userUnits.userId, s.userId));
  return rows.map((r) => r.unitId);
}

function parseQty(v: string, label: string) {
  let q: bigint;
  try {
    q = parseDec(normalizeIdNumber(v));
  } catch {
    throw new UserError(`Jumlah ${label} tidak valid (maks. 2 desimal)`);
  }
  return q;
}

/** Buat/ubah nota permintaan berstatus DRAF */
export async function saveRequestDraft(
  tx: Tx,
  s: SchoolSession,
  input: { id?: string; unitId: string; date: string; purpose: string | null; lines: ReqLineInput[] },
) {
  if (input.date > todayWita()) throw new UserError("Tanggal tidak boleh di masa depan");
  if (!input.lines.length) throw new UserError("Isi minimal satu barang");
  const allowed = await allowedUnitIds(tx, s);
  if (allowed !== "ALL" && !allowed.includes(input.unitId))
    throw new UserError("Anda hanya bisa mengajukan untuk unit yang ditetapkan admin pada akun Anda");
  const seen = new Set<string>();
  const items = await tx.select({ id: supplyItems.id, active: supplyItems.isActive, name: supplyItems.name }).from(supplyItems).where(inArray(supplyItems.id, input.lines.map((l) => l.itemId)));
  const lines = input.lines.map((l, i) => {
    if (seen.has(l.itemId)) throw new UserError(`Barang pada baris ${i + 1} tercantum dua kali`);
    seen.add(l.itemId);
    const it = items.find((x) => x.id === l.itemId);
    if (!it?.active) throw new UserError(`Barang pada baris ${i + 1} tidak aktif`);
    const q = parseQty(l.qty, `baris ${i + 1}`);
    if (q <= 0n) throw new UserError(`Jumlah baris ${i + 1} harus lebih dari 0`);
    return { lineNo: i + 1, itemId: l.itemId, qtyRequested: toDec(q), note: l.note ?? null };
  });

  let id = input.id;
  if (id) {
    const [r] = await tx.select().from(supplyRequests).where(eq(supplyRequests.id, id)).for("update");
    if (!r) throw new UserError("Permintaan tidak ditemukan");
    if (r.status !== "DRAF") throw new UserError("Hanya draf yang bisa diubah");
    if (r.requestedBy !== s.userId && !hasAnyRole(s.roles, ["ADMIN", "PETUGAS"])) throw new UserError("Hanya pembuat nota yang bisa mengubahnya");
    await tx.update(supplyRequests).set({ unitId: input.unitId, date: input.date, purpose: input.purpose, updatedAt: new Date() }).where(eq(supplyRequests.id, id));
    await tx.delete(supplyRequestLines).where(eq(supplyRequestLines.requestId, id));
  } else {
    [{ id }] = await tx
      .insert(supplyRequests)
      .values({ schoolId: s.schoolId, unitId: input.unitId, date: input.date, purpose: input.purpose, requestedBy: s.userId })
      .returning({ id: supplyRequests.id });
    await event(tx, s, id!, "BUAT", null, "DRAF", null);
  }
  await tx.insert(supplyRequestLines).values(lines.map((l) => ({ ...l, schoolId: s.schoolId, requestId: id! })));
  return id!;
}

async function event(tx: Tx, s: SchoolSession, requestId: string, action: string, from: ReqStatus | null, to: ReqStatus, note: string | null) {
  await tx.insert(requestEvents).values({ schoolId: s.schoolId, requestId, action, fromStatus: from, toStatus: to, note, userId: s.userId, userName: s.userName });
}

export type ActInput = {
  action: ReqAction;
  reason?: string | null;
  /** TERUSKAN/SALURKAN: jumlah per baris (id baris → jumlah) */
  qty?: Record<string, string>;
  /** SALURKAN: gudang asal & tanggal BAST */
  warehouseId?: string;
  date?: string;
};

/** Jalankan satu langkah alur. Mengembalikan status baru (dan nomor dokumen bila ada). */
export async function actOnRequest(tx: Tx, s: SchoolSession, requestId: string, input: ActInput) {
  const [r] = await tx.select().from(supplyRequests).where(eq(supplyRequests.id, requestId)).for("update");
  if (!r) throw new UserError("Permintaan tidak ditemukan");
  const [st] = await tx.select().from(schoolSettings);
  // Mode & tingkat dibekukan saat diajukan; draf mengikuti pengaturan terkini
  const flow = { mode: r.mode ?? st.distributionMode, levels: r.levels ?? st.approvalLevels };
  const can = allowedActions(r.status, flow, s.roles, r.requestedBy === s.userId);
  if (!can.includes(input.action)) throw new UserError("Tindakan ini tidak tersedia untuk Anda pada tahap sekarang");
  const year = Number(todayWita().slice(0, 4));
  const now = new Date();
  const lines = await tx.select().from(supplyRequestLines).where(eq(supplyRequestLines.requestId, requestId)).orderBy(asc(supplyRequestLines.lineNo));
  const reason = input.reason?.trim() || null;
  let to: ReqStatus;
  let docNumber: string | null = null;

  const readQty = (cap: "requested" | "approved") => {
    const out = new Map<string, bigint>();
    for (const l of lines) {
      const raw = input.qty?.[l.id];
      const max = parseDec(cap === "requested" ? l.qtyRequested : (l.qtyApproved ?? "0"));
      const q = raw === undefined || raw === "" ? max : parseQty(raw, `baris ${l.lineNo}`);
      if (q < 0n) throw new UserError(`Jumlah baris ${l.lineNo} tidak boleh negatif`);
      if (q > max) throw new UserError(`Jumlah baris ${l.lineNo} melebihi yang ${cap === "requested" ? "diminta" : "disetujui"}`);
      out.set(l.id, q);
    }
    if ([...out.values()].every((q) => q === 0n)) throw new UserError("Semua jumlah 0 — gunakan Tolak bila permintaan tidak dipenuhi");
    return out;
  };

  switch (input.action) {
    case "AJUKAN": {
      to = "DIAJUKAN";
      // Nota yang dikembalikan lalu diajukan ulang tetap memakai nomor lamanya; tahap sebelumnya direset
      docNumber = r.number ?? (await nextDocNumber(tx, s.schoolId, "NP", year));
      await tx.update(supplyRequestLines).set({ qtyApproved: null }).where(eq(supplyRequestLines.requestId, requestId));
      await tx
        .update(supplyRequests)
        .set({
          status: to, number: docNumber, mode: st.distributionMode, levels: st.approvalLevels, submittedAt: now, lastReason: null, updatedAt: now,
          spNumber: null, forwardedBy: null, forwardedAt: null, verifiedBy: null, verifiedAt: null, sppbNumber: null, approvedBy: null, approvedAt: null,
        })
        .where(eq(supplyRequests.id, requestId));
      break;
    }
    case "BATAL":
      to = "DIBATALKAN";
      await tx.update(supplyRequests).set({ status: to, closedAt: now, lastReason: reason, updatedAt: now }).where(eq(supplyRequests.id, requestId));
      break;
    case "TOLAK":
    case "KEMBALIKAN":
      if (!reason || reason.length < 5) throw new UserError("Tulis alasan (minimal 5 karakter)");
      to = input.action === "TOLAK" ? "DITOLAK" : "DRAF";
      await tx
        .update(supplyRequests)
        .set({ status: to, lastReason: reason, updatedAt: now, ...(to === "DITOLAK" ? { closedAt: now } : {}) })
        .where(eq(supplyRequests.id, requestId));
      break;
    case "TERUSKAN": {
      const q = readQty("requested");
      for (const l of lines) await tx.update(supplyRequestLines).set({ qtyApproved: toDec(q.get(l.id)!) }).where(eq(supplyRequestLines.id, l.id));
      to = "DITERUSKAN";
      docNumber = await nextDocNumber(tx, s.schoolId, "SP", year);
      await tx.update(supplyRequests).set({ status: to, spNumber: docNumber, forwardedBy: s.userId, forwardedAt: now, updatedAt: now }).where(eq(supplyRequests.id, requestId));
      break;
    }
    case "VERIFIKASI":
      to = "DIVERIFIKASI";
      await tx.update(supplyRequests).set({ status: to, verifiedBy: s.userId, verifiedAt: now, updatedAt: now }).where(eq(supplyRequests.id, requestId));
      break;
    case "SETUJUI":
      to = "DISETUJUI";
      docNumber = await nextDocNumber(tx, s.schoolId, "SPPB", year);
      await tx.update(supplyRequests).set({ status: to, sppbNumber: docNumber, approvedBy: s.userId, approvedAt: now, updatedAt: now }).where(eq(supplyRequests.id, requestId));
      break;
    case "SALURKAN": {
      if (!input.warehouseId) throw new UserError("Pilih gudang asal");
      const date = input.date ?? todayWita();
      // Ringkas: batas = jumlah diminta (Petugas sekaligus menyetujui); Lengkap: batas = jumlah di SPPB
      const q = readQty(flow.mode === "RINGKAS" ? "requested" : "approved");
      const docLines = lines.filter((l) => q.get(l.id)! > 0n).map((l) => ({ itemId: l.itemId, qty: toDec(q.get(l.id)!) }));
      const docId = await saveDraftDoc(tx, s.schoolId, s.userId, {
        kind: "PENYALURAN", date, warehouseId: input.warehouseId, unitId: r.unitId, requestId,
        note: `Nota permintaan ${r.number}${r.sppbNumber ? `, SPPB ${r.sppbNumber}` : ""}`, lines: docLines,
      });
      docNumber = await postDoc(tx, s.schoolId, s.userId, docId);
      for (const l of lines) {
        const issued = toDec(q.get(l.id)!);
        await tx
          .update(supplyRequestLines)
          .set({ qtyIssued: issued, ...(flow.mode === "RINGKAS" ? { qtyApproved: issued } : {}) })
          .where(eq(supplyRequestLines.id, l.id));
      }
      to = "SELESAI";
      await tx
        .update(supplyRequests)
        .set({
          status: to, issueDocId: docId, closedAt: now, updatedAt: now,
          ...(flow.mode === "RINGKAS" ? { approvedBy: s.userId, approvedAt: now } : {}),
        })
        .where(eq(supplyRequests.id, requestId));
      break;
    }
  }
  await event(tx, s, requestId, input.action, r.status, to!, [docNumber, reason].filter(Boolean).join(" — ") || null);
  await notifyRequest(tx, s, { ...r, number: r.number ?? docNumber }, input.action, to!, flow, reason);
  return { status: to!, docNumber };
}

/** Beri tahu peran pada tahap berikutnya; hasil akhir ke pengusul */
async function notifyRequest(
  tx: Tx,
  s: SchoolSession,
  r: { id: string; number: string | null; requestedBy: string },
  action: ReqAction,
  to: ReqStatus,
  flow: { mode: string; levels: number },
  reason: string | null,
) {
  const link = `/permintaan/${r.id}`;
  const no = r.number ?? "";
  const next: Partial<Record<ReqAction, Parameters<typeof userIdsWithRoles>[1]>> = {
    AJUKAN: ["PETUGAS"],
    TERUSKAN: flow.levels >= 2 ? ["VERIFIKATOR"] : ["KEPSEK"],
    VERIFIKASI: ["KEPSEK"],
    SETUJUI: ["PETUGAS"],
  };
  const roles = next[action];
  if (roles)
    await notifyUsers(tx, s.schoolId, await userIdsWithRoles(tx, roles), {
      title: `Nota permintaan ${no} menunggu tindakan Anda`,
      body: `${s.userName}: ${REQ_STATUS_LABEL[to]}.`,
      link,
    }, s.userId);
  if (["SETUJUI", "SALURKAN", "TOLAK", "KEMBALIKAN"].includes(action))
    await notifyUsers(tx, s.schoolId, [r.requestedBy], {
      title: `Nota permintaan ${no}: ${REQ_STATUS_LABEL[to]}`,
      body: reason ? `Alasan: ${reason}` : action === "SALURKAN" ? "Barang sudah disalurkan. Silakan diambil/diterima." : undefined,
      link,
    }, s.userId);
}

/** BAST hasil permintaan dibatalkan → nota kembali ke tahap sebelum disalurkan */
export async function reopenRequestOfCancelledDoc(tx: Tx, s: SchoolSession, docId: string) {
  const [d] = await tx.select({ requestId: stockDocs.requestId }).from(stockDocs).where(eq(stockDocs.id, docId));
  if (!d?.requestId) return;
  const [r] = await tx.select().from(supplyRequests).where(eq(supplyRequests.id, d.requestId)).for("update");
  if (!r || r.status !== "SELESAI" || r.issueDocId !== docId) return;
  const to: ReqStatus = r.mode === "LENGKAP" ? "DISETUJUI" : "DIAJUKAN";
  await tx.update(supplyRequestLines).set({ qtyIssued: null, ...(r.mode === "RINGKAS" ? { qtyApproved: null } : {}) }).where(eq(supplyRequestLines.requestId, r.id));
  await tx
    .update(supplyRequests)
    .set({ status: to, issueDocId: null, closedAt: null, updatedAt: new Date(), ...(r.mode === "RINGKAS" ? { approvedBy: null, approvedAt: null } : {}) })
    .where(eq(supplyRequests.id, r.id));
  await event(tx, s, r.id, "BAST_BATAL", "SELESAI", to, "BAST dibatalkan; menunggu penyaluran ulang");
}

/** Jumlah permintaan yang menunggu tindakan pengguna ini (untuk dasbor) */
export async function pendingForUser(tx: Tx, s: SchoolSession) {
  const [st] = await tx.select().from(schoolSettings);
  const rows = await tx
    .select({ status: supplyRequests.status, mode: supplyRequests.mode, levels: supplyRequests.levels, requestedBy: supplyRequests.requestedBy })
    .from(supplyRequests)
    .where(inArray(supplyRequests.status, ["DIAJUKAN", "DITERUSKAN", "DIVERIFIKASI", "DISETUJUI"]));
  return rows.filter((r) =>
    allowedActions(r.status, { mode: r.mode ?? st.distributionMode, levels: r.levels ?? st.approvalLevels }, s.roles, r.requestedBy === s.userId).some((a) => a !== "BATAL"),
  ).length;
}


