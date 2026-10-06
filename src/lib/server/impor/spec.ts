/** Definisi kolom impor Excel (dipakai template, pembaca berkas, dan halaman petunjuk) */

export type Col = { key: string; header: string; required?: boolean; example: string; help: string; aliases?: string[] };
export type ImportKind = "ruangan" | "pengguna" | "aset" | "persediaan";

export const IMPORT_SPECS: Record<ImportKind, { title: string; desc: string; cols: Col[] }> = {
  ruangan: {
    title: "Ruangan",
    desc: "Daftar ruangan untuk KIR. Gedung dan unit yang belum ada dibuat otomatis.",
    cols: [
      { key: "nama", header: "Nama Ruangan", required: true, example: "Lab Komputer 1", help: "Nama unik ruangan", aliases: ["ruangan", "nama"] },
      { key: "kode", header: "Kode Ruangan", example: "LK1", help: "Opsional" },
      { key: "gedung", header: "Gedung", example: "Gedung B", help: "Nama gedung; dibuat otomatis bila belum ada" },
      { key: "lantai", header: "Lantai", example: "1", help: "Opsional" },
      { key: "unit", header: "Unit", example: "Teknik Komputer dan Jaringan", help: "Unit pemakai; dibuat otomatis bila belum ada" },
      { key: "pj", header: "Penanggung Jawab", example: "Andi Saputra, S.Kom.", help: "Dicetak di KIR", aliases: ["penanggung jawab ruangan", "pj"] },
      { key: "nip_pj", header: "NIP Penanggung Jawab", example: "198804042011011004", help: "18 digit, opsional", aliases: ["nip pj", "nip"] },
    ],
  },
  pengguna: {
    title: "Pengguna",
    desc: "Akun guru/staf. Password awal wajib diganti saat pertama masuk; bila dikosongkan, dibuatkan otomatis dan ditampilkan sekali setelah impor.",
    cols: [
      { key: "nama", header: "Nama Lengkap", required: true, example: "Budi Santoso, S.Pd.", help: "", aliases: ["nama"] },
      { key: "username", header: "Username", required: true, example: "budi.santoso", help: "3–30 karakter: huruf, angka, titik, minus, garis bawah" },
      { key: "nip", header: "NIP", example: "198501012010011001", help: "18 digit, opsional" },
      { key: "email", header: "Email", example: "budi@sekolah.sch.id", help: "Untuk notifikasi, opsional" },
      { key: "peran", header: "Peran", required: true, example: "Pengusul, Peminjam", help: "Pisahkan dengan koma: Admin, Kepala Sekolah, Verifikator, Petugas, Pengusul, Peminjam" },
      { key: "unit", header: "Unit", example: "Teknik Komputer dan Jaringan", help: "Lingkup Pengusul; pisahkan dengan koma; unit harus sudah ada" },
      { key: "password", header: "Password Awal", example: "", help: "Minimal 8 karakter; kosongkan agar dibuat otomatis", aliases: ["password"] },
    ],
  },
  aset: {
    title: "Aset tetap (KIB/KIR lama)",
    desc: "Satu baris boleh mewakili beberapa unit sejenis (kolom Jumlah). Nomor register dari Dinas/BPKAD bisa diisi agar sama dengan register lama.",
    cols: [
      { key: "kode", header: "Kode Barang", required: true, example: "1.3.2.10.01.02.002", help: "Kode barang Permendagri 108/2016 tingkat 7 (golongan A–F)", aliases: ["kode barang", "kode"] },
      { key: "nama", header: "Nama Barang", required: true, example: "Laptop guru", help: "Nama/jenis barang", aliases: ["jenis barang", "nama barang", "jenis/nama barang", "nama"] },
      { key: "merk", header: "Merk/Tipe", example: "Lenovo ThinkPad E14", help: "", aliases: ["merk", "merk/type", "merek", "tipe"] },
      { key: "tanggal", header: "Tanggal Perolehan", required: true, example: "2024-03-15", help: "Tanggal (atau tahun saja, mis. 2019 → 1 Januari 2019)", aliases: ["tahun perolehan", "tahun pembelian", "tahun", "tanggal"] },
      { key: "harga", header: "Harga Satuan", required: true, example: "8500000", help: "Harga per unit (Rp)", aliases: ["harga satuan (rp)", "harga perolehan satuan", "harga"] },
      { key: "jumlah", header: "Jumlah", example: "1", help: "Banyaknya unit; bawaan 1" },
      { key: "register", header: "Nomor Register", example: "000014", help: "Nomor awal (mis. 21) atau rentang \"000021 s/d 000044\"; kosong = lanjut otomatis", aliases: ["no register", "no. register", "register"] },
      { key: "ruangan", header: "Ruangan", example: "Lab Komputer 1", help: "Harus sudah ada (impor ruangan dulu)", aliases: ["lokasi"] },
      { key: "kondisi", header: "Kondisi", example: "Baik", help: "Baik / Rusak Ringan / Rusak Berat (atau B / RR / RB)" },
      { key: "asal", header: "Cara Perolehan", example: "Pembelian", help: "Pembelian / Hibah / Produksi / Inventarisasi / Lainnya", aliases: ["asal-usul", "asal usul", "asal"] },
      { key: "dana", header: "Sumber Dana", example: "BOS Reguler", help: "Nama atau kode sumber dana di Data Dasar, opsional" },
      { key: "ukuran", header: "Ukuran/CC", example: "", help: "KIB B, opsional", aliases: ["ukuran", "ukuran / cc"] },
      { key: "bahan", header: "Bahan", example: "Campuran", help: "KIB B, opsional" },
      { key: "no_pabrik", header: "Nomor Pabrik", example: "PF3XK21", help: "Nomor seri, opsional", aliases: ["pabrik", "nomor seri", "no seri"] },
      { key: "no_rangka", header: "Nomor Rangka", example: "", help: "Kendaraan, opsional", aliases: ["rangka"] },
      { key: "no_mesin", header: "Nomor Mesin", example: "", help: "Kendaraan, opsional", aliases: ["mesin"] },
      { key: "no_polisi", header: "Nomor Polisi", example: "", help: "Kendaraan, opsional", aliases: ["polisi"] },
      { key: "no_bpkb", header: "Nomor BPKB", example: "", help: "Kendaraan, opsional", aliases: ["bpkb"] },
      { key: "luas", header: "Luas (m2)", example: "", help: "KIB A/C/D, opsional", aliases: ["luas"] },
      { key: "alamat", header: "Letak/Alamat", example: "", help: "KIB A/C, opsional", aliases: ["alamat", "letak"] },
      { key: "keterangan", header: "Keterangan", example: "", help: "" },
    ],
  },
  persediaan: {
    title: "Barang persediaan + saldo awal",
    desc: "Membuat barang persediaan (NUSP otomatis) dan sekaligus dokumen saldo awal per gudang & tanggal yang langsung diposting.",
    cols: [
      { key: "kode", header: "Kode Barang", required: true, example: "1.1.7.01.03.02.001", help: "Kode barang persediaan 1.1.7 tingkat 7", aliases: ["kode barang", "kode"] },
      { key: "nama", header: "Nama Barang", required: true, example: "Kertas HVS A4 70 gram", help: "Bila nama sudah ada, barang yang ada dipakai", aliases: ["nama/spesifikasi barang", "nama"] },
      { key: "spesifikasi", header: "Spesifikasi", example: "Merk Sidu", help: "Opsional" },
      { key: "satuan", header: "Satuan", required: true, example: "Rim", help: "Satuan di Data Dasar; dibuat otomatis bila belum ada" },
      { key: "stok_min", header: "Stok Minimum", example: "5", help: "Opsional", aliases: ["stok minimum", "minimum"] },
      { key: "gudang", header: "Gudang", example: "Gudang Utama", help: "Kosong = gudang utama" },
      { key: "jumlah", header: "Jumlah Saldo Awal", example: "20", help: "Kosong/0 = hanya buat barang tanpa saldo", aliases: ["saldo awal", "jumlah", "stok"] },
      { key: "harga", header: "Harga Satuan", example: "52000", help: "Wajib bila ada saldo awal", aliases: ["harga satuan (rp)", "harga"] },
      { key: "tanggal", header: "Tanggal Saldo Awal", example: "2026-07-01", help: "Kosong = hari ini", aliases: ["tanggal"] },
    ],
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();

/** Cocokkan judul kolom berkas ke kunci spesifikasi */
export function mapHeaders(kind: ImportKind, headers: string[]) {
  const map = new Map<number, string>();
  const cols = IMPORT_SPECS[kind].cols;
  headers.forEach((h, i) => {
    const n = norm(h);
    const c = cols.find((c) => norm(c.header) === n) ?? cols.find((c) => c.aliases?.some((a) => norm(a) === n));
    if (c && ![...map.values()].includes(c.key)) map.set(i, c.key);
  });
  const missing = cols.filter((c) => c.required && ![...map.values()].includes(c.key)).map((c) => c.header);
  return { map, missing };
}
