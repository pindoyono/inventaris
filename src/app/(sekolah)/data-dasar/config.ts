/** Definisi data dasar sekolah — dipakai server (validasi/simpan) dan klien (form/tabel). */

export type RefKey = "buildings" | "units" | "rooms" | "fundingSources";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox";
  required?: boolean;
  max?: number;
  ref?: RefKey;
  hint?: string;
  pattern?: { re: string; message: string };
  list?: boolean;
  suggestions?: string[];
};

export type EntityDef = { title: string; singular: string; desc: string; fields: FieldDef[] };

const nameField = (label = "Nama", max = 100): FieldDef => ({ name: "name", label, type: "text", required: true, max, list: true });

export const ENTITIES = {
  unit: {
    title: "Unit",
    singular: "unit",
    desc: "Bagian pemakai barang: jurusan/program keahlian, laboratorium, perpustakaan, tata usaha, dsb.",
    fields: [
      nameField(),
      {
        name: "kind", label: "Jenis", type: "text", max: 50, list: true,
        suggestions: ["Program Keahlian", "Laboratorium", "Bengkel", "Perpustakaan", "Tata Usaha", "Kesiswaan", "Kurikulum", "Sarana Prasarana", "UKS", "Lainnya"],
      },
      { name: "isActive", label: "Aktif", type: "checkbox", list: true },
    ],
  },
  gedung: {
    title: "Gedung",
    singular: "gedung",
    desc: "Gedung/bangunan tempat ruangan berada.",
    fields: [nameField(), { name: "code", label: "Kode", type: "text", max: 20, list: true }],
  },
  ruangan: {
    title: "Ruangan",
    singular: "ruangan",
    desc: "Ruangan untuk Kartu Inventaris Ruangan (KIR). Penanggung jawab dicetak di KIR.",
    fields: [
      nameField(),
      { name: "code", label: "Kode", type: "text", max: 20, list: true },
      { name: "buildingId", label: "Gedung", type: "select", ref: "buildings", list: true },
      { name: "unitId", label: "Unit", type: "select", ref: "units", list: true },
      { name: "floor", label: "Lantai", type: "text", max: 10 },
      { name: "picName", label: "Penanggung jawab", type: "text", max: 100, list: true },
      { name: "picNip", label: "NIP penanggung jawab", type: "text", max: 30, pattern: { re: "^(\\d{18})?$", message: "NIP 18 digit" } },
    ],
  },
  gudang: {
    title: "Gudang",
    singular: "gudang",
    desc: "Tempat penyimpanan persediaan. Satu gudang menjadi gudang utama (bawaan).",
    fields: [
      nameField(),
      { name: "roomId", label: "Ruangan", type: "select", ref: "rooms", list: true },
      { name: "unitId", label: "Unit pengelola", type: "select", ref: "units", list: true },
      { name: "isDefault", label: "Gudang utama", type: "checkbox", list: true },
      { name: "isActive", label: "Aktif", type: "checkbox", list: true },
    ],
  },
  satuan: {
    title: "Satuan",
    singular: "satuan",
    desc: "Satuan barang (buah, unit, rim, dsb.).",
    fields: [nameField("Nama satuan", 30)],
  },
  "sumber-dana": {
    title: "Sumber Dana",
    singular: "sumber dana",
    desc: "Sumber perolehan barang. BOSP mengikuti Permendikdasmen 8/2026.",
    fields: [
      { name: "code", label: "Kode", type: "text", required: true, max: 30, list: true, pattern: { re: "^[A-Z0-9_]+$", message: "Huruf besar, angka, garis bawah" } },
      nameField(),
      { name: "isActive", label: "Aktif", type: "checkbox", list: true },
    ],
  },
  "komponen-dana": {
    title: "Komponen Dana",
    singular: "komponen dana",
    desc: "Komponen penggunaan dana per sumber, mis. komponen BOS Reguler.",
    fields: [
      { name: "fundingSourceId", label: "Sumber dana", type: "select", ref: "fundingSources", required: true, list: true },
      nameField("Nama komponen", 200),
      { name: "isActive", label: "Aktif", type: "checkbox", list: true },
    ],
  },
  penyedia: {
    title: "Penyedia",
    singular: "penyedia",
    desc: "Toko/penyedia barang untuk penerimaan.",
    fields: [
      nameField("Nama penyedia", 150),
      { name: "address", label: "Alamat", type: "textarea", max: 250 },
      { name: "phone", label: "Telepon", type: "text", max: 30, list: true },
      { name: "npwp", label: "NPWP", type: "text", max: 25, list: true },
    ],
  },
} satisfies Record<string, EntityDef>;

export type EntitySlug = keyof typeof ENTITIES;
export const isEntitySlug = (s: string): s is EntitySlug => Object.hasOwn(ENTITIES, s);
