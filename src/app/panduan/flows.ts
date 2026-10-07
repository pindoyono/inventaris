/**
 * Flowchart alur penggunaan (Mermaid). Simpul pada `links` bisa diklik dan membuka halaman aplikasi;
 * daftar yang sama ditampilkan sebagai teks di bawah diagram (alternatif bila diagram tidak tampil).
 */
export type FlowLink = { node: string; label: string; href: string; who?: string };
export type Flow = { id: string; title: string; desc: string; topic: string; chart: string; links: FlowLink[] };

export const FLOWS: Flow[] = [
  {
    id: "umum",
    title: "Gambaran umum siklus BMD sekolah",
    desc: "Urutan besar penggunaan aplikasi dari pendaftaran sekolah sampai tutup buku semester.",
    topic: "mulai",
    chart: `flowchart TD
  A["Daftar sekolah (NPSN)"] --> B{"Diverifikasi pengelola platform?"}
  B -- "Ditolak / perlu perbaikan" --> A
  B -- "Disetujui" --> C["Masuk sebagai Admin sekolah"]
  C --> D["Penyiapan sekolah"]
  D --> E["Data dasar: unit, ruangan, gudang, sumber dana"]
  E --> F["Pengguna & peran"]
  F --> G["Impor data lama (Excel)"]
  G --> H["Perencanaan: pagu & usulan kebutuhan"]
  H --> I["Pengadaan & penerimaan barang"]
  I --> J{"Jenis barang?"}
  J -- "Habis pakai" --> K["Persediaan (FIFO)"]
  J -- "Aset tetap" --> L["Aset tetap per unit + label QR"]
  J -- "Bangunan / konstruksi" --> L2["KDP & renovasi"]
  L2 --> L
  K --> M["Permintaan barang oleh unit"]
  L --> N1["KIR per ruangan"]
  L --> N2["Peminjaman"]
  L --> N3["Pemanfaatan oleh pihak lain"]
  L --> O["Pemeliharaan"]
  K --> P["Audit semester: stock opname"]
  L --> P2["Audit semester: inventarisasi"]
  P2 --> Q["Penghapusan / pemindahtanganan"]
  M --> R["Laporan & cetak"]
  N1 --> R
  O --> R
  P --> R
  Q --> R
  R --> S["Tutup buku semester"]`,
    links: [
      { node: "A", label: "Daftar sekolah", href: "/daftar", who: "Operator sekolah" },
      { node: "C", label: "Masuk", href: "/login" },
      { node: "D", label: "Penyiapan sekolah", href: "/pengaturan", who: "Admin" },
      { node: "E", label: "Data dasar", href: "/data-dasar", who: "Admin, Petugas" },
      { node: "F", label: "Pengguna & peran", href: "/pengguna", who: "Admin" },
      { node: "G", label: "Impor Excel", href: "/impor", who: "Admin, Petugas" },
      { node: "H", label: "Usulan kebutuhan", href: "/usulan" },
      { node: "I", label: "Pengadaan", href: "/pengadaan", who: "Petugas" },
      { node: "K", label: "Persediaan", href: "/persediaan", who: "Petugas" },
      { node: "L", label: "Aset tetap", href: "/aset" },
      { node: "L2", label: "KDP & renovasi", href: "/aset/kdp", who: "Petugas" },
      { node: "M", label: "Permintaan barang", href: "/permintaan" },
      { node: "N1", label: "Kartu Inventaris Ruangan", href: "/laporan/kir" },
      { node: "N2", label: "Peminjaman", href: "/peminjaman" },
      { node: "N3", label: "Pemanfaatan", href: "/aset/pemanfaatan", who: "Petugas" },
      { node: "O", label: "Pemeliharaan", href: "/audit/pemeliharaan", who: "Petugas" },
      { node: "P", label: "Stock opname", href: "/audit/opname", who: "Petugas, Kepala Sekolah" },
      { node: "P2", label: "Inventarisasi aset", href: "/audit/inventarisasi", who: "Petugas" },
      { node: "Q", label: "Usulan penghapusan", href: "/audit/penghapusan" },
      { node: "R", label: "Laporan", href: "/laporan" },
      { node: "S", label: "Tutup buku", href: "/pengaturan/tutup-buku", who: "Admin, Kepala Sekolah" },
    ],
  },
  {
    id: "penyiapan",
    title: "Penyiapan awal sekolah",
    desc: "Dikerjakan Admin sekolah sekali di awal; semua isian bisa diubah lagi kapan saja.",
    topic: "penyiapan",
    chart: `flowchart TD
  A["Admin masuk pertama kali"] --> B["Ganti kata sandi"]
  B --> C["Profil & kop dokumen: alamat, Kepala Sekolah, Pengurus Barang"]
  C --> D["Kode BMD & batas kapitalisasi"]
  D --> E["Unit (jurusan, TU, perpustakaan, ...)"]
  E --> F1["Gedung"]
  F1 --> F2["Ruangan + penanggung jawab"]
  F2 --> G["Gudang persediaan"]
  G --> H["Satuan, sumber dana, komponen dana, penyedia"]
  H --> I["Alur kerja: tingkat persetujuan & mode distribusi"]
  I --> J["Pengguna & peran"]
  J --> K{"Punya data barang lama?"}
  K -- "Ya" --> L["Impor Excel: ruangan, pengguna, aset, persediaan + saldo awal"]
  K -- "Tidak" --> M["Tandai penyiapan selesai"]
  L --> M
  M --> N["Mulai bekerja dari Dasbor"]`,
    links: [
      { node: "B", label: "Ganti kata sandi", href: "/akun/password" },
      { node: "C", label: "Profil & kop dokumen", href: "/pengaturan/profil" },
      { node: "D", label: "Kode BMD & kapitalisasi", href: "/pengaturan/kode-bmd" },
      { node: "E", label: "Unit", href: "/data-dasar/unit" },
      { node: "F1", label: "Gedung", href: "/data-dasar/gedung" },
      { node: "F2", label: "Ruangan", href: "/data-dasar/ruangan" },
      { node: "G", label: "Gudang", href: "/data-dasar/gudang" },
      { node: "H", label: "Data dasar lain", href: "/data-dasar" },
      { node: "I", label: "Alur kerja", href: "/pengaturan/alur-kerja" },
      { node: "J", label: "Pengguna", href: "/pengguna" },
      { node: "L", label: "Impor Excel", href: "/impor" },
      { node: "M", label: "Halaman penyiapan", href: "/pengaturan" },
      { node: "N", label: "Dasbor", href: "/dasbor" },
    ],
  },
  {
    id: "usulan",
    title: "Usulan kebutuhan & pengadaan",
    desc: "Unit mengusulkan kebutuhan dalam batas pagu; setelah disetujui, Petugas membuat pengadaan dan menerima barang.",
    topic: "usulan-pengadaan",
    chart: `flowchart TD
  P0["Admin / Kepala Sekolah menetapkan pagu per unit & sumber dana"] --> A
  A["Pengusul menyiapkan usulan (draf)"] --> B["Ajukan usulan"]
  B --> C{"Persetujuan 2 tingkat?"}
  C -- "Ya" --> D["Verifikator memeriksa"]
  C -- "Tidak" --> E["Kepala Sekolah menyetujui (dicek terhadap sisa pagu)"]
  D --> E
  D -. "Kembalikan" .-> A
  E -. "Kembalikan" .-> A
  E -- "Tolak" --> X["Usulan ditolak"]
  E -- "Setujui" --> F["Petugas: buat pengadaan dari usulan"]
  G0["Pengadaan langsung (tanpa usulan)"] --> F2
  F --> F2["Isi penyedia, harga, sumber dana"]
  F2 --> G["Tandai dipesan"]
  G --> H["Terima barang (boleh bertahap)"]
  H --> I{"Jenis barang?"}
  I -- "Persediaan" --> J["Dokumen penerimaan otomatis diposting ke gudang"]
  I -- "Aset tetap" --> K["Aset dicatat per unit: register, kapitalisasi, QR"]
  J --> L["Pengadaan diterima penuh"]
  K --> L
  L --> M["Usulan ditandai selesai"]`,
    links: [
      { node: "P0", label: "Pagu", href: "/usulan/pagu", who: "Admin, Kepala Sekolah" },
      { node: "A", label: "Siapkan usulan", href: "/usulan/baru", who: "Pengusul" },
      { node: "B", label: "Daftar usulan", href: "/usulan" },
      { node: "D", label: "Usulan menunggu verifikasi", href: "/usulan", who: "Verifikator" },
      { node: "E", label: "Usulan menunggu persetujuan", href: "/usulan", who: "Kepala Sekolah" },
      { node: "F", label: "Pengadaan", href: "/pengadaan", who: "Petugas" },
      { node: "G0", label: "Pengadaan langsung", href: "/pengadaan/baru", who: "Petugas" },
      { node: "H", label: "Pengadaan (terima barang)", href: "/pengadaan", who: "Petugas" },
      { node: "J", label: "Dokumen stok", href: "/persediaan/dokumen" },
      { node: "K", label: "Daftar aset", href: "/aset" },
    ],
  },
  {
    id: "persediaan",
    title: "Persediaan (barang habis pakai)",
    desc: "Semua mutasi stok lewat dokumen yang diposting ke buku besar FIFO; dokumen salah dibatalkan, bukan dihapus.",
    topic: "persediaan",
    chart: `flowchart TD
  A["Daftar barang persediaan (kode NUSP, satuan, stok minimum)"] --> B["Saldo awal"]
  B --> C["Penerimaan: pembelian / hibah / lainnya"]
  C --> D["Posting dokumen → kartu barang (FIFO)"]
  D --> E{"Barang keluar karena?"}
  E -- "Permintaan unit" --> F["Penyaluran (BAST)"]
  E -- "Pindah gudang" --> G["Mutasi antar gudang"]
  E -- "Rusak / kedaluwarsa" --> H["Rusak / usang"]
  D -. "Salah input" .-> J["Batalkan dokumen (jurnal pembalik)"]
  F --> I["Kartu barang & laporan mutasi"]
  G --> I
  H --> I
  I --> W{"Stok di bawah minimum?"}
  W -- "Ya" --> W2["Notifikasi stok menipis"]
  I --> K["Stock opname tiap semester"]
  K --> L["Selisih dibukukan otomatis setelah disetujui"]
  L --> M["Buku penerimaan & pengeluaran, cetak"]`,
    links: [
      { node: "A", label: "Barang persediaan", href: "/persediaan" },
      { node: "B", label: "Dokumen saldo awal", href: "/persediaan/dokumen/baru?jenis=SALDO_AWAL" },
      { node: "C", label: "Dokumen penerimaan", href: "/persediaan/dokumen/baru?jenis=PENERIMAAN" },
      { node: "D", label: "Daftar dokumen stok", href: "/persediaan/dokumen" },
      { node: "F", label: "Dokumen penyaluran", href: "/persediaan/dokumen/baru?jenis=PENYALURAN" },
      { node: "G", label: "Dokumen mutasi", href: "/persediaan/dokumen/baru?jenis=MUTASI" },
      { node: "H", label: "Dokumen rusak/usang", href: "/persediaan/dokumen/baru?jenis=RUSAK_USANG" },
      { node: "J", label: "Daftar dokumen stok", href: "/persediaan/dokumen" },
      { node: "I", label: "Laporan mutasi", href: "/laporan/mutasi" },
      { node: "W2", label: "Barang stok menipis", href: "/persediaan?f=menipis" },
      { node: "K", label: "Stock opname", href: "/audit/opname" },
      { node: "M", label: "Buku persediaan", href: "/laporan/buku" },
    ],
  },
  {
    id: "permintaan",
    title: "Permintaan barang persediaan oleh unit",
    desc: "Alur mengikuti pengaturan sekolah: mode ringkas (langsung disalurkan) atau lengkap (surat permintaan → SPPB → BAST).",
    topic: "permintaan",
    chart: `flowchart TD
  A["Pengusul membuat nota permintaan (draf)"] --> B["Ajukan"]
  B --> C{"Mode distribusi sekolah?"}
  C -- "Ringkas" --> H["Petugas menyalurkan dari gudang"]
  C -- "Lengkap" --> D["Petugas meneruskan (surat permintaan)"]
  D --> E{"Persetujuan 2 tingkat?"}
  E -- "Ya" --> F["Verifikator memeriksa"]
  E -- "Tidak" --> G["Kepala Sekolah menyetujui (SPPB)"]
  F --> G
  G --> H
  D -. "Kembalikan / tolak" .-> A
  F -. "Kembalikan / tolak" .-> A
  G -. "Kembalikan / tolak" .-> A
  H --> I["BAST penyaluran; stok berkurang (FIFO)"]
  I --> J["Selesai; pengusul menerima notifikasi"]
  J --> K["Cetak nota, surat permintaan, SPPB, BAST"]`,
    links: [
      { node: "A", label: "Nota permintaan baru", href: "/permintaan/baru", who: "Pengusul" },
      { node: "B", label: "Daftar permintaan", href: "/permintaan" },
      { node: "C", label: "Pengaturan alur kerja", href: "/pengaturan/alur-kerja", who: "Admin" },
      { node: "D", label: "Permintaan masuk", href: "/permintaan", who: "Petugas" },
      { node: "F", label: "Permintaan menunggu verifikasi", href: "/permintaan", who: "Verifikator" },
      { node: "G", label: "Permintaan menunggu persetujuan", href: "/permintaan", who: "Kepala Sekolah" },
      { node: "H", label: "Permintaan siap disalurkan", href: "/permintaan", who: "Petugas" },
      { node: "I", label: "Dokumen stok", href: "/persediaan/dokumen" },
      { node: "J", label: "Notifikasi", href: "/notifikasi" },
    ],
  },
  {
    id: "aset",
    title: "Aset tetap: pencatatan sampai KIR",
    desc: "Setiap unit aset punya nomor register dan QR sendiri; posisi ruangan membentuk KIR.",
    topic: "aset",
    chart: `flowchart TD
  A{"Asal barang?"}
  A -- "Pengadaan" --> B["Diterima di menu Pengadaan"]
  A -- "Catat manual" --> C["Catat aset: kode barang, harga, jumlah unit"]
  A -- "Data lama" --> D["Impor Excel aset"]
  B --> E{"Harga ≥ batas kapitalisasi?"}
  C --> E
  D --> E
  E -- "Ya" --> F["Intrakomptabel"]
  E -- "Tidak" --> G["Ekstrakomptabel"]
  F --> H["Nomor register + token QR"]
  G --> H
  H --> I["Cetak label QR & tempel"]
  I --> J["Tempatkan di ruangan → masuk KIR"]
  J --> K["Pindah ruangan / ubah kondisi"]
  J --> L["Pindai QR: lihat data barang"]
  J --> M["Reklasifikasi / koreksi nilai"]
  J --> N["Tandai tidak digunakan untuk tusi"]
  K --> O["Status KIR: perlu diperbarui"]
  O --> P["Cetak KIR & tandai sudah ditempel"]`,
    links: [
      { node: "B", label: "Pengadaan", href: "/pengadaan" },
      { node: "C", label: "Catat aset", href: "/aset/baru", who: "Petugas" },
      { node: "D", label: "Impor Excel", href: "/impor" },
      { node: "E", label: "Batas kapitalisasi", href: "/pengaturan/kode-bmd", who: "Admin" },
      { node: "H", label: "Daftar aset", href: "/aset" },
      { node: "I", label: "Daftar aset (cetak label)", href: "/aset" },
      { node: "J", label: "KIR", href: "/laporan/kir" },
      { node: "K", label: "Daftar aset", href: "/aset" },
      { node: "L", label: "Pindai QR", href: "/pindai" },
      { node: "M", label: "Daftar aset (buka barangnya)", href: "/aset" },
      { node: "N", label: "Daftar aset (buka barangnya)", href: "/aset" },
      { node: "O", label: "Status KIR", href: "/laporan/kir/status" },
      { node: "P", label: "Status KIR", href: "/laporan/kir/status" },
    ],
  },
  {
    id: "peminjaman",
    title: "Peminjaman aset",
    desc: "Peminjam berakun mengajukan sendiri; siswa/tamu dicatatkan Petugas. Barang kembali memperbarui kondisi aset.",
    topic: "peminjaman",
    chart: `flowchart TD
  A{"Siapa yang memulai?"}
  A -- "Peminjam berakun" --> B["Ajukan peminjaman"]
  B --> C{"Petugas menyetujui?"}
  C -- "Ya" --> E
  C -- "Tolak" --> X["Ditolak"]
  A -- "Petugas (siswa / tamu)" --> D["Catat peminjaman langsung (bisa pindai label)"]
  D --> E["Barang diserahkan: status dipinjam, ada batas waktu"]
  E --> F{"Dikembalikan tepat waktu?"}
  F -- "Belum, lewat batas" --> G["Pengingat otomatis & daftar terlambat"]
  G --> H
  F -- "Ya" --> H["Terima kembali (sebagian/semua) + kondisi"]
  H --> I["Selesai; kondisi aset diperbarui"]
  I --> J["Cetak kartu peminjaman"]`,
    links: [
      { node: "B", label: "Ajukan peminjaman", href: "/peminjaman/baru", who: "Peminjam" },
      { node: "C", label: "Daftar peminjaman", href: "/peminjaman", who: "Petugas" },
      { node: "D", label: "Catat peminjaman", href: "/peminjaman/baru", who: "Petugas" },
      { node: "G", label: "Peminjaman terlambat", href: "/peminjaman?tab=terlambat" },
      { node: "H", label: "Daftar peminjaman", href: "/peminjaman" },
      { node: "J", label: "Daftar peminjaman", href: "/peminjaman" },
    ],
  },
  {
    id: "pemeliharaan",
    title: "Pemeliharaan & kapitalisasi",
    desc: "Setiap pekerjaan tercatat di kartu pemeliharaan aset; peningkatan bisa menambah nilai aset.",
    topic: "pemeliharaan",
    chart: `flowchart TD
  A["Aset rusak / jadwal servis"] --> B["Catat pemeliharaan: rutin, perbaikan, atau peningkatan"]
  B --> C{"Sudah selesai saat dicatat?"}
  C -- "Belum" --> D["Status aset: dalam pemeliharaan"]
  D --> E["Tandai selesai: tanggal, kondisi sesudah, biaya"]
  C -- "Sudah" --> E
  E --> F{"Peningkatan & dikapitalisasi?"}
  F -- "Ya" --> G["Nilai aset bertambah (tercatat di riwayat nilai)"]
  F -- "Tidak" --> H["Kartu pemeliharaan"]
  G --> H
  E --> I{"Masih rusak berat?"}
  I -- "Ya" --> J["Usulan penghapusan"]`,
    links: [
      { node: "B", label: "Catat pemeliharaan", href: "/audit/pemeliharaan/baru", who: "Petugas" },
      { node: "D", label: "Pemeliharaan berjalan", href: "/audit/pemeliharaan" },
      { node: "E", label: "Pemeliharaan berjalan", href: "/audit/pemeliharaan" },
      { node: "G", label: "Daftar aset", href: "/aset" },
      { node: "H", label: "Pemeliharaan", href: "/audit/pemeliharaan" },
      { node: "J", label: "Usulan penghapusan baru", href: "/audit/penghapusan/baru" },
    ],
  },
  {
    id: "audit",
    title: "Audit semester: stock opname & inventarisasi",
    desc: "Persediaan dihitung per gudang; aset dicocokkan per ruangan. Hasilnya otomatis memperbarui data.",
    topic: "audit",
    chart: `flowchart TD
  subgraph SO["Stock opname persediaan"]
    O1["Mulai opname per gudang (gudang dibekukan)"] --> O2["Hitung fisik: baik & rusak"]
    O2 --> O3["Ajukan ke Kepala Sekolah"]
    O3 --> O4{"Disetujui?"}
    O4 -- "Kembalikan" --> O2
    O4 -- "Setujui" --> O5["Selisih & barang rusak dibukukan; gudang dibuka"]
  end
  subgraph INV["Inventarisasi aset"]
    I1["Mulai inventarisasi per ruangan"] --> I2["Periksa: ditemukan? kondisi? (bisa pindai QR)"]
    I2 --> I3["Tandai temuan: perlu reklasifikasi / koreksi"]
    I3 --> I4["Selesaikan: kondisi diperbarui, tidak ditemukan → hilang"]
    I4 --> I5{"Tindak lanjut"}
    I5 -- "Temuan LHI" --> I6["Reklasifikasi / koreksi di halaman aset"]
    I5 -- "Barang hilang" --> I7["Usulan penghapusan"]
    I5 -- "Belum tercatat" --> I8["Catat aset (hasil inventarisasi)"]
  end
  O5 --> R["Berita acara & laporan pemantauan"]
  I6 --> R`,
    links: [
      { node: "O1", label: "Stock opname", href: "/audit/opname", who: "Petugas" },
      { node: "O3", label: "Stock opname", href: "/audit/opname" },
      { node: "O4", label: "Stock opname menunggu persetujuan", href: "/audit/opname", who: "Kepala Sekolah" },
      { node: "I1", label: "Inventarisasi", href: "/audit/inventarisasi", who: "Petugas" },
      { node: "I2", label: "Pindai QR", href: "/pindai" },
      { node: "I6", label: "Daftar aset", href: "/aset" },
      { node: "I7", label: "Usulan penghapusan baru", href: "/audit/penghapusan/baru" },
      { node: "I8", label: "Catat aset", href: "/aset/baru" },
      { node: "R", label: "Laporan Permendagri 7/2024", href: "/laporan/permendagri-7-2024" },
    ],
  },
  {
    id: "penghapusan",
    title: "Penghapusan & pemindahtanganan",
    desc: "Sekolah mengusulkan; barang baru dihapus dari daftar setelah SK Kepala Daerah dicatat.",
    topic: "penghapusan",
    chart: `flowchart TD
  A["Petugas menyiapkan draf usulan: pilih barang & alasan"] --> B{"Alasan?"}
  B -- "Rusak berat / usang" --> C{"Tindak lanjut?"}
  C -- "Pemusnahan" --> E
  C -- "Pemindahtanganan" --> D["Pilih bentuk: penjualan, tukar menukar, hibah, penyertaan modal"]
  D --> E
  B -- "Kecurian" --> B2["Isi nomor surat keterangan kepolisian"]
  B2 --> E
  B -- "Hilang / kahar / lainnya" --> E
  E["Kepala Sekolah mengajukan (barang: diusulkan hapus)"] --> F["Cetak surat usulan & RKBMD A.5 / A.3"]
  F --> G["Catat dikirim ke Dinas / BPKAD"]
  G --> H{"SK Kepala Daerah?"}
  H -- "Disetujui (semua / sebagian)" --> I["Catat SK: barang dihapus dari daftar barang"]
  H -- "Ditolak" --> J["Status barang dipulihkan"]
  I --> K["Laporan pemantauan C.13 & C.23"]`,
    links: [
      { node: "A", label: "Usulan penghapusan baru", href: "/audit/penghapusan/baru", who: "Petugas" },
      { node: "E", label: "Usulan penghapusan", href: "/audit/penghapusan", who: "Kepala Sekolah" },
      { node: "F", label: "Usulan penghapusan (cetak)", href: "/audit/penghapusan" },
      { node: "G", label: "Usulan penghapusan", href: "/audit/penghapusan" },
      { node: "I", label: "Usulan penghapusan (catat SK)", href: "/audit/penghapusan" },
      { node: "K", label: "Laporan Permendagri 7/2024", href: "/laporan/permendagri-7-2024" },
    ],
  },
  {
    id: "kdp",
    title: "KDP & renovasi aset pihak lain",
    desc: "Pembangunan yang belum selesai dicatat di KIB F; nilainya dari pembayaran. Selesai → menjadi aset definitif.",
    topic: "kdp",
    chart: `flowchart TD
  A{"Jenis pekerjaan?"}
  A -- "Membangun / mengadakan aset baru" --> B["Catat KDP (KIB F)"]
  A -- "Merenovasi aset milik pihak lain" --> C["Catat renovasi (aset tetap renovasi, KIB E)"]
  B --> D["Catat pembayaran termin → nilai bertambah"]
  C --> D
  D --> E["Perbarui progres fisik & target"]
  E --> F{"Keadaan pekerjaan?"}
  F -- "Berhenti" --> G["Hentikan (dengan alasan)"]
  G -. "Dilanjutkan lagi" .-> E
  F -- "Selesai, ada BAST" --> H{"KDP atau renovasi?"}
  H -- "KDP" --> I["Reklasifikasi otomatis ke aset definitif (KIB A–E)"]
  H -- "Renovasi" --> J["Tetap di KIB E; tetapkan tindak lanjut"]
  I --> K["Laporan C.21, C.25 & KIB F"]
  J --> K
  G --> K`,
    links: [
      { node: "B", label: "Catat KDP", href: "/aset/kdp/baru?jenis=KDP", who: "Petugas" },
      { node: "C", label: "Catat renovasi", href: "/aset/kdp/baru?jenis=ATR", who: "Petugas" },
      { node: "D", label: "Daftar KDP & renovasi", href: "/aset/kdp" },
      { node: "E", label: "Daftar KDP & renovasi", href: "/aset/kdp" },
      { node: "G", label: "Daftar KDP & renovasi", href: "/aset/kdp" },
      { node: "I", label: "Daftar aset", href: "/aset" },
      { node: "K", label: "Laporan Permendagri 7/2024", href: "/laporan/permendagri-7-2024" },
    ],
  },
  {
    id: "pemanfaatan",
    title: "Pemanfaatan & penggunaan oleh pihak lain",
    desc: "Dari rencana (RKBMD), persetujuan Pengelola/Kepala Daerah, perjanjian, sampai berakhir.",
    topic: "pemanfaatan",
    chart: `flowchart TD
  A{"Jenis kegiatan?"}
  A -- "Pemanfaatan" --> A1["Pilih bentuk: sewa, pinjam pakai, BGS/BSG, KSP, KSPI"]
  A -- "Penggunaan sementara / dioperasikan pihak lain" --> B
  A1 --> B{"Sudah berjalan?"}
  B -- "Belum" --> C["Catat rencana (masuk RKBMD A.1)"]
  C --> D{"Persetujuan Pengelola / Kepala Daerah?"}
  D -- "Ditolak" --> X["Ditolak"]
  D -- "Disetujui" --> E["Catat nomor & tanggal persetujuan"]
  E --> F["Mulai: mitra, perjanjian, jangka waktu, kontribusi"]
  B -- "Sudah" --> G["Catat yang sudah berjalan (tanpa nomor persetujuan → C.11)"]
  F --> H["Berjalan; pengingat 30, 7, dan 0 hari sebelum berakhir"]
  G --> H
  H --> I["Tandai selesai"]
  I --> J["Laporan C.5, C.7, C.9, C.11"]`,
    links: [
      { node: "C", label: "Catat rencana", href: "/aset/pemanfaatan/baru", who: "Petugas" },
      { node: "E", label: "Daftar pemanfaatan", href: "/aset/pemanfaatan" },
      { node: "F", label: "Daftar pemanfaatan", href: "/aset/pemanfaatan" },
      { node: "G", label: "Catat yang sudah berjalan", href: "/aset/pemanfaatan/baru" },
      { node: "H", label: "Daftar pemanfaatan", href: "/aset/pemanfaatan" },
      { node: "J", label: "Laporan Permendagri 7/2024", href: "/laporan/permendagri-7-2024" },
    ],
  },
  {
    id: "pengalihan",
    title: "Pengalihan aset ke sekolah lain (pengeluaran/penerimaan internal)",
    desc: "Penyerahan barang antar Kuasa Pengguna Barang di bawah Pengguna Barang (Dinas) yang sama.",
    topic: "pengalihan",
    chart: `flowchart TD
  A["Petugas pengirim: serahkan barang (draf)"] --> B{"Penerima memakai aplikasi ini?"}
  B -- "Ya" --> C["Pilih sekolah penerima"]
  B -- "Tidak" --> C2["Isi nama penerima di luar aplikasi"]
  C --> D["Surat persetujuan Pengguna Barang (Dinas)"]
  C2 --> D
  D --> E["BAST: catat nomor & tanggal → Serahkan"]
  E --> F["Barang keluar dari daftar pengirim (pengeluaran internal)"]
  F --> G["Cetak BAST"]
  F --> H{"Sekolah penerima"}
  H -- "Terima" --> I["Barang tercatat di penerima: nilai & tahun asal, register baru"]
  H -- "Tolak" --> J["Pengirim membatalkan → barang kembali"]
  I --> K["Laporan barang: mutasi kurang (pengirim) & tambah (penerima)"]`,
    links: [
      { node: "A", label: "Serahkan barang", href: "/aset/pengalihan/baru", who: "Petugas" },
      { node: "E", label: "Daftar pengalihan", href: "/aset/pengalihan" },
      { node: "G", label: "Daftar pengalihan (cetak BAST)", href: "/aset/pengalihan" },
      { node: "H", label: "Pengalihan masuk", href: "/aset/pengalihan", who: "Petugas penerima" },
      { node: "K", label: "Laporan barang", href: "/laporan/barang" },
    ],
  },
  {
    id: "laporan",
    title: "Laporan, cetak & tutup buku",
    desc: "Semua laporan disusun otomatis dari transaksi; bisa dilihat di layar, diunduh Excel, atau dicetak A4/F4.",
    topic: "laporan",
    chart: `flowchart TD
  A["Transaksi harian"] --> B["Menu Laporan"]
  B --> C["KIR per ruangan"]
  B --> D["KIB A–F"]
  B --> E["Mutasi persediaan"]
  B --> F["Buku penerimaan & pengeluaran"]
  B --> G["Permendagri 7/2024: RKBMD, dokumen kepemilikan, pemantauan"]
  B --> L["Laporan barang bulanan/semesteran + penyusutan + Daftar Barang Kuasa Pengguna"]
  B --> X["Ekspor KIB lengkap (rekonsiliasi)"]
  L --> I
  C --> C2["Status KIR & cetak semua ruangan"]
  C --> H["Unduh Excel / CSV"]
  D --> H
  E --> H
  C --> I["Cetak A4/F4 atau simpan PDF"]
  D --> I
  E --> I
  F --> I
  G --> I
  I --> J["Ditandatangani & diserahkan ke Dinas / BPKAD"]
  J --> K["Tutup buku semester"]`,
    links: [
      { node: "B", label: "Laporan", href: "/laporan" },
      { node: "C", label: "KIR", href: "/laporan/kir" },
      { node: "C2", label: "Status KIR", href: "/laporan/kir/status" },
      { node: "D", label: "KIB", href: "/laporan/kib?gol=B" },
      { node: "E", label: "Mutasi persediaan", href: "/laporan/mutasi" },
      { node: "F", label: "Buku persediaan", href: "/laporan/buku" },
      { node: "G", label: "Permendagri 7/2024", href: "/laporan/permendagri-7-2024" },
      { node: "L", label: "Laporan barang", href: "/laporan/barang" },
      { node: "X", label: "Ekspor KIB lengkap", href: "/laporan" },
      { node: "K", label: "Tutup buku", href: "/pengaturan/tutup-buku", who: "Admin, Kepala Sekolah" },
    ],
  },
];

export const flowById = (id: string) => FLOWS.find((f) => f.id === id);

/** Definisi Mermaid lengkap: gaya simpul + tautan klik */
export function chartSource(f: Flow) {
  const clicks = f.links.map((l) => `  click ${l.node} href "${l.href}" "${l.label.replaceAll('"', "'")}"`).join("\n");
  const linked = [...new Set(f.links.map((l) => l.node))].join(",");
  return `${f.chart}
  classDef link fill:#ccfbf1,stroke:#0f766e,stroke-width:1.5px,color:#134e4a,cursor:pointer
  class ${linked} link
${clicks}`;
}
