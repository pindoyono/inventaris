"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { processOutbox } from "@/lib/server/inbox";
import { addOpnameItem, approveOpname, cancelOpname, rejectOpname, saveCounts, startOpname, submitOpname } from "@/lib/server/opname";
import { cancelInventory, finishInventory, removeExtra, saveChecks, startInventory } from "@/lib/server/inventory";
import { actOnDisposal, saveDisposalDraft } from "@/lib/server/disposal";
import { finishMaintenance, recordMaintenance } from "@/lib/server/maintenance";
import { FileError, saveDocument } from "@/lib/server/files";
import { fieldErrors } from "@/lib/validations";

const AUDIT = ["ADMIN", "PETUGAS", "KEPSEK", "VERIFIKATOR"] as const;
const uuid = z.uuid();
const cond = z.enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const done = (path: string) => {
  revalidatePath(path, "layout");
  revalidatePath("/aset", "layout");
  revalidatePath("/persediaan", "layout");
  after(() => processOutbox().catch((e) => console.error("outbox", e)));
};

// ───────── stock opname
export async function startOpnameAction(_p: FormState, fd: FormData): Promise<FormState> {
  const wh = uuid.safeParse(fd.get("warehouseId"));
  if (!wh.success) return { errors: { _form: "Pilih gudang" } };
  let id = "";
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    const o = await startOpname(tx, s, wh.data, String(fd.get("note") ?? "").trim() || null);
    id = o.id;
    await logActivity(tx, s, "MULAI", "stock_opname", o.id, null, { number: o.number, warehouseId: wh.data });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  done("/audit");
  redirect(`/audit/opname/${id}`);
}

export async function opnameAction(
  id: string,
  input: { action: "SIMPAN" | "TAMBAH_BARANG" | "AJUKAN" | "SETUJUI" | "KEMBALIKAN" | "BATAL"; counts?: { lineId: string; physicalQty: string; damagedQty?: string; surplusPrice?: string; note?: string }[]; itemId?: string; reason?: string },
): Promise<FormState> {
  if (!uuid.safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    switch (input.action) {
      case "SIMPAN":
      case "AJUKAN":
        if (input.counts) await saveCounts(tx, s, id, input.counts);
        if (input.action === "AJUKAN") {
          await submitOpname(tx, s, id);
          await logActivity(tx, s, "AJUKAN", "stock_opname", id);
          return { ok: "Diajukan ke Kepala Sekolah." };
        }
        return { ok: "Hasil hitung tersimpan." };
      case "TAMBAH_BARANG":
        await addOpnameItem(tx, s, id, uuid.parse(input.itemId));
        return { ok: "Barang ditambahkan." };
      case "SETUJUI": {
        const docs = await approveOpname(tx, s, id);
        await logActivity(tx, s, "SETUJUI", "stock_opname", id, null, { docs });
        return { ok: docs.length ? `Disetujui. Penyesuaian: ${docs.join(", ")}.` : "Disetujui. Tidak ada selisih." };
      }
      case "KEMBALIKAN":
        await rejectOpname(tx, s, id, input.reason ?? "");
        return { ok: "Dikembalikan ke Petugas." };
      case "BATAL":
        await cancelOpname(tx, s, id);
        await logActivity(tx, s, "BATAL", "stock_opname", id);
        return { ok: "Stock opname dibatalkan; gudang dibuka kembali." };
    }
  });
  done("/audit");
  return res;
}

// ───────── inventarisasi aset
export async function startInventoryAction(_p: FormState, fd: FormData): Promise<FormState> {
  const room = uuid.safeParse(fd.get("roomId"));
  if (!room.success) return { errors: { _form: "Pilih ruangan" } };
  let id = "";
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    const v = await startInventory(tx, s, room.data, String(fd.get("note") ?? "").trim() || null);
    id = v.id;
    await logActivity(tx, s, "MULAI", "inventarisasi", v.id, null, { number: v.number, roomId: room.data });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  done("/audit");
  redirect(`/audit/inventarisasi/${id}`);
}

export async function inventoryAction(
  id: string,
  input: { action: "SIMPAN" | "SELESAI" | "HAPUS_EXTRA" | "BATAL"; checks?: { lineId: string; found: boolean | null; condition?: string | null; note?: string; followUp?: string | null }[]; extras?: { name: string; qty: number; note?: string }[]; lineId?: string },
): Promise<FormState> {
  if (!uuid.safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  const checks = z.array(z.object({ lineId: uuid, found: z.boolean().nullable(), condition: cond.nullable().optional(), note: z.string().max(200).optional(), followUp: z.enum(["REKLASIFIKASI", "KOREKSI"]).nullable().optional() })).safeParse(input.checks ?? []);
  if (!checks.success) return { errors: { _form: "Data pemeriksaan tidak valid" } };
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    if (input.action === "HAPUS_EXTRA") { await removeExtra(tx, s, id, uuid.parse(input.lineId)); return { ok: "Dihapus." }; }
    if (input.action === "BATAL") { await cancelInventory(tx, s, id); return { ok: "Inventarisasi dibatalkan." }; }
    await saveChecks(tx, s, id, checks.data, input.extras ?? []);
    if (input.action === "SELESAI") {
      const r = await finishInventory(tx, s, id);
      await logActivity(tx, s, "SELESAI", "inventarisasi", id, null, r);
      return { ok: `Selesai: ${r.checked} diperiksa, ${r.missing} tidak ditemukan, ${r.changed} berubah kondisi, ${r.recovered} ditemukan kembali, ${r.extras} belum tercatat.` };
    }
    return { ok: "Tersimpan." };
  });
  done("/audit");
  return res;
}

// ───────── usulan penghapusan
const disposalSchema = z.object({
  id: z.union([z.literal(""), uuid]).optional(),
  date,
  note: z.string().max(500).optional().transform((v) => v?.trim() || null),
  lines: z
    .array(z.object({ assetId: uuid, reason: z.enum(["RUSAK_BERAT", "USANG", "KECURIAN", "HILANG", "TERBAKAR_SUSUT", "KAHAR", "INVENTARISASI"]), followUp: z.enum(["PEMUSNAHAN", "PEMINDAHTANGANAN"]).optional(), transferForm: z.enum(["PENJUALAN", "TUKAR_MENUKAR", "HIBAH", "PENYERTAAN_MODAL"]).nullable().optional(), policeLetter: z.string().max(100).optional(), note: z.string().max(200).optional() }))
    .min(1, "Pilih minimal satu barang"),
});
export async function saveDisposalAction(payload: z.input<typeof disposalSchema>): Promise<FormState> {
  const p = disposalSchema.safeParse(payload);
  if (!p.success) return { errors: fieldErrors(p.error) };
  let id = "";
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    id = await saveDisposalDraft(tx, s, { ...p.data, id: p.data.id || undefined });
    await logActivity(tx, s, p.data.id ? "UBAH" : "TAMBAH", "usulan_penghapusan", id, null, { lines: p.data.lines.length });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  done("/audit");
  redirect(`/audit/penghapusan/${id}`);
}

export async function disposalAction(id: string, _p: FormState, fd: FormData): Promise<FormState> {
  if (!uuid.safeParse(id).success) return { errors: { _form: "Tidak valid" } };
  const action = z.enum(["AJUKAN", "KIRIM", "SK", "TOLAK", "BATAL"]).safeParse(fd.get("action"));
  if (!action.success) return { errors: { _form: "Tindakan tidak dikenal" } };
  let skFile: string | null = null;
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    const f = fd.get("skFile");
    if (action.data === "SK" && f instanceof File && f.size > 0) {
      try {
        skFile = await saveDocument(s.schoolId, "sk-penghapusan", f);
      } catch (e) {
        if (e instanceof FileError) return { errors: { _form: e.message } };
        throw e;
      }
    }
    const no = await actOnDisposal(tx, s, id, {
      action: action.data,
      letterNumber: String(fd.get("letterNumber") ?? ""), letterDate: String(fd.get("letterDate") ?? "") || undefined,
      skNumber: String(fd.get("skNumber") ?? ""), skDate: String(fd.get("skDate") ?? "") || undefined, skFile,
      approvedLineIds: action.data === "SK" ? fd.getAll("approved").map(String) : undefined,
      reason: String(fd.get("reason") ?? ""),
    });
    await logActivity(tx, s, action.data, "usulan_penghapusan", id, null, { number: no });
    return { ok: { AJUKAN: `Diajukan (${no}).`, KIRIM: "Tercatat dikirim ke Dinas/BPKAD.", SK: "SK dicatat; barang yang disetujui dihapus dari daftar barang.", TOLAK: "Usulan ditolak; status barang dipulihkan.", BATAL: "Draf dibatalkan." }[action.data] };
  });
  done("/audit");
  return res;
}

// ───────── pemeliharaan
const maintSchema = z.object({
  assetId: uuid,
  kind: z.enum(["RUTIN", "PERBAIKAN", "PENINGKATAN"]),
  startDate: date,
  executor: z.string().max(150).optional().transform((v) => v?.trim() || null),
  description: z.string().trim().min(5, "Isi uraian pekerjaan").max(500),
  cost: z.string().optional(),
  fundingSourceId: z.union([z.literal(""), uuid]).optional().transform((v) => v || null),
  fundingComponentId: z.union([z.literal(""), uuid]).optional().transform((v) => v || null),
  finishNow: z.literal("on").optional(),
  capitalize: z.literal("on").optional(),
  endDate: z.union([z.literal(""), date]).optional(),
  conditionAfter: z.union([z.literal(""), cond]).optional(),
});
export async function recordMaintenanceAction(_p: FormState, fd: FormData): Promise<FormState> {
  const raw = Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$"))) as Record<string, string>;
  const p = maintSchema.safeParse(raw);
  if (!p.success) return { values: raw, errors: fieldErrors(p.error) };
  const d = p.data;
  if (d.finishNow && (!d.endDate || !d.conditionAfter)) return { values: raw, errors: { endDate: "Isi tanggal selesai & kondisi sesudah" } };
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    const id = await recordMaintenance(tx, s, { ...d, capitalize: !!d.finishNow && !!d.capitalize, finish: d.finishNow ? { endDate: d.endDate!, conditionAfter: d.conditionAfter as "BAIK" } : null });
    await logActivity(tx, s, "TAMBAH", "pemeliharaan", id, null, d);
    return { ok: "ok" };
  });
  if (res.errors) return { ...res, values: raw };
  done("/audit");
  redirect(`/aset/${d.assetId}`);
}

export async function finishMaintenanceAction(id: string, input: { endDate: string; conditionAfter: string; cost?: string; capitalize?: boolean }): Promise<FormState> {
  const p = z.object({ endDate: date, conditionAfter: cond, cost: z.string().optional(), capitalize: z.boolean().optional() }).safeParse(input);
  if (!p.success || !uuid.safeParse(id).success) return { errors: { _form: "Isi tanggal selesai & kondisi" } };
  const res = await runSchoolAction([...AUDIT], async (tx, s) => {
    await finishMaintenance(tx, s, id, p.data);
    await logActivity(tx, s, "SELESAI", "pemeliharaan", id, null, p.data);
    return { ok: p.data.capitalize ? "Selesai; biaya ditambahkan ke nilai aset." : "Pemeliharaan selesai; aset kembali digunakan." };
  });
  done("/audit");
  return res;
}

/** Aset yang bisa diusulkan hapus (digunakan/hilang/dalam pemeliharaan), untuk pemilih barang */
export async function searchDisposableAssets(q: string, preset?: "RUSAK_BERAT" | "HILANG") {
  const { requireSchoolUser, withSchool } = await import("@/lib/tenant");
  const { assets, rooms } = await import("@/db/schema");
  const { and, asc, eq, ilike, inArray, or, sql } = await import("drizzle-orm");
  const s = await requireSchoolUser(["ADMIN", "PETUGAS", "KEPSEK"]);
  const term = q.trim().slice(0, 60);
  if (!preset && term.length < 2) return [];
  const e = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  return withSchool(s.schoolId, (tx) =>
    tx
      .select({ id: assets.id, name: assets.name, brand: assets.brand, bmdCode: assets.bmdCode, regNo: assets.regNo, condition: assets.condition, status: assets.status, acqDate: assets.acqDate, acqPrice: assets.acqPrice, room: rooms.name })
      .from(assets)
      .leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(
        and(
          inArray(assets.status, ["DIGUNAKAN", "HILANG", "DALAM_PEMELIHARAAN"]),
          preset === "RUSAK_BERAT" ? eq(assets.condition, "RUSAK_BERAT") : preset === "HILANG" ? eq(assets.status, "HILANG") : undefined,
          term ? or(ilike(assets.name, e), ilike(assets.brand, e), sql`lpad(${assets.regNo}::text, 6, '0') like ${e}`) : undefined,
        ),
      )
      .orderBy(asc(assets.name), asc(assets.regNo))
      .limit(100),
  );
}
