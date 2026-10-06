import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  char,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Kolom bersama
const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const schoolId = () =>
  uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" });
/**
 * FK komposit (school_id, kolom) → (school_id, id): PostgreSQL memeriksa FK tanpa RLS, jadi FK biasa
 * memungkinkan baris sekolah A merujuk id milik sekolah B. Dengan FK komposit, rujukan wajib satu sekolah.
 * Kolom nullable: FK dilewati bila kolomnya NULL (MATCH SIMPLE). Bawaan RESTRICT agar data terpakai tidak terhapus.
 */
function sameSchool<C extends string>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kolom drizzle generik
  t: Record<"schoolId" | C, any>,
  col: C,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabel drizzle generik
  target: any,
  onDelete: "restrict" | "cascade" = "restrict",
) {
  return foreignKey({ columns: [t.schoolId, t[col]], foreignColumns: [target.schoolId, target.id] }).onDelete(onDelete);
}
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolLevel = pgEnum("school_level", ["SD", "SMP", "SMA", "SMK", "SLB"]);
export const schoolStatus = pgEnum("school_status", ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"]);
export const userRole = pgEnum("user_role", ["ADMIN", "KEPSEK", "VERIFIKATOR", "PETUGAS", "PENGUSUL", "PEMINJAM"]);
export const distributionMode = pgEnum("distribution_mode", ["LENGKAP", "RINGKAS"]);

// ─────────────────────────────────────────────────────────── tabel platform (tanpa RLS)

/** Kode wilayah Kepmendagri (provinsi & kab/kota). Baca saja. */
export const regions = pgTable("regions", {
  code: varchar("code", { length: 5 }).primaryKey(),
  name: text("name").notNull(),
  level: smallint("level").notNull(),
  parentCode: varchar("parent_code", { length: 5 }),
});

/** Kodefikasi barang Permendagri 108/2016 (data/bmd). Baca saja. */
export const bmdCodes = pgTable(
  "bmd_codes",
  {
    code: varchar("code", { length: 32 }).primaryKey(),
    level: smallint("level").notNull(),
    name: text("name").notNull(),
    parentCode: varchar("parent_code", { length: 32 }),
    /** PERSEDIAAN, A–F (KIB), ATB, atau null untuk induk/akumulasi */
    class: varchar("class", { length: 12 }),
    selectable: boolean("selectable").notNull(),
  },
  (t) => [index("bmd_codes_parent_idx").on(t.parentCode)],
);

export const schools = pgTable(
  "schools",
  {
    id: id(),
    npsn: char("npsn", { length: 8 }).notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    level: schoolLevel("level").notNull(),
    provinceCode: varchar("province_code", { length: 2 }).notNull().references(() => regions.code),
    regencyCode: varchar("regency_code", { length: 5 }).notNull().references(() => regions.code),
    address: text("address"),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email"),
    /** Kode status kepemilikan BMD (Permendagri 108/2016): 11 provinsi, 12 kab/kota */
    ownershipCode: char("ownership_code", { length: 2 }).notNull(),
    status: schoolStatus("status").notNull().default("PENDING"),
    statusNote: text("status_note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("schools_npsn_key").on(t.npsn), index("schools_status_idx").on(t.status)],
);

export const platformAdmins = pgTable("platform_admins", {
  id: id(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  ...timestamps(),
});

/** Jejak tindakan pengelola platform (setujui/tolak/nonaktifkan sekolah). Tanpa UPDATE/DELETE. */
export const platformLogs = pgTable("platform_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  adminId: uuid("admin_id").references(() => platformAdmins.id),
  action: text("action").notNull(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "set null" }),
  detail: jsonb("detail"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────── tabel sekolah (RLS per school_id)

export const schoolSettings = pgTable("school_settings", {
  schoolId: uuid("school_id")
    .primaryKey()
    .references(() => schools.id, { onDelete: "cascade" }),
  // Kop & penandatangan
  pemdaName: text("pemda_name"),
  dinasName: text("dinas_name"),
  addressFull: text("address_full"),
  logoPemdaFile: text("logo_pemda_file"),
  logoSchoolFile: text("logo_school_file"),
  kepsekName: text("kepsek_name"),
  kepsekNip: text("kepsek_nip"),
  pengurusName: text("pengurus_name"),
  pengurusNip: text("pengurus_nip"),
  penggunaName: text("pengguna_name"),
  penggunaNip: text("pengguna_nip"),
  // Kode BMD dari Pemda (Permendagri 108/2016) — boleh kosong: register ditandai SEMENTARA
  kodePengguna: varchar("kode_pengguna", { length: 6 }),
  kodeKuasaPengguna: varchar("kode_kuasa_pengguna", { length: 5 }),
  kodeSubKuasa: varchar("kode_sub_kuasa", { length: 5 }).notNull().default("00000"),
  /** Batas kapitalisasi per golongan, mis. {"default":2000000,"B":2000000} */
  capitalization: jsonb("capitalization").$type<Record<string, number>>().notNull().default({ default: 2_000_000 }),
  // Alur kerja
  approvalLevels: smallint("approval_levels").notNull().default(2),
  studentAccounts: boolean("student_accounts").notNull().default(false),
  distributionMode: distributionMode("distribution_mode").notNull().default("RINGKAS"),
  loanDefaultDays: smallint("loan_default_days").notNull().default(1),
  unitLabel: text("unit_label").notNull().default("Unit"),
  ...timestamps(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    schoolId: schoolId(),
    username: varchar("username", { length: 50 }).notNull(),
    name: text("name").notNull(),
    nip: varchar("nip", { length: 30 }),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_school_username_key").on(t.schoolId, t.username), uniqueIndex("users_school_id_key").on(t.schoolId, t.id)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    schoolId: schoolId(),
    userId: uuid("user_id").notNull(),
    role: userRole("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] }), sameSchool(t, "userId", users, "cascade")],
);

export const units = pgTable(
  "units",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    kind: text("kind"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("units_school_name_key").on(t.schoolId, t.name), uniqueIndex("units_school_id_key").on(t.schoolId, t.id)],
);

export const buildings = pgTable(
  "buildings",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("buildings_school_name_key").on(t.schoolId, t.name), uniqueIndex("buildings_school_id_key").on(t.schoolId, t.id)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: id(),
    schoolId: schoolId(),
    buildingId: uuid("building_id"),
    unitId: uuid("unit_id"),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }),
    floor: text("floor"),
    /** Penanggung jawab ruangan — dicetak di KIR */
    picName: text("pic_name"),
    picNip: varchar("pic_nip", { length: 30 }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("rooms_school_name_key").on(t.schoolId, t.name),
    uniqueIndex("rooms_school_id_key").on(t.schoolId, t.id),
    sameSchool(t, "buildingId", buildings),
    sameSchool(t, "unitId", units),
  ],
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    roomId: uuid("room_id"),
    unitId: uuid("unit_id"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("warehouses_school_name_key").on(t.schoolId, t.name),
    uniqueIndex("warehouses_school_id_key").on(t.schoolId, t.id),
    sameSchool(t, "roomId", rooms),
    sameSchool(t, "unitId", units),
  ],
);

/** Lingkup Pengusul (unit) */
export const userUnits = pgTable(
  "user_units",
  {
    schoolId: schoolId(),
    userId: uuid("user_id").notNull(),
    unitId: uuid("unit_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.unitId] }), sameSchool(t, "userId", users, "cascade"), sameSchool(t, "unitId", units, "cascade")],
);

/** Lingkup Petugas Barang (gudang); kosong = semua gudang */
export const userWarehouses = pgTable(
  "user_warehouses",
  {
    schoolId: schoolId(),
    userId: uuid("user_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.warehouseId] }),
    sameSchool(t, "userId", users, "cascade"),
    sameSchool(t, "warehouseId", warehouses, "cascade"),
  ],
);

export const uoms = pgTable(
  "uoms",
  {
    id: id(),
    schoolId: schoolId(),
    name: varchar("name", { length: 30 }).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("uoms_school_name_key").on(t.schoolId, t.name)],
);

export const fundingSources = pgTable(
  "funding_sources",
  {
    id: id(),
    schoolId: schoolId(),
    code: varchar("code", { length: 30 }).notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("funding_sources_school_code_key").on(t.schoolId, t.code), uniqueIndex("funding_sources_school_id_key").on(t.schoolId, t.id)],
);

/** Komponen penggunaan dana (mis. komponen BOS Reguler Permendikdasmen 8/2026) */
export const fundingComponents = pgTable(
  "funding_components",
  {
    id: id(),
    schoolId: schoolId(),
    fundingSourceId: uuid("funding_source_id").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("funding_components_source_name_key").on(t.fundingSourceId, t.name),
    sameSchool(t, "fundingSourceId", fundingSources, "cascade"),
  ],
);

export const vendors = pgTable(
  "vendors",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    npwp: varchar("npwp", { length: 25 }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("vendors_school_name_key").on(t.schoolId, t.name)],
);

/** Kode barang tambahan Pemda/sekolah di bawah sub rincian objek (Permendagri 108/2016 Pasal 3 ayat 2) */
export const localBmdCodes = pgTable(
  "local_bmd_codes",
  {
    id: id(),
    schoolId: schoolId(),
    code: varchar("code", { length: 32 }).notNull(),
    parentCode: varchar("parent_code", { length: 32 })
      .notNull()
      .references(() => bmdCodes.code),
    name: text("name").notNull(),
    decreeRef: text("decree_ref"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("local_bmd_codes_school_code_key").on(t.schoolId, t.code)],
);

/** Kode barang yang sering dipakai sekolah (pintasan pemilih kategori) */
export const favoriteBmdCodes = pgTable(
  "favorite_bmd_codes",
  {
    schoolId: schoolId(),
    code: varchar("code", { length: 32 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.code] })],
);

/** Log aktivitas sekolah — tidak bisa diubah/dihapus (hak UPDATE/DELETE dicabut) */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    userId: uuid("user_id"),
    userName: text("user_name"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_logs_school_created_idx").on(t.schoolId, t.createdAt)],
);

/** Tabel ber-school_id yang wajib dilindungi RLS (dipakai migrasi & tes isolasi) */
export const RLS_TABLES = [
  "school_settings",
  "users",
  "user_roles",
  "units",
  "buildings",
  "rooms",
  "warehouses",
  "user_units",
  "user_warehouses",
  "uoms",
  "funding_sources",
  "funding_components",
  "vendors",
  "local_bmd_codes",
  "favorite_bmd_codes",
  "activity_logs",
] as const;
