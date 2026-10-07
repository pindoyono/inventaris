"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { assets, rooms, schools } from "@/db/schema";
import { db } from "@/db";
import { runSchoolAction, type FormState } from "@/lib/server/action";
import { logActivity } from "@/lib/server/activity";
import { notifyUsers, userIdsWithRoles } from "@/lib/server/inbox";
import { cancelTransfer, createTransfer, handOverTransfer, receiveTransfer, rejectTransfer } from "@/lib/server/transfers";
import { requireSchoolUser, withSchool } from "@/lib/tenant";
import { fieldErrors } from "@/lib/validations";

const ROLES = ["ADMIN", "PETUGAS"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal");
const optDate = z.union([z.literal(""), z.null(), date]).optional().transform((v) => v || null);
const optText = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => v || null);

/** Barang yang bisa diserahkan (digunakan/dalam pemeliharaan, bukan KDP) */
export async function searchTransferableAssets(q: string) {
  const s = await requireSchoolUser([...ROLES]);
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const e = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  return withSchool(s.schoolId, (tx) =>
    tx
      .select({ id: assets.id, name: assets.name, brand: assets.brand, bmdCode: assets.bmdCode, regNo: assets.regNo, acqPrice: assets.acqPrice, room: rooms.name })
      .from(assets)
      .leftJoin(rooms, eq(rooms.id, assets.roomId))
      .where(and(inArray(assets.status, ["DIGUNAKAN", "DALAM_PEMELIHARAAN"]), ne(assets.kib, "F"), or(ilike(assets.name, e), ilike(assets.brand, e), ilike(assets.bmdCode, e), sql`lpad(${assets.regNo}::text, 6, '0') like ${e}`)))
      .orderBy(asc(assets.name), asc(assets.regNo))
      .limit(60),
  );
}

const schema = z.object({
  toSchoolId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  toName: optText(200),
  date,
  reason: z.string().trim().min(5, "Isi alasan (min. 5 karakter)").max(500),
  approvalNo: optText(100),
  approvalDate: optDate,
  note: optText(500),
  assetIds: z.array(z.uuid()).min(1, "Pilih minimal satu barang").max(500),
});
export type TransferPayload = z.input<typeof schema>;

export async function createTransferAction(payload: TransferPayload): Promise<FormState> {
  const p = schema.safeParse(payload);
  if (!p.success) return { errors: fieldErrors(p.error) };
  let id = "";
  const res = await runSchoolAction([...ROLES], async (tx, s) => {
    id = await createTransfer(tx, s, p.data);
    await logActivity(tx, s, "TAMBAH", "pengalihan", id, null, { toSchoolId: p.data.toSchoolId, toName: p.data.toName, n: p.data.assetIds.length });
    return { ok: "ok" };
  });
  if (res.errors) return res;
  revalidatePath("/aset", "layout");
  redirect(`/aset/pengalihan/${id}`);
}

/** Pemberitahuan ke sekolah lain (transaksi terpisah dalam konteks sekolah tersebut) */
async function notifySchool(schoolId: string, msg: { title: string; body?: string; link: string }) {
  try {
    await withSchool(schoolId, async (tx) => notifyUsers(tx, schoolId, await userIdsWithRoles(tx, ["ADMIN", "PETUGAS", "KEPSEK"]), msg));
  } catch (e) {
    console.error("notifikasi pengalihan", e);
  }
}

const stepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("serahkan"), bastNo: z.string().trim().min(3, "Isi nomor BAST").max(100), bastDate: date, approvalNo: optText(100), approvalDate: optDate }),
  z.object({ step: z.literal("batal"), reason: z.string().trim().min(5, "Isi alasan").max(300) }),
  z.object({ step: z.literal("terima"), date, roomId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null), note: optText(300) }),
  z.object({ step: z.literal("tolak"), reason: z.string().trim().min(5, "Isi alasan").max(300) }),
]);

export async function transferStepAction(id: string, input: Record<string, string>): Promise<FormState> {
  const p = stepSchema.safeParse(input);
  if (!z.uuid().safeParse(id).success || !p.success) return { errors: p.success ? { _form: "Tidak valid" } : fieldErrors(p.error) };
  const d = p.data;
  let after: (() => Promise<void>) | null = null;
  const res = await runSchoolAction(d.step === "batal" || d.step === "terima" || d.step === "tolak" ? [...ROLES] : ["ADMIN", "PETUGAS", "KEPSEK"], async (tx, s) => {
    const [me] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, s.schoolId));
    let ok = "";
    switch (d.step) {
      case "serahkan": {
        const r = await handOverTransfer(tx, s, id, d);
        ok = `Diserahkan (${r.number}); barang keluar dari daftar barang sekolah.`;
        if (r.toSchoolId) after = () => notifySchool(r.toSchoolId!, { title: `Penerimaan barang dari ${me?.name}`, body: `BAST ${d.bastNo}. Catat penerimaan di Aset › Pengalihan.`, link: `/aset/pengalihan/${id}` });
        break;
      }
      case "batal":
        await cancelTransfer(tx, s, id, d.reason);
        ok = "Pengalihan dibatalkan; barang kembali ke daftar.";
        break;
      case "terima": {
        const r = await receiveTransfer(tx, s, id, d);
        ok = `${r.count} barang dicatat sebagai penerimaan internal.`;
        after = () => notifySchool(r.fromSchoolId, { title: `${me?.name} telah menerima barang`, link: `/aset/pengalihan/${id}` });
        break;
      }
      case "tolak": {
        const r = await rejectTransfer(tx, s, id, d.reason);
        ok = "Penyerahan ditolak; sekolah pengirim diberi tahu.";
        after = () => notifySchool(r.fromSchoolId, { title: `${me?.name} menolak penerimaan barang`, body: d.reason, link: `/aset/pengalihan/${id}` });
        break;
      }
    }
    await logActivity(tx, s, d.step.toUpperCase(), "pengalihan", id, null, d);
    return { ok };
  });
  if (!res.errors && after) await (after as () => Promise<void>)();
  revalidatePath("/aset", "layout");
  return res;
}
