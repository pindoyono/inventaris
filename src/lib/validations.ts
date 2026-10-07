import { z } from "zod";

export const SCHOOL_LEVELS = ["SD", "SMP", "SMA", "SMK", "SLB"] as const;
export const LEVEL_LABEL: Record<(typeof SCHOOL_LEVELS)[number], string> = {
  SD: "SD Negeri",
  SMP: "SMP Negeri",
  SMA: "SMA Negeri",
  SMK: "SMK Negeri",
  SLB: "SLB Negeri",
};

/** SD/SMP dikelola kab/kota (12), SMA/SMK/SLB dikelola provinsi (11) — kode status kepemilikan Permendagri 108/2016 */
export function ownershipCodeFor(level: (typeof SCHOOL_LEVELS)[number]) {
  return level === "SD" || level === "SMP" ? "12" : "11";
}

export const normalizeNpsn = (v: string) => v.trim().toUpperCase();

export const npsnSchema = z
  .string({ message: "NPSN wajib diisi" })
  .transform(normalizeNpsn)
  .pipe(z.string().regex(/^[0-9A-Z]{8}$/, "NPSN harus 8 karakter"));

export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9._-]{3,30}$/, "Username 3–30 karakter: huruf, angka, titik, minus, garis bawah");

export const passwordSchema = z.string().min(8, "Password minimal 8 karakter").max(100);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const registrationSchema = z
  .object({
    npsn: npsnSchema,
    name: z.string().trim().min(5, "Nama sekolah minimal 5 karakter").max(150),
    shortName: z.string().trim().min(3, "Nama singkat minimal 3 karakter").max(50),
    level: z.enum(SCHOOL_LEVELS, { message: "Pilih jenjang" }),
    provinceCode: z.string({ message: "Pilih provinsi" }).regex(/^\d{2}$/, "Pilih provinsi"),
    regencyCode: z.string({ message: "Pilih kabupaten/kota" }).regex(/^\d{2}\.\d{2}$/, "Pilih kabupaten/kota"),
    address: optionalText(250),
    contactName: z.string().trim().min(3, "Nama penanggung jawab wajib diisi").max(100),
    contactPhone: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, "Nomor HP/WA tidak valid"),
    contactEmail: z
      .string()
      .trim()
      .max(150)
      .transform((v) => (v === "" ? null : v))
      .pipe(z.email("Email tidak valid").nullable()),
    adminName: z.string().trim().min(3, "Nama admin wajib diisi").max(100),
    adminUsername: usernameSchema,
    adminPassword: passwordSchema,
    adminPasswordConfirm: z.string(),
    /** Pernyataan wajib: sekolah negeri milik Pemda */
    declaration: z.literal("on", { message: "Centang pernyataan bahwa sekolah adalah sekolah negeri milik Pemerintah Daerah" }),
    /** Honeypot anti-bot: harus kosong */
    website: z.string().max(0).optional(),
  })
  .refine((d) => d.regencyCode.startsWith(d.provinceCode + "."), {
    message: "Kabupaten/kota tidak sesuai dengan provinsi",
    path: ["regencyCode"],
  })
  .refine((d) => d.adminPassword === d.adminPasswordConfirm, {
    message: "Konfirmasi password tidak sama",
    path: ["adminPasswordConfirm"],
  });

const nip = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^(\d{18})?$/, "NIP 18 digit (kosongkan bila tidak ada)"))
  .transform((v) => (v === "" ? null : v))
  .optional();

export const profileSchema = z.object({
  name: z.string().trim().min(5, "Nama sekolah minimal 5 karakter").max(150),
  shortName: z.string().trim().min(3, "Nama singkat minimal 3 karakter").max(50),
  address: optionalText(250),
  pemdaName: optionalText(150),
  dinasName: optionalText(150),
  addressFull: optionalText(300),
  kepsekName: optionalText(100),
  kepsekNip: nip,
  pengurusName: optionalText(100),
  pengurusNip: nip,
  penggunaName: optionalText(100),
  penggunaNip: nip,
});

const rupiah = z
  .string()
  .transform((v) => v.replace(/[^\d]/g, ""))
  .pipe(z.string().min(1, "Wajib diisi"))
  .transform(Number)
  .pipe(z.number().int().min(0).max(1_000_000_000_000));

export const KIB_GOLONGAN = ["B", "C", "D", "E", "F", "ATB"] as const;

/** Kode angka n digit; boleh diketik tanpa nol depan (8 → 08); kosong → null */
const padDigits = (n: number, label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || new RegExp(`^\\d{1,${n}}$`).test(v), `${label}: maksimal ${n} angka`)
    .transform((v) => (v === "" ? null : v.padStart(n, "0")));

/** Kode lokasi format SIMDA BMD (label Dinas) + pengaturan label */
export const bmdSettingsSchema = z.object({
  kodeProvinsi: padDigits(2, "Kode provinsi"),
  kodeKab: padDigits(2, "Kode kab/kota"),
  kodeBidang: padDigits(2, "Kode bidang"),
  kodeUnit: padDigits(2, "Kode unit"),
  kodeSubUnit: padDigits(3, "Kode sub unit"),
  kodeUpb: padDigits(2, "Kode UPB bawaan").transform((v) => v ?? "01"),
  labelQr: z.literal("on").optional().transform(Boolean),
  labelLogo: z.literal("on").optional().transform(Boolean),
  capDefault: rupiah,
  // Batas khusus per golongan; kosong = ikut batas umum
  ...Object.fromEntries(KIB_GOLONGAN.map((g) => [`cap_${g}`, z.string().optional()])),
});

export const workflowSchema = z.object({
  approvalLevels: z.enum(["1", "2"]).transform(Number),
  studentAccounts: z.literal("on").optional().transform(Boolean),
  distributionMode: z.enum(["LENGKAP", "RINGKAS"]),
  loanDefaultDays: z.coerce.number().int().min(1, "Minimal 1 hari").max(60, "Maksimal 60 hari"),
  unitLabel: z.string().trim().min(2).max(30),
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Isi password lama"),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Konfirmasi password tidak sama", path: ["confirm"] })
  .refine((d) => d.password !== d.current, { message: "Password baru harus berbeda", path: ["password"] });

const ROLE_VALUES = ["ADMIN", "KEPSEK", "VERIFIKATOR", "PETUGAS", "PENGUSUL", "PEMINJAM"] as const;

export const userSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]).optional(),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(100),
  username: usernameSchema,
  nip: nip,
  email: z
    .string()
    .trim()
    .max(150)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Email tidak valid").nullable())
    .optional(),
  roles: z.array(z.enum(ROLE_VALUES)).min(1, "Pilih minimal satu peran"),
  unitIds: z.array(z.uuid()),
  warehouseIds: z.array(z.uuid()),
  password: z.union([z.literal(""), passwordSchema]).optional(),
  isActive: z.boolean(),
});

export type RegistrationInput = z.output<typeof registrationSchema>;

export const schoolStatusChangeSchema = z.object({
  schoolId: z.uuid(),
  status: z.enum(["ACTIVE", "REJECTED", "SUSPENDED"]),
  note: optionalText(500),
});

/** Ubah FormData jadi objek biasa (checkbox tidak dicentang = tidak ada key; field internal Next `$ACTION_*` dibuang) */
export function formToObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) o[k] = v;
  return o;
}

export type FieldErrors = Record<string, string>;

/** Ambil pesan error pertama per field dari ZodError */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
