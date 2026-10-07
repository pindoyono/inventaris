import "server-only";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db";
import { db } from "@/db";
import { assets, bmdCodes, buildings, fundingSources, localBmdCodes, rooms, supplyItems, uoms, userRoles, users, userUnits, units, warehouses } from "@/db/schema";
import { createAssets } from "@/lib/server/assets";
import { postDoc, todayWita } from "@/lib/server/ledger";
import { createSupplyItem, saveDraftDoc } from "@/lib/server/supply";
import { kibOfCode, kodeBarangInternal } from "@/lib/assets-shared";
import { normalizeIdNumber, parseDec, toDec } from "@/lib/decimal";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import type { SchoolSession } from "@/lib/tenant";
import type { ImportKind } from "./spec";

export type Row = { row: number; data: Record<string, string>; errors: string[] };
const low = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function dateOf(v: string): string | null {
  const s = v.trim();
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); // dd/mm/yyyy (Indonesia)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
const validDate = (d: string) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
function money(v: string): bigint | null {
  try {
    const n = parseDec(normalizeIdNumber(v.replace(/^rp\.?\s*/i, "")));
    return n >= 0n ? n : null;
  } catch {
    return null;
  }
}
const COND: Record<string, "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT"> = { b: "BAIK", baik: "BAIK", rr: "RUSAK_RINGAN", "rusak ringan": "RUSAK_RINGAN", rb: "RUSAK_BERAT", "rusak berat": "RUSAK_BERAT" };
const ACQ: Record<string, string> = { pembelian: "PEMBELIAN", beli: "PEMBELIAN", hibah: "HIBAH", sumbangan: "HIBAH", "hibah/sumbangan": "HIBAH", produksi: "PRODUKSI", inventarisasi: "INVENTARISASI", "hasil inventarisasi": "INVENTARISASI", lainnya: "LAINNYA" };
const ROLE_BY_NAME = Object.fromEntries([
  ...ROLES.map((r) => [low(r), r]),
  ...ROLES.map((r) => [low(ROLE_LABEL[r]), r]),
  ["admin", "ADMIN"], ["kepala sekolah", "KEPSEK"], ["kepsek", "KEPSEK"], ["petugas", "PETUGAS"], ["petugas barang", "PETUGAS"], ["pengurus barang", "PETUGAS"],
]) as Record<string, Role>;

/** Register: "21", "000021", "000021 s/d 000044", "21-44" → { start, end } */
function regRange(v: string) {
  const m = /^0*(\d{1,6})\s*(?:(?:s\/d|sd|-|–|sampai)\s*0*(\d{1,6}))?$/i.exec(v.trim());
  return m ? { start: Number(m[1]), end: m[2] ? Number(m[2]) : null } : null;
}

/** Validasi semua baris terhadap data sekolah saat ini (dalam withSchool). Tidak menyimpan apa pun. */
export async function validateRows(tx: Tx, kind: ImportKind, input: { row: number; data: Record<string, string> }[]): Promise<Row[]> {
  const out: Row[] = input.map((r) => ({ ...r, errors: [] }));
  const req = (r: Row, key: string, label: string) => { if (!r.data[key]?.trim()) r.errors.push(`${label} wajib diisi`); };

  if (kind === "ruangan") {
    const existing = new Set((await tx.select({ n: rooms.name }).from(rooms)).map((x) => low(x.n)));
    const seen = new Set<string>();
    for (const r of out) {
      req(r, "nama", "Nama ruangan");
      const n = low(r.data.nama ?? "");
      if (n && existing.has(n)) r.errors.push("Ruangan dengan nama ini sudah ada");
      if (n && seen.has(n)) r.errors.push("Nama ruangan ganda di berkas");
      seen.add(n);
      if (r.data.nip_pj && !/^\d{18}$/.test(r.data.nip_pj.replace(/\s/g, ""))) r.errors.push("NIP penanggung jawab harus 18 digit");
    }
  }

  if (kind === "pengguna") {
    const taken = new Set((await tx.select({ u: users.username }).from(users)).map((x) => low(x.u)));
    const unitNames = new Map((await tx.select({ id: units.id, n: units.name }).from(units)).map((x) => [low(x.n), x.id]));
    const seen = new Set<string>();
    for (const r of out) {
      req(r, "nama", "Nama"); req(r, "username", "Username"); req(r, "peran", "Peran");
      const u = (r.data.username ?? "").trim();
      if (u && !/^[a-zA-Z0-9._-]{3,30}$/.test(u)) r.errors.push("Username 3–30 karakter: huruf, angka, titik, minus, garis bawah");
      if (u && taken.has(low(u))) r.errors.push("Username sudah dipakai");
      if (u && seen.has(low(u))) r.errors.push("Username ganda di berkas");
      seen.add(low(u));
      const roles = (r.data.peran ?? "").split(/[,;]/).map(low).filter(Boolean);
      const bad = roles.filter((x) => !ROLE_BY_NAME[x]);
      if (bad.length) r.errors.push(`Peran tidak dikenal: ${bad.join(", ")}`);
      const un = (r.data.unit ?? "").split(/[,;]/).map(low).filter(Boolean).filter((x) => !unitNames.has(x));
      if (un.length) r.errors.push(`Unit belum ada: ${un.join(", ")}`);
      if (r.data.nip && !/^\d{18}$/.test(r.data.nip.replace(/\s/g, ""))) r.errors.push("NIP harus 18 digit");
      if (r.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.data.email)) r.errors.push("Email tidak valid");
      if (r.data.password && r.data.password.length < 8) r.errors.push("Password awal minimal 8 karakter");
    }
  }

  if (kind === "aset") {
    // Terima kode format SIMDA (rincian/sub rincian 3 digit) maupun Permendagri 108 (2 digit)
    for (const r of out) if (r.data.kode) r.data.kode = kodeBarangInternal(r.data.kode);
    const codes = [...new Set(out.map((r) => (r.data.kode ?? "").trim()).filter(Boolean))];
    const off = codes.length ? await db.select().from(bmdCodes).where(inArray(bmdCodes.code, codes)) : [];
    const loc = codes.length ? await tx.select().from(localBmdCodes).where(inArray(localBmdCodes.code, codes)) : [];
    const roomNames = new Set((await tx.select({ n: rooms.name }).from(rooms)).map((x) => low(x.n)));
    const funds = await tx.select({ code: fundingSources.code, n: fundingSources.name }).from(fundingSources);
    const usedRegs = new Map<string, Set<number>>(); // kode → nomor register sudah dipakai (DB + berkas)
    for (const code of codes) {
      const regs = await tx.select({ n: assets.regNo }).from(assets).where(eq(assets.bmdCode, code));
      usedRegs.set(code, new Set(regs.map((x) => x.n)));
    }
    const today = todayWita();
    for (const r of out) {
      const d = r.data;
      req(r, "kode", "Kode barang"); req(r, "nama", "Nama barang"); req(r, "tanggal", "Tanggal perolehan"); req(r, "harga", "Harga satuan");
      const code = (d.kode ?? "").trim();
      if (code) {
        const o = off.find((x) => x.code === code);
        const isLocal = loc.some((x) => x.code === code) && kibOfCode(code);
        if (!o && !isLocal) r.errors.push("Kode barang tidak ditemukan di Permendagri 108/2016");
        else if (o && (!o.selectable || !o.class || o.class === "PERSEDIAAN")) r.errors.push("Bukan kode aset tetap tingkat 7 (golongan A–F)");
      }
      if (d.tanggal) {
        const t = dateOf(d.tanggal);
        if (!t || !validDate(t)) r.errors.push("Tanggal perolehan tidak valid (pakai 2024-03-15, 15/03/2024, atau tahun saja)");
        else if (t > today) r.errors.push("Tanggal perolehan di masa depan");
      }
      if (d.harga && money(d.harga) === null) r.errors.push("Harga tidak valid");
      const qty = d.jumlah ? Number(d.jumlah.replace(/\D/g, "")) : 1;
      if (!(qty >= 1 && qty <= 500)) r.errors.push("Jumlah 1–500");
      if (d.ruangan && !roomNames.has(low(d.ruangan))) r.errors.push(`Ruangan "${d.ruangan}" belum ada (impor ruangan dulu)`);
      if (d.kondisi && !COND[low(d.kondisi)]) r.errors.push("Kondisi: Baik / Rusak Ringan / Rusak Berat");
      if (d.asal && !ACQ[low(d.asal)]) r.errors.push("Cara perolehan: Pembelian / Hibah / Produksi / Inventarisasi / Lainnya");
      if (d.dana && !funds.some((f) => low(f.code) === low(d.dana) || low(f.n) === low(d.dana))) r.errors.push(`Sumber dana "${d.dana}" tidak ada di Data Dasar`);
      if (d.register) {
        const rr = regRange(d.register);
        if (!rr) r.errors.push("Nomor register tidak valid");
        else if (rr.end !== null && rr.end - rr.start + 1 !== qty) r.errors.push(`Rentang register ${rr.end - rr.start + 1} unit tidak sama dengan jumlah ${qty}`);
        else if (code && usedRegs.has(code)) {
          const set = usedRegs.get(code)!;
          const clash = Array.from({ length: qty }, (_, k) => rr.start + k).filter((n) => set.has(n));
          if (clash.length) r.errors.push(`Nomor register sudah dipakai: ${clash.slice(0, 3).map((n) => String(n).padStart(6, "0")).join(", ")}`);
          else for (let k = 0; k < qty; k++) set.add(rr.start + k);
        }
      }
    }
  }

  if (kind === "persediaan") {
    const codes = [...new Set(out.map((r) => (r.data.kode ?? "").trim()).filter(Boolean))];
    const off = codes.length ? await db.select().from(bmdCodes).where(inArray(bmdCodes.code, codes)) : [];
    const loc = codes.length ? await tx.select().from(localBmdCodes).where(inArray(localBmdCodes.code, codes)) : [];
    const whNames = new Set((await tx.select({ n: warehouses.name }).from(warehouses)).map((x) => low(x.n)));
    const today = todayWita();
    const seenDoc = new Set<string>();
    for (const r of out) {
      const d = r.data;
      req(r, "kode", "Kode barang"); req(r, "nama", "Nama barang"); req(r, "satuan", "Satuan");
      const code = (d.kode ?? "").trim();
      if (code) {
        const o = off.find((x) => x.code === code);
        if (!o && !(loc.some((x) => x.code === code) && code.startsWith("1.1.7."))) r.errors.push("Kode barang persediaan tidak ditemukan");
        else if (o && (o.class !== "PERSEDIAAN" || o.level !== 7)) r.errors.push("Bukan kode persediaan tingkat 7 (1.1.7.xx.xx.xx.xxx)");
      }
      if (d.gudang && !whNames.has(low(d.gudang))) r.errors.push(`Gudang "${d.gudang}" belum ada`);
      if (d.stok_min && money(d.stok_min) === null) r.errors.push("Stok minimum tidak valid");
      const q = d.jumlah ? money(d.jumlah) : 0n;
      if (q === null) r.errors.push("Jumlah saldo awal tidak valid");
      if (q && q > 0n) {
        if (!d.harga || money(d.harga) === null) r.errors.push("Harga satuan wajib untuk saldo awal");
        const t = d.tanggal ? dateOf(d.tanggal) : today;
        if (!t || !validDate(t)) r.errors.push("Tanggal saldo awal tidak valid");
        else if (t > today) r.errors.push("Tanggal saldo awal di masa depan");
        const k = `${low(d.gudang ?? "")}|${t}|${low(d.nama ?? "")}`;
        if (seenDoc.has(k)) r.errors.push("Barang yang sama muncul dua kali pada gudang & tanggal yang sama");
        seenDoc.add(k);
      }
    }
  }
  return out;
}

/** Proses baris valid dalam satu transaksi. Mengembalikan ringkasan (+ password awal yang dibuat otomatis). */
export async function applyRows(tx: Tx, s: SchoolSession, kind: ImportKind, rows: Row[]) {
  const ok = rows.filter((r) => !r.errors.length);
  const result: { created: number; detail: string[]; passwords?: { username: string; password: string }[] } = { created: 0, detail: [] };

  if (kind === "ruangan") {
    const bmap = new Map((await tx.select({ id: buildings.id, n: buildings.name }).from(buildings)).map((x) => [low(x.n), x.id]));
    const umap = new Map((await tx.select({ id: units.id, n: units.name }).from(units)).map((x) => [low(x.n), x.id]));
    for (const { data: d } of ok) {
      let buildingId: string | null = null, unitId: string | null = null;
      if (d.gedung) {
        buildingId = bmap.get(low(d.gedung)) ?? null;
        if (!buildingId) { [{ id: buildingId }] = await tx.insert(buildings).values({ schoolId: s.schoolId, name: d.gedung.trim() }).returning({ id: buildings.id }); bmap.set(low(d.gedung), buildingId!); result.detail.push(`Gedung baru: ${d.gedung}`); }
      }
      if (d.unit) {
        unitId = umap.get(low(d.unit)) ?? null;
        if (!unitId) { [{ id: unitId }] = await tx.insert(units).values({ schoolId: s.schoolId, name: d.unit.trim() }).returning({ id: units.id }); umap.set(low(d.unit), unitId!); result.detail.push(`Unit baru: ${d.unit}`); }
      }
      await tx.insert(rooms).values({ schoolId: s.schoolId, name: d.nama.trim(), code: d.kode || null, floor: d.lantai || null, buildingId, unitId, picName: d.pj || null, picNip: d.nip_pj?.replace(/\s/g, "") || null });
      result.created++;
    }
  }

  if (kind === "pengguna") {
    const umap = new Map((await tx.select({ id: units.id, n: units.name }).from(units)).map((x) => [low(x.n), x.id]));
    result.passwords = [];
    for (const { data: d } of ok) {
      const given = d.password || "";
      const pw = given || Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
      const hash = d.password_hash || (await bcrypt.hash(pw, 10));
      const [u] = await tx
        .insert(users)
        .values({ schoolId: s.schoolId, username: d.username.trim(), name: d.nama.trim(), nip: d.nip?.replace(/\s/g, "") || null, email: d.email || null, passwordHash: hash, mustChangePassword: true })
        .returning({ id: users.id });
      const roles = [...new Set(d.peran.split(/[,;]/).map(low).filter(Boolean).map((x) => ROLE_BY_NAME[x]))];
      await tx.insert(userRoles).values(roles.map((role) => ({ schoolId: s.schoolId, userId: u.id, role })));
      const unitIds = (d.unit ?? "").split(/[,;]/).map(low).filter(Boolean).map((x) => umap.get(x)!);
      if (unitIds.length) await tx.insert(userUnits).values(unitIds.map((unitId) => ({ schoolId: s.schoolId, userId: u.id, unitId })));
      if (!given && !d.password_hash) result.passwords.push({ username: d.username.trim(), password: pw });
      result.created++;
    }
  }

  if (kind === "aset") {
    const rmap = new Map((await tx.select({ id: rooms.id, n: rooms.name }).from(rooms)).map((x) => [low(x.n), x.id]));
    const funds = await tx.select({ id: fundingSources.id, code: fundingSources.code, n: fundingSources.name }).from(fundingSources);
    for (const { data: d } of ok) {
      const qty = d.jumlah ? Number(d.jumlah.replace(/\D/g, "")) : 1;
      const rr = d.register ? regRange(d.register) : null;
      const f = d.dana ? funds.find((x) => low(x.code) === low(d.dana) || low(x.n) === low(d.dana)) : null;
      const attrs: Record<string, string> = {};
      for (const [k, a] of [["ukuran", "ukuran"], ["bahan", "bahan"], ["no_pabrik", "noPabrik"], ["no_rangka", "noRangka"], ["no_mesin", "noMesin"], ["no_polisi", "noPolisi"], ["no_bpkb", "noBpkb"], ["luas", "luas"], ["alamat", "alamat"]])
        if (d[k]) attrs[a] = d[k];
      const r = await createAssets(tx, s, {
        bmdCode: d.kode.trim(), name: d.nama.trim(), brand: d.merk || null, attrs, acqDate: dateOf(d.tanggal)!, acqPrice: toDec(money(d.harga)!),
        acquisition: d.asal ? ACQ[low(d.asal)] : "PEMBELIAN", fundingSourceId: f?.id ?? null, fundingComponentId: null, vendorId: null, refNumber: null,
        roomId: d.ruangan ? rmap.get(low(d.ruangan))! : null, unitId: null, condition: d.kondisi ? COND[low(d.kondisi)] : "BAIK", note: d.keterangan || "Impor dari Excel", qty, startRegNo: rr?.start ?? null,
      });
      result.created += r.ids.length;
    }
    result.detail.push(`${ok.length} baris → ${result.created} unit aset`);
  }

  if (kind === "persediaan") {
    const uomMap = new Map((await tx.select({ id: uoms.id, n: uoms.name }).from(uoms)).map((x) => [low(x.n), x.id]));
    const whs = await tx.select({ id: warehouses.id, n: warehouses.name, def: warehouses.isDefault }).from(warehouses);
    const defWh = (whs.find((w) => w.def) ?? whs[0]).id;
    const itemByName = new Map((await tx.select({ id: supplyItems.id, n: supplyItems.name }).from(supplyItems)).map((x) => [low(x.n), x.id]));
    const docs = new Map<string, { warehouseId: string; date: string; lines: { itemId: string; qty: string; unitPrice: string }[] }>();
    let newItems = 0;
    for (const { data: d } of ok) {
      let uomId = uomMap.get(low(d.satuan));
      if (!uomId) { [{ id: uomId }] = await tx.insert(uoms).values({ schoolId: s.schoolId, name: d.satuan.trim().slice(0, 30) }).returning({ id: uoms.id }); uomMap.set(low(d.satuan), uomId!); result.detail.push(`Satuan baru: ${d.satuan}`); }
      let itemId = itemByName.get(low(d.nama));
      if (!itemId) {
        const it = await createSupplyItem(tx, s.schoolId, { bmdCode: d.kode.trim(), name: d.nama.trim(), spec: d.spesifikasi || null, uomId: uomId!, minStock: d.stok_min ? toDec(money(d.stok_min)!) : "0" });
        itemId = it.id; itemByName.set(low(d.nama), itemId); newItems++;
      }
      const q = d.jumlah ? money(d.jumlah)! : 0n;
      if (q > 0n) {
        const wh = d.gudang ? whs.find((w) => low(w.n) === low(d.gudang))!.id : defWh;
        const date = d.tanggal ? dateOf(d.tanggal)! : todayWita();
        const k = `${wh}|${date}`;
        if (!docs.has(k)) docs.set(k, { warehouseId: wh, date, lines: [] });
        docs.get(k)!.lines.push({ itemId: itemId!, qty: toDec(q), unitPrice: toDec(money(d.harga)!) });
      }
    }
    const numbers: string[] = [];
    for (const doc of [...docs.values()].sort((a, b) => a.date.localeCompare(b.date))) {
      const id = await saveDraftDoc(tx, s.schoolId, s.userId, { kind: "SALDO_AWAL", date: doc.date, warehouseId: doc.warehouseId, note: "Impor dari Excel", lines: doc.lines });
      numbers.push(await postDoc(tx, s.schoolId, s.userId, id));
    }
    result.created = newItems;
    result.detail.push(`${newItems} barang baru`, numbers.length ? `Saldo awal diposting: ${numbers.join(", ")}` : "Tanpa saldo awal");
  }
  return result;
}


