import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { favoriteBmdCodes, fundingComponents, fundingSources, schoolSettings, schools, uoms, userRoles, users, warehouses } from "@/db/schema";
import { withSchool } from "@/lib/tenant-core";
import { NpsnTakenError, RegionError, DEFAULT_UOMS } from "@/lib/server/provision";
import { registrationSchema } from "@/lib/validations";
import { makeSchool, owner, resetTestData } from "./helpers";

beforeAll(resetTestData);

describe("pendaftaran sekolah", () => {
  test("membuat sekolah PENDING beserta data awal", async () => {
    const { schoolId, input } = await makeSchool({ level: "SMP", name: "SMP Negeri Tes" });
    const [s] = await db.select().from(schools).where(eq(schools.id, schoolId));
    expect(s.status).toBe("PENDING");
    expect(s.ownershipCode).toBe("12"); // SMP milik kabupaten/kota

    await withSchool(schoolId, async (tx) => {
      const [st] = await tx.select().from(schoolSettings);
      expect(st.pemdaName).toBe("Pemerintah Kabupaten Malinau");
      expect(st.capitalization).toEqual({ default: 2_000_000 });
      expect(st.kodeSubKuasa).toBe("00000");

      const [admin] = await tx.select().from(users);
      expect(admin.username).toBe(input.adminUsername);
      expect(await bcrypt.compare(input.adminPassword, admin.passwordHash)).toBe(true);
      expect((await tx.select().from(userRoles)).map((r) => r.role)).toEqual(["ADMIN"]);

      expect((await tx.select().from(uoms)).length).toBe(DEFAULT_UOMS.length);
      const wh = await tx.select().from(warehouses);
      expect(wh.map((w) => [w.name, w.isDefault])).toEqual([["Gudang Utama", true]]);
      const src = await tx.select().from(fundingSources);
      expect(src.map((x) => x.code).sort()).toEqual(["APBD", "BOS_AFIRMASI", "BOS_KINERJA", "BOS_REGULER", "DAK", "HIBAH", "LAINNYA"]);
      expect((await tx.select().from(fundingComponents)).length).toBe(12 + 4 + 2);
      const fav = await tx.select().from(favoriteBmdCodes);
      expect(fav.length).toBeGreaterThan(50);
    });
  });

  test("SMA/SMK/SLB milik provinsi", async () => {
    const { schoolId } = await makeSchool({ level: "SMK", name: "SMK Negeri Tes" });
    const [s] = await db.select().from(schools).where(eq(schools.id, schoolId));
    expect(s.ownershipCode).toBe("11");
    const [st] = await withSchool(schoolId, (tx) => tx.select().from(schoolSettings));
    expect(st.pemdaName).toBe("Pemerintah Provinsi Kalimantan Utara");
  });

  test("NPSN yang sama ditolak", async () => {
    const { input } = await makeSchool();
    await expect(makeSchool({ npsn: input.npsn })).rejects.toBeInstanceOf(NpsnTakenError);
  });

  test("kabupaten yang tidak sesuai provinsi ditolak", async () => {
    await expect(makeSchool({ provinceCode: "64", regencyCode: "65.02" })).rejects.toBeInstanceOf(RegionError);
  });

  test("validasi form: pernyataan sekolah negeri wajib, honeypot harus kosong", () => {
    const base = {
      npsn: "30100001", name: "SD Negeri 001", shortName: "SDN 001", level: "SD", provinceCode: "65", regencyCode: "65.02",
      contactName: "Budi", contactPhone: "081234567890", contactEmail: "", adminName: "Admin", adminUsername: "admin",
      adminPassword: "rahasia123", adminPasswordConfirm: "rahasia123",
    };
    expect(registrationSchema.safeParse({ ...base, declaration: "on" }).success).toBe(true);
    expect(registrationSchema.safeParse(base).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, declaration: "on", website: "http://spam" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, declaration: "on", regencyCode: "64.71" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, declaration: "on", npsn: "123" }).success).toBe(false);
  });
});
