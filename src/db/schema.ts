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
    /** Unit yang dicatat bersamaan (mis. 30 kursi satu pembelian) */
    batchId: uuid("batch_id").notNull(),
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
] as const;
