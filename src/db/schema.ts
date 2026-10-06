import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  char,
  foreignKey,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
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
export const assetCondition = pgEnum("asset_condition", ["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT"]);
export const assetStatus = pgEnum("asset_status", ["DIGUNAKAN", "DIPINJAM", "DALAM_PEMELIHARAAN", "DIUSULKAN_HAPUS", "DIHAPUS", "HILANG"]);
export const assetEventKind = pgEnum("asset_event_kind", ["DICATAT", "PINDAH", "KONDISI", "STATUS", "UBAH_DATA"]);
export const requestStatus = pgEnum("request_status", [
  "DRAF",
  "DIAJUKAN",
  "DITERUSKAN",
  "DIVERIFIKASI",
  "DISETUJUI",
  "SELESAI",
  "DITOLAK",
  "DIBATALKAN",
]);
export const loanStatus = pgEnum("loan_status", ["DIAJUKAN", "DIPINJAM", "SELESAI", "DITOLAK", "DIBATALKAN"]);
export const opnameStatus = pgEnum("opname_status", ["DRAF", "DIAJUKAN", "DISETUJUI", "DIBATALKAN"]);
export const inventoryStatus = pgEnum("inventory_status", ["DRAF", "SELESAI", "DIBATALKAN"]);
export const disposalStatus = pgEnum("disposal_status", ["DRAF", "DIAJUKAN", "DIKIRIM", "SELESAI", "DITOLAK", "DIBATALKAN"]);
export const disposalReason = pgEnum("disposal_reason", ["RUSAK_BERAT", "USANG", "KECURIAN", "HILANG", "TERBAKAR_SUSUT", "KAHAR", "INVENTARISASI"]);
/** Tindak lanjut barang yang diusulkan hapus (Permendagri 7/2024 Format C.23) */
export const disposalFollowUp = pgEnum("disposal_follow_up", ["PEMUSNAHAN", "PEMINDAHTANGANAN"]);
/** Rencana atas BMD tidak digunakan untuk tugas & fungsi (Format C.3) */
export const idlePlan = pgEnum("idle_plan", ["PENGGUNAAN", "PEMANFAATAN", "PEMINDAHTANGANAN"]);
export const proposalStatus = pgEnum("proposal_status", ["DRAF", "DIAJUKAN", "DIVERIFIKASI", "DISETUJUI", "SELESAI", "DITOLAK", "DIBATALKAN"]);
export const procurementStatus = pgEnum("procurement_status", ["DRAF", "DIPESAN", "DITERIMA_SEBAGIAN", "DITERIMA", "DIBATALKAN"]);
export const goodsKind = pgEnum("goods_kind", ["PERSEDIAAN", "ASET"]);
export const maintenanceKind = pgEnum("maintenance_kind", ["RUTIN", "PERBAIKAN", "PENINGKATAN"]);
export const maintenanceStatus = pgEnum("maintenance_status", ["BERJALAN", "SELESAI"]);
export const valueChangeKind = pgEnum("value_change_kind", ["PEMBAYARAN_KDP", "KAPITALISASI", "KOREKSI"]);
export const assetChangeKind = pgEnum("asset_change_kind", ["REKLASIFIKASI", "KOREKSI"]);
export const transferForm = pgEnum("transfer_form", ["PENJUALAN", "TUKAR_MENUKAR", "HIBAH", "PENYERTAAN_MODAL"]);
export const utilizationKind = pgEnum("utilization_kind", ["PEMANFAATAN", "PENGGUNAAN_SEMENTARA", "OPERASIONAL_PIHAK_LAIN"]);
export const utilizationForm = pgEnum("utilization_form", ["SEWA", "PINJAM_PAKAI", "BGS_BSG", "KSP", "KSPI"]);
export const utilizationStatus = pgEnum("utilization_status", ["RENCANA", "DISETUJUI", "BERJALAN", "SELESAI", "DITOLAK", "DIBATALKAN"]);
export const constructionKind = pgEnum("construction_kind", ["KDP", "ATR"]);
export const constructionStatus = pgEnum("construction_status", ["BERJALAN", "DIHENTIKAN", "SELESAI"]);
export const atrFollowUp = pgEnum("atr_follow_up", ["PEMINDAHTANGANAN", "PENGALIHAN_STATUS"]);
/** Jenis dokumen stok persediaan */
export const stockDocKind = pgEnum("stock_doc_kind", [
  "SALDO_AWAL",
  "PENERIMAAN",
  "PENYALURAN",
  "MUTASI",
  "PENYESUAIAN_TAMBAH",
  "PENYESUAIAN_KURANG",
  "RUSAK_USANG",
]);
export const stockDocStatus = pgEnum("stock_doc_status", ["DRAF", "DIPOSTING", "DIBATALKAN"]);
/** Jenis baris buku besar persediaan (PEMBALIK = pembatalan dokumen yang sudah diposting) */
export const movementKind = pgEnum("movement_kind", [
  "SALDO_AWAL",
  "PENERIMAAN",
  "PENYALURAN",
  "MUTASI_KELUAR",
  "MUTASI_MASUK",
  "PENYESUAIAN_TAMBAH",
  "PENYESUAIAN_KURANG",
  "RUSAK_USANG",
  "PEMBALIK",
]);

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

/**
 * Peta token QR → sekolah (tanpa RLS) agar halaman publik /q/{token} tahu konteks sekolahnya.
 * Token acak 96-bit; isi barang tetap dibaca lewat RLS sekolah.
 */
export const qrTokens = pgTable("qr_tokens", {
  token: varchar("token", { length: 32 }).primaryKey(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 20 }).notNull(),
  refId: uuid("ref_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Antrean email (tanpa RLS agar pengirim latar belakang bisa memproses semua sekolah).
 * Ditulis dalam transaksi yang sama dengan kejadiannya, dikirim setelah respons / oleh timer (coba ulang).
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextTryAt: timestamp("next_try_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_outbox_pending_idx").on(t.nextTryAt).where(sql`${t.sentAt} is null`)],
);

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
  /** Tutup buku: transaksi bertanggal ≤ tanggal ini ditolak */
  booksClosedUntil: date("books_closed_until"),
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
  (t) => [uniqueIndex("uoms_school_name_key").on(t.schoolId, t.name), uniqueIndex("uoms_school_id_key").on(t.schoolId, t.id)],
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
    uniqueIndex("funding_components_school_id_key").on(t.schoolId, t.id),
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
  (t) => [uniqueIndex("vendors_school_name_key").on(t.schoolId, t.name), uniqueIndex("vendors_school_id_key").on(t.schoolId, t.id)],
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

// ─────────────────────────────────────────────────────────── persediaan (Permendagri 47/2021)

const qty = (name: string) => numeric(name, { precision: 14, scale: 2 });
const money = (name: string) => numeric(name, { precision: 16, scale: 2 });

/** Barang persediaan per spesifikasi: NUSP = kode barang persediaan (tingkat 7) + nomor urut spesifikasi 4 digit */
export const supplyItems = pgTable(
  "supply_items",
  {
    id: id(),
    schoolId: schoolId(),
    bmdCode: varchar("bmd_code", { length: 32 }).notNull(),
    seq: integer("seq").notNull(),
    nusp: varchar("nusp", { length: 40 }).notNull(),
    name: text("name").notNull(),
    spec: text("spec"),
    uomId: uuid("uom_id").notNull(),
    minStock: qty("min_stock").notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    /** Token QR rak/gudang (bukan label register) */
    qrToken: varchar("qr_token", { length: 32 }).notNull().default(sql`encode(gen_random_bytes(12), 'hex')`),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("supply_items_school_nusp_key").on(t.schoolId, t.nusp),
    uniqueIndex("supply_items_school_code_seq_key").on(t.schoolId, t.bmdCode, t.seq),
    uniqueIndex("supply_items_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("supply_items_qr_key").on(t.qrToken),
    sameSchool(t, "uomId", uoms),
    check("supply_items_seq_check", sql`${t.seq} between 1 and 9999`),
    check("supply_items_min_stock_check", sql`${t.minStock} >= 0`),
  ],
);

/** Penomoran dokumen per sekolah × jenis × tahun */
export const docCounters = pgTable(
  "doc_counters",
  {
    schoolId: schoolId(),
    kind: varchar("kind", { length: 30 }).notNull(),
    year: smallint("year").notNull(),
    last: integer("last").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.kind, t.year] })],
);

/** Dokumen stok (kepala). Diposting sekali; koreksi lewat pembatalan (baris PEMBALIK), bukan edit. */
export const stockDocs = pgTable(
  "stock_docs",
  {
    id: id(),
    schoolId: schoolId(),
    kind: stockDocKind("kind").notNull(),
    status: stockDocStatus("status").notNull().default("DRAF"),
    number: varchar("number", { length: 40 }),
    date: date("date").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    /** Tujuan mutasi antar gudang */
    toWarehouseId: uuid("to_warehouse_id"),
    /** Unit penerima penyaluran */
    unitId: uuid("unit_id"),
    vendorId: uuid("vendor_id"),
    fundingSourceId: uuid("funding_source_id"),
    fundingComponentId: uuid("funding_component_id"),
    /** Cara perolehan (Pasal 7 Permendagri 47/2021): PEMBELIAN, HIBAH, ... */
    acquisition: varchar("acquisition", { length: 30 }),
    refNumber: text("ref_number"),
    refDate: date("ref_date"),
    note: text("note"),
    /** Nota permintaan asal (penyaluran hasil permintaan unit) */
    requestId: uuid("request_id"),
    /** Stock opname asal (dokumen penyesuaian hasil opname) */
    opnameId: uuid("opname_id"),
    /** Pengadaan asal (penerimaan hasil pengadaan) */
    procurementId: uuid("procurement_id"),
    createdBy: uuid("created_by"),
    postedBy: uuid("posted_by"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("stock_docs_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("stock_docs_school_number_key").on(t.schoolId, t.number),
    index("stock_docs_school_date_idx").on(t.schoolId, t.date),
    sameSchool(t, "warehouseId", warehouses),
    sameSchool(t, "toWarehouseId", warehouses),
    sameSchool(t, "unitId", units),
    sameSchool(t, "vendorId", vendors),
    sameSchool(t, "fundingSourceId", fundingSources),
    sameSchool(t, "fundingComponentId", fundingComponents),
    sameSchool(t, "requestId", supplyRequests),
    // opname_id tanpa FK (hindari rujukan melingkar; diisi sistem saat menyetujui opname)
  ],
);

export const stockDocLines = pgTable(
  "stock_doc_lines",
  {
    id: id(),
    schoolId: schoolId(),
    docId: uuid("doc_id").notNull(),
    lineNo: smallint("line_no").notNull(),
    itemId: uuid("item_id").notNull(),
    qty: qty("qty").notNull(),
    /** Harga satuan untuk baris masuk; untuk baris keluar diisi sistem (FIFO) */
    unitPrice: money("unit_price"),
    note: text("note"),
  },
  (t) => [
    uniqueIndex("stock_doc_lines_doc_line_key").on(t.docId, t.lineNo),
    sameSchool(t, "docId", stockDocs, "cascade"),
    sameSchool(t, "itemId", supplyItems),
    check("stock_doc_lines_qty_check", sql`${t.qty} > 0`),
    check("stock_doc_lines_price_check", sql`${t.unitPrice} is null or ${t.unitPrice} >= 0`),
  ],
);

/** Batch FIFO: satu baris per barang masuk per gudang */
export const stockLots = pgTable(
  "stock_lots",
  {
    id: id(),
    schoolId: schoolId(),
    itemId: uuid("item_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    receivedDate: date("received_date").notNull(),
    qtyIn: qty("qty_in").notNull(),
    qtyLeft: qty("qty_left").notNull(),
    unitPrice: money("unit_price").notNull(),
    docId: uuid("doc_id").notNull(),
    /** Lot asal bila hasil mutasi antar gudang */
    originLotId: uuid("origin_lot_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stock_lots_school_id_key").on(t.schoolId, t.id),
    index("stock_lots_fifo_idx").on(t.schoolId, t.itemId, t.warehouseId, t.receivedDate, t.createdAt),
    sameSchool(t, "itemId", supplyItems),
    sameSchool(t, "warehouseId", warehouses),
    sameSchool(t, "docId", stockDocs),
    check("stock_lots_qty_check", sql`${t.qtyIn} > 0 and ${t.qtyLeft} >= 0 and ${t.qtyLeft} <= ${t.qtyIn}`),
    check("stock_lots_price_check", sql`${t.unitPrice} >= 0`),
  ],
);

/** Saldo terkini per barang × gudang; dikunci (FOR UPDATE) saat posting */
export const stockBalances = pgTable(
  "stock_balances",
  {
    schoolId: schoolId(),
    itemId: uuid("item_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    qty: qty("qty").notNull().default("0"),
    value: money("value").notNull().default("0"),
    lastDate: date("last_date"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.warehouseId] }),
    sameSchool(t, "itemId", supplyItems),
    sameSchool(t, "warehouseId", warehouses),
    check("stock_balances_check", sql`${t.qty} >= 0 and ${t.value} >= 0`),
  ],
);

/** Buku besar persediaan — hanya INSERT (UPDATE/DELETE dicabut dan ditolak trigger) */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    itemId: uuid("item_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    date: date("date").notNull(),
    kind: movementKind("kind").notNull(),
    docId: uuid("doc_id").notNull(),
    docNumber: varchar("doc_number", { length: 40 }).notNull(),
    lotId: uuid("lot_id").notNull(),
    qtyIn: qty("qty_in").notNull().default("0"),
    qtyOut: qty("qty_out").notNull().default("0"),
    unitPrice: money("unit_price").notNull(),
    value: money("value").notNull(),
    balanceQty: qty("balance_qty").notNull(),
    balanceValue: money("balance_value").notNull(),
    description: text("description"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_card_idx").on(t.schoolId, t.itemId, t.warehouseId, t.id),
    index("stock_movements_doc_idx").on(t.schoolId, t.docId),
    sameSchool(t, "itemId", supplyItems),
    sameSchool(t, "warehouseId", warehouses),
    sameSchool(t, "docId", stockDocs),
    sameSchool(t, "lotId", stockLots),
    check("stock_movements_qty_check", sql`${t.qtyIn} >= 0 and ${t.qtyOut} >= 0 and (${t.qtyIn} > 0) <> (${t.qtyOut} > 0)`),
    check("stock_movements_balance_check", sql`${t.balanceQty} >= 0 and ${t.balanceValue} >= 0`),
  ],
);

// ─────────────────────────────────────────────────────────── aset tetap per unit (Permendagri 108/2016 & 47/2021)

/**
 * Satu baris = satu unit barang dengan nomor register sendiri.
 * Kode register: [kepemilikan].[01 intra|02 ekstra].[prov].[kab].[pengguna].[kuasa].[sub].[tahun] / [kode barang].[nomor urut 6 digit]
 */
export const assets = pgTable(
  "assets",
  {
    id: id(),
    schoolId: schoolId(),
    bmdCode: varchar("bmd_code", { length: 32 }).notNull(),
    /** Golongan KIB: A–F atau ATB (disalin dari kode barang) */
    kib: varchar("kib", { length: 3 }).notNull(),
    regNo: integer("reg_no").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    /** Atribut khusus KIB (ukuran/CC, bahan, no. pabrik/rangka/mesin/polisi/BPKB, luas, sertifikat, dst.) */
    attrs: jsonb("attrs").$type<Record<string, string>>().notNull().default({}),
    acqDate: date("acq_date").notNull(),
    acqPrice: money("acq_price").notNull(),
    acquisition: varchar("acquisition", { length: 30 }).notNull().default("PEMBELIAN"),
    /** true = intrakomptabel (memenuhi batas kapitalisasi saat dicatat) */
    isIntra: boolean("is_intra").notNull(),
    fundingSourceId: uuid("funding_source_id"),
    fundingComponentId: uuid("funding_component_id"),
    vendorId: uuid("vendor_id"),
    refNumber: text("ref_number"),
    roomId: uuid("room_id"),
    unitId: uuid("unit_id"),
    condition: assetCondition("condition").notNull().default("BAIK"),
    status: assetStatus("status").notNull().default("DIGUNAKAN"),
    /** BMD tidak digunakan untuk penyelenggaraan tugas & fungsi (Format C.3 Permendagri 7/2024) */
    idle: boolean("idle").notNull().default(false),
    idlePlan: idlePlan("idle_plan"),
    idleNote: text("idle_note"),
    /** Unit yang dicatat bersamaan (mis. 30 kursi satu pembelian) */
    batchId: uuid("batch_id").notNull(),
    /** Pengadaan asal (bila dicatat dari penerimaan pengadaan) */
    procurementId: uuid("procurement_id"),
    qrToken: varchar("qr_token", { length: 32 }).notNull().default(sql`encode(gen_random_bytes(12), 'hex')`),
    note: text("note"),
    createdBy: uuid("created_by"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("assets_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("assets_school_code_reg_key").on(t.schoolId, t.bmdCode, t.regNo),
    uniqueIndex("assets_qr_key").on(t.qrToken),
    index("assets_school_room_idx").on(t.schoolId, t.roomId),
    index("assets_school_batch_idx").on(t.schoolId, t.batchId),
    sameSchool(t, "roomId", rooms),
    sameSchool(t, "unitId", units),
    sameSchool(t, "vendorId", vendors),
    sameSchool(t, "fundingSourceId", fundingSources),
    sameSchool(t, "fundingComponentId", fundingComponents),
    check("assets_reg_no_check", sql`${t.regNo} between 1 and 999999`),
    check("assets_price_check", sql`${t.acqPrice} >= 0`),
    check("assets_kib_check", sql`${t.kib} in ('A','B','C','D','E','F','ATB')`),
  ],
);

/** Riwayat aset (lokasi, kondisi, status, perubahan data) — hanya INSERT */
export const assetEvents = pgTable(
  "asset_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    assetId: uuid("asset_id").notNull(),
    kind: assetEventKind("kind").notNull(),
    date: date("date").notNull(),
    fromRoomId: uuid("from_room_id"),
    toRoomId: uuid("to_room_id"),
    fromCondition: assetCondition("from_condition"),
    toCondition: assetCondition("to_condition"),
    fromStatus: assetStatus("from_status"),
    toStatus: assetStatus("to_status"),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("asset_events_asset_idx").on(t.schoolId, t.assetId, t.id),
    sameSchool(t, "assetId", assets, "cascade"),
    sameSchool(t, "fromRoomId", rooms),
    sameSchool(t, "toRoomId", rooms),
  ],
);

// ─────────────────────────────────────────────────────────── permintaan persediaan (Permendagri 47/2021 Ps. 36–37)

/**
 * Nota permintaan dari unit. Mode & tingkat persetujuan disalin saat diajukan.
 * Ringkas: DIAJUKAN → (Petugas salurkan) SELESAI.
 * Lengkap: DIAJUKAN → DITERUSKAN (surat permintaan) → [DIVERIFIKASI] → DISETUJUI (SPPB) → SELESAI (BAST).
 */
export const supplyRequests = pgTable(
  "supply_requests",
  {
    id: id(),
    schoolId: schoolId(),
    number: varchar("number", { length: 40 }),
    status: requestStatus("status").notNull().default("DRAF"),
    unitId: uuid("unit_id").notNull(),
    date: date("date").notNull(),
    purpose: text("purpose"),
    mode: distributionMode("mode"),
    levels: smallint("levels"),
    requestedBy: uuid("requested_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    spNumber: varchar("sp_number", { length: 40 }),
    forwardedBy: uuid("forwarded_by"),
    forwardedAt: timestamp("forwarded_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    sppbNumber: varchar("sppb_number", { length: 40 }),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    issueDocId: uuid("issue_doc_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** Alasan ditolak/dikembalikan terakhir */
    lastReason: text("last_reason"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("supply_requests_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("supply_requests_school_number_key").on(t.schoolId, t.number),
    index("supply_requests_school_status_idx").on(t.schoolId, t.status),
    sameSchool(t, "unitId", units),
    // issue_doc_id tanpa FK (hindari rujukan melingkar dengan stock_docs.request_id yang ber-FK)
  ],
);

export const supplyRequestLines = pgTable(
  "supply_request_lines",
  {
    id: id(),
    schoolId: schoolId(),
    requestId: uuid("request_id").notNull(),
    lineNo: smallint("line_no").notNull(),
    itemId: uuid("item_id").notNull(),
    qtyRequested: qty("qty_requested").notNull(),
    /** Jumlah disetujui (diisi Petugas saat meneruskan/menyalurkan) */
    qtyApproved: qty("qty_approved"),
    /** Jumlah benar-benar disalurkan */
    qtyIssued: qty("qty_issued"),
    note: text("note"),
  },
  (t) => [
    uniqueIndex("supply_request_lines_req_line_key").on(t.requestId, t.lineNo),
    sameSchool(t, "requestId", supplyRequests, "cascade"),
    sameSchool(t, "itemId", supplyItems),
    check("supply_request_lines_qty_check", sql`${t.qtyRequested} > 0 and (${t.qtyApproved} is null or ${t.qtyApproved} >= 0) and (${t.qtyIssued} is null or ${t.qtyIssued} >= 0)`),
  ],
);

/** Jejak alur permintaan — hanya INSERT */
export const requestEvents = pgTable(
  "request_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    requestId: uuid("request_id").notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    fromStatus: requestStatus("from_status"),
    toStatus: requestStatus("to_status").notNull(),
    note: text("note"),
    userId: uuid("user_id"),
    userName: text("user_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_events_req_idx").on(t.schoolId, t.requestId, t.id), sameSchool(t, "requestId", supplyRequests, "cascade")],
);

// ─────────────────────────────────────────────────────────── peminjaman (internal sekolah) & notifikasi

/** Peminjaman alat oleh guru/siswa di dalam sekolah (bukan pinjam pakai BMD antar-instansi) */
export const loans = pgTable(
  "loans",
  {
    id: id(),
    schoolId: schoolId(),
    number: varchar("number", { length: 40 }),
    status: loanStatus("status").notNull(),
    /** Peminjam berakun (opsional); siswa tanpa akun cukup nama + kelas/NIS */
    borrowerUserId: uuid("borrower_user_id"),
    borrowerName: text("borrower_name").notNull(),
    borrowerInfo: text("borrower_info"),
    purpose: text("purpose"),
    loanedAt: timestamp("loaned_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").notNull(),
    handedBy: uuid("handed_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lastReason: text("last_reason"),
    /** Pengingat jatuh tempo terakhir dikirim (hindari ganda) */
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("loans_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("loans_school_number_key").on(t.schoolId, t.number),
    index("loans_school_status_idx").on(t.schoolId, t.status, t.dueAt),
    sameSchool(t, "borrowerUserId", users),
  ],
);

export const loanLines = pgTable(
  "loan_lines",
  {
    id: id(),
    schoolId: schoolId(),
    loanId: uuid("loan_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    conditionOut: assetCondition("condition_out"),
    /** Diisi saat barang diserahkan; null selama masih diajukan */
    outAt: timestamp("out_at", { withTimezone: true }),
    conditionIn: assetCondition("condition_in"),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    returnedTo: uuid("returned_to"),
    returnNote: text("return_note"),
  },
  (t) => [
    uniqueIndex("loan_lines_loan_asset_key").on(t.loanId, t.assetId),
    // Satu aset hanya boleh sedang dipinjam di satu peminjaman
    uniqueIndex("loan_lines_asset_out_key").on(t.assetId).where(sql`${t.outAt} is not null and ${t.returnedAt} is null`),
    sameSchool(t, "loanId", loans, "cascade"),
    sameSchool(t, "assetId", assets),
  ],
);

/** Notifikasi di aplikasi (lonceng) per pengguna */
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.schoolId, t.userId, t.id), sameSchool(t, "userId", users, "cascade")],
);

// ─────────────────────────────────────────────────────────── audit: opname, inventarisasi, penghapusan, pemeliharaan

/** Stock opname persediaan per gudang (Permendagri 47/2021 Ps. 39). Gudang dibekukan selama DRAF/DIAJUKAN. */
export const stockOpnames = pgTable(
  "stock_opnames",
  {
    id: id(),
    schoolId: schoolId(),
    number: varchar("number", { length: 40 }).notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    date: date("date").notNull(),
    status: opnameStatus("status").notNull().default("DRAF"),
    note: text("note"),
    createdBy: uuid("created_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    lastReason: text("last_reason"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("stock_opnames_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("stock_opnames_school_number_key").on(t.schoolId, t.number),
    // Satu sesi aktif per gudang
    uniqueIndex("stock_opnames_active_wh_key").on(t.warehouseId).where(sql`${t.status} in ('DRAF','DIAJUKAN')`),
    sameSchool(t, "warehouseId", warehouses),
  ],
);

export const stockOpnameLines = pgTable(
  "stock_opname_lines",
  {
    id: id(),
    schoolId: schoolId(),
    opnameId: uuid("opname_id").notNull(),
    itemId: uuid("item_id").notNull(),
    systemQty: qty("system_qty").notNull(),
    /** Hitungan fisik barang baik; null = belum dihitung */
    physicalQty: qty("physical_qty"),
    /** Ditemukan rusak berat/usang → keluar ke daftar persediaan rusak/usang */
    damagedQty: qty("damaged_qty").notNull().default("0"),
    /** Harga satuan untuk kelebihan (default: harga lot terakhir) */
    surplusPrice: money("surplus_price"),
    note: text("note"),
  },
  (t) => [
    uniqueIndex("stock_opname_lines_item_key").on(t.opnameId, t.itemId),
    sameSchool(t, "opnameId", stockOpnames, "cascade"),
    sameSchool(t, "itemId", supplyItems),
    check("stock_opname_lines_qty_check", sql`${t.systemQty} >= 0 and (${t.physicalQty} is null or ${t.physicalQty} >= 0) and ${t.damagedQty} >= 0`),
  ],
);

/** Inventarisasi aset per ruangan: cocokkan KIR dengan fisik */
export const assetInventories = pgTable(
  "asset_inventories",
  {
    id: id(),
    schoolId: schoolId(),
    number: varchar("number", { length: 40 }).notNull(),
    roomId: uuid("room_id").notNull(),
    date: date("date").notNull(),
    status: inventoryStatus("status").notNull().default("DRAF"),
    note: text("note"),
    createdBy: uuid("created_by").notNull(),
    finishedBy: uuid("finished_by"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("asset_inventories_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("asset_inventories_school_number_key").on(t.schoolId, t.number),
    sameSchool(t, "roomId", rooms),
  ],
);

export const assetInventoryLines = pgTable(
  "asset_inventory_lines",
  {
    id: id(),
    schoolId: schoolId(),
    inventoryId: uuid("inventory_id").notNull(),
    /** Aset tercatat di ruangan; null = barang ditemukan tetapi belum tercatat */
    assetId: uuid("asset_id"),
    conditionRecorded: assetCondition("condition_recorded"),
    /** null = belum diperiksa */
    found: boolean("found"),
    conditionFound: assetCondition("condition_found"),
    /** Barang belum tercatat: uraian & jumlah */
    extraName: text("extra_name"),
    extraQty: integer("extra_qty"),
    note: text("note"),
    /** Temuan inventarisasi yang perlu ditindaklanjuti (LHI, Permendagri 7/2024 C.27/C.29) */
    followUp: assetChangeKind("follow_up"),
    followUpNote: text("follow_up_note"),
    /** Diisi saat reklasifikasi/koreksi atas temuan ini dicatat */
    followUpDoneAt: timestamp("follow_up_done_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("asset_inventory_lines_asset_key").on(t.inventoryId, t.assetId),
    sameSchool(t, "inventoryId", assetInventories, "cascade"),
    sameSchool(t, "assetId", assets),
    check("asset_inventory_lines_kind_check", sql`(${t.assetId} is not null) <> (${t.extraName} is not null)`),
  ],
);

/** Usulan penghapusan aset — diputus kepala daerah (Permendagri 19/2016 jo. 7/2024) */
export const disposals = pgTable(
  "disposals",
  {
    id: id(),
    schoolId: schoolId(),
    number: varchar("number", { length: 40 }),
    status: disposalStatus("status").notNull().default("DRAF"),
    date: date("date").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").notNull(),
    submittedBy: uuid("submitted_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** Surat usulan ke Dinas/BPKAD */
    letterNumber: text("letter_number"),
    letterDate: date("letter_date"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** SK kepala daerah */
    skNumber: text("sk_number"),
    skDate: date("sk_date"),
    skFile: text("sk_file"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lastReason: text("last_reason"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("disposals_school_id_key").on(t.schoolId, t.id), uniqueIndex("disposals_school_number_key").on(t.schoolId, t.number)],
);

export const disposalLines = pgTable(
  "disposal_lines",
  {
    id: id(),
    schoolId: schoolId(),
    disposalId: uuid("disposal_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    reason: disposalReason("reason").notNull(),
    followUp: disposalFollowUp("follow_up").notNull().default("PEMUSNAHAN"),
    /** Bentuk pemindahtanganan yang direncanakan (RKBMD A.3, pemantauan C.13) */
    transferForm: transferForm("transfer_form"),
    /** Wajib bila kecurian: nomor surat keterangan kepolisian */
    policeLetter: text("police_letter"),
    note: text("note"),
    /** Status aset sebelum diusulkan (dipulihkan bila ditolak/batal) */
    prevStatus: assetStatus("prev_status"),
  },
  (t) => [
    uniqueIndex("disposal_lines_asset_key").on(t.disposalId, t.assetId),
    sameSchool(t, "disposalId", disposals, "cascade"),
    sameSchool(t, "assetId", assets),
  ],
);

/** Kartu pemeliharaan per aset (Permendagri 47/2021 Ps. 40) */
export const maintenances = pgTable(
  "maintenances",
  {
    id: id(),
    schoolId: schoolId(),
    assetId: uuid("asset_id").notNull(),
    kind: maintenanceKind("kind").notNull(),
    status: maintenanceStatus("status").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    executor: text("executor"),
    description: text("description").notNull(),
    cost: money("cost").notNull().default("0"),
    fundingSourceId: uuid("funding_source_id"),
    fundingComponentId: uuid("funding_component_id"),
    conditionBefore: assetCondition("condition_before").notNull(),
    conditionAfter: assetCondition("condition_after"),
    /** Biaya peningkatan ditambahkan ke nilai aset (kapitalisasi) */
    capitalized: boolean("capitalized").notNull().default(false),
    createdBy: uuid("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("maintenances_asset_idx").on(t.schoolId, t.assetId, t.startDate),
    sameSchool(t, "assetId", assets),
    sameSchool(t, "fundingSourceId", fundingSources),
    sameSchool(t, "fundingComponentId", fundingComponents),
    check("maintenances_cost_check", sql`${t.cost} >= 0`),
  ],
);

// ─────────────────────────────────────────────────────────── usulan kebutuhan & pengadaan

/** Pagu belanja barang per unit × sumber dana × tahun anggaran */
export const budgetCeilings = pgTable(
  "budget_ceilings",
  {
    id: id(),
    schoolId: schoolId(),
    year: smallint("year").notNull(),
    unitId: uuid("unit_id").notNull(),
    fundingSourceId: uuid("funding_source_id").notNull(),
    amount: money("amount").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("budget_ceilings_key").on(t.schoolId, t.year, t.unitId, t.fundingSourceId),
    sameSchool(t, "unitId", units),
    sameSchool(t, "fundingSourceId", fundingSources),
    check("budget_ceilings_amount_check", sql`${t.amount} >= 0`),
  ],
);

/** Usulan kebutuhan barang dari unit */
export const proposals = pgTable(
  "proposals",
  {
    id: id(),
    schoolId: schoolId(),
    number: varchar("number", { length: 40 }),
    status: proposalStatus("status").notNull().default("DRAF"),
    unitId: uuid("unit_id").notNull(),
    year: smallint("year").notNull(),
    fundingSourceId: uuid("funding_source_id"),
    fundingComponentId: uuid("funding_component_id"),
    title: text("title").notNull(),
    levels: smallint("levels"),
    requestedBy: uuid("requested_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lastReason: text("last_reason"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("proposals_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("proposals_school_number_key").on(t.schoolId, t.number),
    index("proposals_school_status_idx").on(t.schoolId, t.status),
    sameSchool(t, "unitId", units),
    sameSchool(t, "fundingSourceId", fundingSources),
    sameSchool(t, "fundingComponentId", fundingComponents),
  ],
);

export const proposalLines = pgTable(
  "proposal_lines",
  {
    id: id(),
    schoolId: schoolId(),
    proposalId: uuid("proposal_id").notNull(),
    lineNo: smallint("line_no").notNull(),
    kind: goodsKind("kind").notNull(),
    /** Barang persediaan yang sudah ada (opsional) */
    itemId: uuid("item_id"),
    /** Kode barang BMD (aset) bila diketahui */
    bmdCode: varchar("bmd_code", { length: 32 }),
    description: text("description").notNull(),
    uom: varchar("uom", { length: 30 }).notNull(),
    qty: qty("qty").notNull(),
    estPrice: money("est_price").notNull(),
    reason: text("reason"),
    priority: smallint("priority").notNull().default(2),
    qtyApproved: qty("qty_approved"),
  },
  (t) => [
    uniqueIndex("proposal_lines_line_key").on(t.proposalId, t.lineNo),
    uniqueIndex("proposal_lines_school_id_key").on(t.schoolId, t.id),
    sameSchool(t, "proposalId", proposals, "cascade"),
    sameSchool(t, "itemId", supplyItems),
    check("proposal_lines_check", sql`${t.qty} > 0 and ${t.estPrice} >= 0 and (${t.qtyApproved} is null or ${t.qtyApproved} >= 0) and ${t.priority} between 1 and 3`),
  ],
);

/** Jejak alur usulan — hanya INSERT */
export const proposalEvents = pgTable(
  "proposal_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    proposalId: uuid("proposal_id").notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    fromStatus: proposalStatus("from_status"),
    toStatus: proposalStatus("to_status").notNull(),
    note: text("note"),
    userId: uuid("user_id"),
    userName: text("user_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("proposal_events_idx").on(t.schoolId, t.proposalId, t.id), sameSchool(t, "proposalId", proposals, "cascade")],
);

/** Pengadaan barang (pembelian) */
export const procurements = pgTable(
  "procurements",
  {
    id: id(),
    schoolId: schoolId(),
    number: varchar("number", { length: 40 }).notNull(),
    status: procurementStatus("status").notNull().default("DRAF"),
    proposalId: uuid("proposal_id"),
    vendorId: uuid("vendor_id"),
    fundingSourceId: uuid("funding_source_id"),
    fundingComponentId: uuid("funding_component_id"),
    orderDate: date("order_date").notNull(),
    refNumber: text("ref_number"),
    refDate: date("ref_date"),
    /** Pajak dicatat (tidak mengubah harga perolehan yang diisi) */
    taxAmount: money("tax_amount").notNull().default("0"),
    note: text("note"),
    attachment: text("attachment"),
    createdBy: uuid("created_by").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("procurements_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("procurements_school_number_key").on(t.schoolId, t.number),
    sameSchool(t, "proposalId", proposals),
    sameSchool(t, "vendorId", vendors),
    sameSchool(t, "fundingSourceId", fundingSources),
    sameSchool(t, "fundingComponentId", fundingComponents),
    check("procurements_tax_check", sql`${t.taxAmount} >= 0`),
  ],
);

export const procurementLines = pgTable(
  "procurement_lines",
  {
    id: id(),
    schoolId: schoolId(),
    procurementId: uuid("procurement_id").notNull(),
    lineNo: smallint("line_no").notNull(),
    proposalLineId: uuid("proposal_line_id"),
    kind: goodsKind("kind").notNull(),
    /** Persediaan: barang persediaan (wajib saat diterima) */
    itemId: uuid("item_id"),
    /** Aset: kode barang & nama */
    bmdCode: varchar("bmd_code", { length: 32 }),
    description: text("description").notNull(),
    brand: text("brand"),
    qty: qty("qty").notNull(),
    unitPrice: money("unit_price").notNull(),
    qtyReceived: qty("qty_received").notNull().default("0"),
  },
  (t) => [
    uniqueIndex("procurement_lines_line_key").on(t.procurementId, t.lineNo),
    sameSchool(t, "procurementId", procurements, "cascade"),
    sameSchool(t, "proposalLineId", proposalLines),
    sameSchool(t, "itemId", supplyItems),
    check("procurement_lines_check", sql`${t.qty} > 0 and ${t.unitPrice} >= 0 and ${t.qtyReceived} >= 0 and ${t.qtyReceived} <= ${t.qty}`),
  ],
);

// ─────────────────────────────────────────────────────────── KIR tercetak & lampiran

/** Arsip KIR yang sudah dicetak & ditempel (Permendagri 47/2021: diperbarui tiap semester & tiap perubahan) */
export const kirSnapshots = pgTable(
  "kir_snapshots",
  {
    id: id(),
    schoolId: schoolId(),
    roomId: uuid("room_id").notNull(),
    period: varchar("period", { length: 20 }).notNull(),
    asOf: date("as_of").notNull(),
    picName: text("pic_name"),
    units: integer("units").notNull(),
    total: money("total").notNull(),
    rows: jsonb("rows").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kir_snapshots_room_idx").on(t.schoolId, t.roomId, t.createdAt), sameSchool(t, "roomId", rooms, "cascade")],
);

/** Lampiran berkas (foto/nota/scan) pada data apa pun milik sekolah */
export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    schoolId: schoolId(),
    entity: varchar("entity", { length: 30 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    fileName: text("file_name").notNull(),
    storedName: text("stored_name").notNull(),
    caption: text("caption"),
    uploadedBy: uuid("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_entity_idx").on(t.schoolId, t.entity, t.entityId)],
);

// ─────────────────────────────────────────────────────────── impor Excel

/** Hasil baca berkas impor (pratinjau) — dikonfirmasi lalu diproses; dihapus otomatis setelah 2 hari */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: id(),
    schoolId: schoolId(),
    kind: varchar("kind", { length: 20 }).notNull(),
    fileName: text("file_name").notNull(),
    /** Baris ternormalisasi + hasil validasi: [{ row, data, errors[] }] */
    rows: jsonb("rows").$type<{ row: number; data: Record<string, string>; errors: string[] }[]>().notNull(),
    status: varchar("status", { length: 12 }).notNull().default("PRATINJAU"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdBy: uuid("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [index("import_jobs_school_idx").on(t.schoolId, t.createdAt)],
);

// ─────────────────────────────────────────────────────────── nilai, reklasifikasi & koreksi aset

/** Perubahan nilai aset (pembayaran KDP, kapitalisasi pemeliharaan, koreksi) — hanya INSERT; assets.acq_price = nilai terkini */
export const assetValueChanges = pgTable(
  "asset_value_changes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    assetId: uuid("asset_id").notNull(),
    kind: valueChangeKind("kind").notNull(),
    date: date("date").notNull(),
    amount: money("amount").notNull(),
    maintenanceId: uuid("maintenance_id"),
    docNo: text("doc_no"),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("asset_value_changes_asset_idx").on(t.schoolId, t.assetId, t.date), sameSchool(t, "assetId", assets, "cascade")],
);

/** Reklasifikasi (kode/golongan/intra-ekstra) & koreksi data perolehan — hanya INSERT */
export const assetChanges = pgTable(
  "asset_changes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    schoolId: schoolId(),
    assetId: uuid("asset_id").notNull(),
    kind: assetChangeKind("kind").notNull(),
    date: date("date").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>().notNull(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
    reason: text("reason").notNull(),
    docNo: text("doc_no"),
    /** Temuan inventarisasi yang ditindaklanjuti (bila ada) */
    inventoryLineId: uuid("inventory_line_id"),
    createdBy: uuid("created_by"),
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("asset_changes_asset_idx").on(t.schoolId, t.assetId, t.id), index("asset_changes_kind_idx").on(t.schoolId, t.kind, t.date), sameSchool(t, "assetId", assets, "cascade")],
);

// ─────────────────────────────────────────────────────────── KDP & aset tetap renovasi

/** Konstruksi dalam pengerjaan (KIB F) atau renovasi aset pihak lain (ATR, KIB E 1.3.5.07); asetnya tercatat di `assets` */
export const constructions = pgTable(
  "constructions",
  {
    id: id(),
    schoolId: schoolId(),
    kind: constructionKind("kind").notNull(),
    assetId: uuid("asset_id").notNull(),
    status: constructionStatus("status").notNull().default("BERJALAN"),
    /** ATR: pemilik aset yang direnovasi (Pengguna Barang lain/pihak lain) */
    ownerName: text("owner_name"),
    contractNo: text("contract_no"),
    contractDate: date("contract_date"),
    vendorId: uuid("vendor_id"),
    contractValue: money("contract_value").notNull().default("0"),
    startDate: date("start_date").notNull(),
    targetDate: date("target_date"),
    progress: smallint("progress").notNull().default(0),
    stopReason: text("stop_reason"),
    finishedDate: date("finished_date"),
    bastNo: text("bast_no"),
    atrFollowUp: atrFollowUp("atr_follow_up"),
    note: text("note"),
    createdBy: uuid("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("constructions_school_id_key").on(t.schoolId, t.id),
    uniqueIndex("constructions_asset_key").on(t.schoolId, t.assetId),
    sameSchool(t, "assetId", assets),
    sameSchool(t, "vendorId", vendors),
    check("constructions_progress_check", sql`${t.progress} between 0 and 100`),
    check("constructions_value_check", sql`${t.contractValue} >= 0`),
  ],
);

// ─────────────────────────────────────────────────────────── pemanfaatan & penggunaan oleh pihak lain

/** Pemanfaatan (sewa/pinjam pakai/BGS/BSG/KSP/KSPI), penggunaan sementara, dan BMD dioperasikan pihak lain */
export const utilizations = pgTable(
  "utilizations",
  {
    id: id(),
    schoolId: schoolId(),
    kind: utilizationKind("kind").notNull(),
    form: utilizationForm("form"),
    status: utilizationStatus("status").notNull().default("RENCANA"),
    /** Tahun anggaran RKBMD (A.1) */
    planYear: smallint("plan_year").notNull(),
    partner: text("partner"),
    purpose: text("purpose").notNull(),
    term: text("term"),
    /** Berjalan tanpa persetujuan Pengelola/Kepala Daerah (C.11) */
    withoutApproval: boolean("without_approval").notNull().default(false),
    approvalNo: text("approval_no"),
    approvalDate: date("approval_date"),
    agreementNo: text("agreement_no"),
    agreementDate: date("agreement_date"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    endedDate: date("ended_date"),
    contribution: money("contribution").notNull().default("0"),
    note: text("note"),
    lastReason: text("last_reason"),
    createdBy: uuid("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("utilizations_school_id_key").on(t.schoolId, t.id),
    index("utilizations_school_status_idx").on(t.schoolId, t.status),
    check("utilizations_form_check", sql`(${t.kind} = 'PEMANFAATAN') = (${t.form} is not null)`),
    check("utilizations_contribution_check", sql`${t.contribution} >= 0`),
  ],
);

export const utilizationLines = pgTable(
  "utilization_lines",
  {
    id: id(),
    schoolId: schoolId(),
    utilizationId: uuid("utilization_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    /** Bagian/luas yang dimanfaatkan, mis. "48 m² (ruang kantin)" */
    portion: text("portion"),
  },
  (t) => [
    uniqueIndex("utilization_lines_asset_key").on(t.utilizationId, t.assetId),
    sameSchool(t, "utilizationId", utilizations, "cascade"),
    sameSchool(t, "assetId", assets),
  ],
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
  "supply_items",
  "doc_counters",
  "stock_docs",
  "stock_doc_lines",
  "stock_lots",
  "stock_balances",
  "stock_movements",
  "assets",
  "asset_events",
  "supply_requests",
  "supply_request_lines",
  "request_events",
  "loans",
  "loan_lines",
  "notifications",
  "stock_opnames",
  "stock_opname_lines",
  "asset_inventories",
  "asset_inventory_lines",
  "disposals",
  "disposal_lines",
  "maintenances",
  "import_jobs",
  "budget_ceilings",
  "proposals",
  "proposal_lines",
  "proposal_events",
  "procurements",
  "procurement_lines",
  "kir_snapshots",
  "attachments",
  "asset_value_changes",
  "asset_changes",
  "constructions",
  "utilizations",
  "utilization_lines",
] as const;
