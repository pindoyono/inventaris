import "server-only";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { Tx } from "@/db";
import {
  activityLogs,
  favoriteBmdCodes,
  fundingComponents,
  fundingSources,
  regions,
  schoolSettings,
  schools,
  uoms,
  userRoles,
  users,
  warehouses,
} from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { ownershipCodeFor, type RegistrationInput } from "@/lib/validations";
import bos from "../../../data/bos/sumber-dana-bosp-2026.json";
import favorit from "../../../data/bmd/favorit-per-jenjang.json";

export const DEFAULT_UOMS = [
  "Buah", "Unit", "Set", "Pasang", "Lembar", "Rim", "Pak", "Dus", "Kotak", "Botol", "Liter",
  "Kilogram", "Meter", "Roll", "Batang", "Eksemplar", "Paket", "Lusin",
];

export class NpsnTakenError extends Error {}
export class RegionError extends Error {}

/**
 * Daftarkan sekolah baru (status PENDING) beserta data awalnya dalam satu transaksi:
 * pengaturan, admin sekolah, satuan, gudang utama, sumber dana BOSP, dan kode barang favorit.
 */
export async function registerSchool(input: RegistrationInput) {
  const schoolId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  return withSchool(schoolId, async (tx) => {
    const [taken] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.npsn, input.npsn));
    if (taken) throw new NpsnTakenError();

    const [regency] = await tx.select().from(regions).where(eq(regions.code, input.regencyCode));
    const [province] = await tx.select().from(regions).where(eq(regions.code, input.provinceCode));
    if (!regency || !province || regency.parentCode !== province.code) throw new RegionError();

    const ownershipCode = ownershipCodeFor(input.level);
    await tx.insert(schools).values({
      id: schoolId,
      npsn: input.npsn,
      name: input.name,
      shortName: input.shortName,
      level: input.level,
      provinceCode: input.provinceCode,
      regencyCode: input.regencyCode,
      address: input.address ?? null,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      ownershipCode,
    });

    await tx.insert(schoolSettings).values({
      schoolId,
      // SD/SMP milik kabupaten/kota, SMA/SMK/SLB milik provinsi
      pemdaName: ownershipCode === "12" ? `Pemerintah ${regency.name}` : `Pemerintah Provinsi ${province.name}`,
      dinasName: "Dinas Pendidikan",
      addressFull: input.address ?? null,
    });

    const [admin] = await tx
      .insert(users)
      .values({ schoolId, username: input.adminUsername, name: input.adminName, passwordHash })
      .returning({ id: users.id });
    await tx.insert(userRoles).values({ schoolId, userId: admin.id, role: "ADMIN" });

    await seedSchoolDefaults(tx, schoolId, input.level);

    await tx.insert(activityLogs).values({
      schoolId,
      userId: admin.id,
      userName: input.adminName,
      action: "DAFTAR",
      entity: "school",
      entityId: schoolId,
      after: { npsn: input.npsn, name: input.name, level: input.level },
    });

    return { schoolId, regencyName: regency.name };
  });
}

/** Data awal per sekolah. Idempoten (aman diulang). Harus dipanggil di dalam withSchool(schoolId). */
export async function seedSchoolDefaults(tx: Tx, schoolId: string, level: RegistrationInput["level"]) {
  await tx
    .insert(uoms)
    .values(DEFAULT_UOMS.map((name) => ({ schoolId, name })))
    .onConflictDoNothing();

  await tx.insert(warehouses).values({ schoolId, name: "Gudang Utama", isDefault: true }).onConflictDoNothing();

  const sources = [
    ...bos.sumber_dana.map((s) => ({ code: s.kode, name: s.nama, komponen: s.komponen })),
    ...bos.sumber_dana_lain_bawaan.map((s) => ({ code: s.kode, name: s.nama, komponen: [] as string[] })),
  ];
  for (const s of sources) {
    await tx.insert(fundingSources).values({ schoolId, code: s.code, name: s.name }).onConflictDoNothing();
    if (!s.komponen.length) continue;
    const [src] = await tx
      .select({ id: fundingSources.id })
      .from(fundingSources)
      .where(eq(fundingSources.code, s.code));
    await tx
      .insert(fundingComponents)
      .values(s.komponen.map((name) => ({ schoolId, fundingSourceId: src.id, name })))
      .onConflictDoNothing();
  }

  const codes = new Set([...favorit.umum, ...(favorit[level] ?? [])]);
  await tx
    .insert(favoriteBmdCodes)
    .values([...codes].map((code) => ({ schoolId, code })))
    .onConflictDoNothing();
}
