# Rancangan Sistem Inventaris Sekolah (Multi-Sekolah)

Status: **draf untuk disetujui** · Versi 0.1 · 6 Oktober 2026
Sumber kebutuhan: `system_architecture_prd_summary.md` + 4 putaran tanya-jawab keputusan (ringkasan di §1).

Dokumen ini adalah acuan tunggal selama pengembangan. Bagian yang masih perlu keputusan ditandai **[KEPUTUSAN]** di §14.

---

## 1. Ringkasan Keputusan

| Aspek | Keputusan |
|---|---|
| Cakupan | Semua jenjang (SD/MI, SMP/MTs, SMA/MA/SMK, SLB, lainnya); satu platform, banyak sekolah |
| Identitas sekolah | **NPSN** (unik). Pendaftaran berstatus *menunggu* sampai disetujui pengelola platform |
| Stack | Next.js 16 (App Router) + TypeScript + PostgreSQL + Drizzle ORM + Auth.js v5 + Tailwind |
| Infrastruktur | systemd + Nginx + PostgreSQL yang sudah ada; realtime via SSE + Postgres `LISTEN/NOTIFY` (tanpa Redis); file di disk lokal di balik antarmuka storage (siap pindah ke S3/MinIO) |
| Pengguna | Peran tetap yang bisa diaktifkan/dinonaktifkan per sekolah; satu orang boleh memegang beberapa peran |
| Akun siswa | Opsional per sekolah (default mati; petugas mencatat peminjaman atas nama siswa) |
| Aset tetap | Dicatat **per unit**: kode + QR sendiri, nomor seri, kondisi, lokasi |
| Barang habis pakai | Stok per **gudang** (banyak gudang per sekolah); nilai dihitung **FIFO** |
| Persetujuan usulan | 1 atau 2 tingkat, diatur per sekolah (default 2: Verifikator → Kepala Sekolah) |
| Dokumen cetak | Kartu Penerimaan, Kartu Pengeluaran, Kartu Peminjaman, Kartu Stok, KIR, KIB, Laporan Mutasi Persediaan, Berita Acara (penerimaan/serah terima, penghapusan, stock opname) |
| Audit | Stock opname, penghapusan barang, pemeliharaan aset, log aktivitas |
| Notifikasi | Di aplikasi + email (SMTP) |
| Kode barang | Kode internal otomatis (untuk QR) + kolom opsional Kode Barang BMD (Permendagri 108/2014) |
| PWA | Bisa di-install & scan QR via kamera; **transaksi wajib online** (tidak ada mode offline) |
| Nama & alamat | **Inventaris** — `inventaris.ankdev.id` |
| Pengembangan | Bertahap; setiap fase diuji lalu langsung live (§12) |

---

## 2. Konsep Inti

Lima prinsip yang dipegang di seluruh rancangan:

1. **Setiap data milik satu sekolah.** Semua tabel operasional punya `school_id`. Isolasi ditegakkan di dua lapis: kode aplikasi (query selalu memakai `school_id` dari sesi) **dan** Row-Level Security PostgreSQL (§9.2). Bug satu query tidak bisa membocorkan data sekolah lain.
2. **Stok berasal dari buku besar, bukan diedit.** Angka stok hanya berubah lewat *posting* dokumen (penerimaan, pengeluaran, mutasi, penyesuaian). Setiap posting menulis baris `stock_movements` yang tidak bisa diubah/dihapus. Kartu Stok = isi buku besar itu.
3. **Dokumen: draf → diposting → (dibatalkan lewat dokumen pembalik).** Setelah diposting, dokumen terkunci. Koreksi dilakukan dengan dokumen pembalik yang juga tercatat — jejak audit utuh.
4. **Satu konsep untuk semua jenjang.** Istilah khas SMK (jurusan, lab, toolman) dipetakan ke konsep umum: *Unit* (jurusan/lab/bidang/kelas), *Gudang*, *Ruangan*, *Petugas Barang*. Sekolah memilih label yang cocok saat setup.
5. **Tidak ada stok negatif & tidak ada selisih.** Posting memakai transaksi ACID + `SELECT … FOR UPDATE` pada baris saldo & lot; constraint database (`CHECK qty >= 0`) menjadi pengaman terakhir.

---

## 3. Pengguna & Hak Akses

### 3.1 Jenis akun

| Akun | Lingkup | Login |
|---|---|---|
| Pengelola Platform | Seluruh platform: menyetujui/menonaktifkan sekolah | `/platform/login` — username + password |
| Pengguna Sekolah | Satu sekolah | `/login` — **NPSN + username + password** |

Username unik **per sekolah** (setiap sekolah boleh punya `admin`).

### 3.2 Peran sekolah

Satu pengguna dapat memiliki beberapa peran (tabel `user_roles`). Sekolah dapat menonaktifkan peran yang tidak dipakai (mis. SD tanpa Verifikator → persetujuan 1 tingkat).

| Peran | Untuk | Padanan PRD |
|---|---|---|
| **Admin Sekolah** | Pengaturan sekolah, pengguna, data dasar | — |
| **Kepala Sekolah** | Persetujuan akhir, semua laporan, dashboard | Kepala Sekolah / Manajemen |
| **Verifikator** | Verifikasi usulan & anggaran (tingkat 1) | Wakasek Sarpras |
| **Petugas Barang** | Penerimaan, pengeluaran, mutasi, peminjaman, opname, cetak QR — dapat dibatasi ke gudang tertentu | Petugas Gudang / Toolman |
| **Pengusul** | Mengajukan usulan kebutuhan & permintaan barang untuk unitnya | Guru / Kaprog |
| **Peminjam** | Mengajukan peminjaman alat sendiri (hanya jika akun siswa/guru-peminjam diaktifkan) | Siswa |

### 3.3 Matriks hak akses (ringkas)

| Kemampuan | Admin | Kepsek | Verifikator | Petugas | Pengusul | Peminjam |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Pengaturan sekolah, pengguna, data dasar | ✔ | lihat | | | | |
| Katalog barang & gudang | ✔ | lihat | lihat | ✔ | lihat | |
| Buat/ajukan usulan | | | | | ✔ (unitnya) | |
| Verifikasi usulan (tingkat 1) | | | ✔ | | | |
| Setujui usulan (akhir) | | ✔ | | | | |
| Pengadaan & penerimaan | | lihat | lihat | ✔ | | |
| Pengeluaran & mutasi | | lihat | lihat | ✔ (gudangnya) | minta | |
| Peminjaman | | lihat | lihat | ✔ | ajukan | ajukan (bila aktif) |
| Stock opname | | setujui | lihat | ✔ | | |
| Penghapusan barang | | setujui | verifikasi | usulkan | | |
| Pemeliharaan aset | | lihat | lihat | ✔ | | |
| Laporan & cetak kartu | ✔ | ✔ | ✔ | ✔ | unitnya | |
| Log aktivitas | ✔ | ✔ | | | | |

Hak akses diperiksa di server (server action/route), bukan hanya disembunyikan di UI.

---

## 4. Alur Registrasi & Setup Sekolah

```
/daftar  →  status PENDING  →  Pengelola Platform setujui  →  ACTIVE  →  Wizard setup  →  siap dipakai
                              ↘ tolak (REJECTED) / nonaktifkan kapan pun (SUSPENDED)
```

**Form pendaftaran:** NPSN (8 karakter), nama sekolah & nama singkat, jenjang, status (negeri/swasta), alamat, kab/kota, provinsi, penanggung jawab + HP/WA + email, akun admin pertama (nama, username, password ≥ 8). Honeypot anti-bot + rate limit Nginx.

**Panel pengelola platform:** daftar sekolah per status, tautan cek NPSN ke `referensi.data.kemdikbud.go.id`, setujui/tolak/nonaktifkan dengan catatan. Sekolah nonaktif langsung terkunci walau sesinya masih berlaku (status dicek ulang setiap request).

**Wizard setup (sekali, setelah disetujui)** — bisa dilewati & diubah kapan pun di Pengaturan:
1. **Profil & kop surat:** logo, alamat lengkap, nama & NIP Kepala Sekolah dan Pengurus Barang (dipakai di tanda tangan semua dokumen cetak).
2. **Template jenjang:** memilih template data dasar (§5.2) — terisi otomatis, bisa disunting.
3. **Struktur:** unit (jurusan/bidang/kelas), gedung & ruangan, gudang.
4. **Alur kerja:** persetujuan 1/2 tingkat, akun siswa aktif/tidak, batas hari peminjaman default, prefiks kode barang.
5. **Pengguna:** tambah pengguna & peran (atau impor Excel).
6. **Saldo awal:** impor Excel barang habis pakai (stok awal per gudang + harga) dan aset tetap (per unit). Diposting sebagai dokumen *Saldo Awal*.

---

## 5. Data Dasar

### 5.1 Entitas

| Entitas | Isi | Catatan |
|---|---|---|
| **Unit** | Jurusan / laboratorium / bidang / kelas | Label jenis unit bisa disesuaikan (mis. SD: "Kelas", SMK: "Program Keahlian") |
| **Gedung & Ruangan** | Lokasi fisik aset | Dasar KIR; ruangan opsional terhubung ke unit |
| **Gudang** | Tempat penyimpanan barang habis pakai | Minimal 1 (Gudang Utama); boleh terhubung ke unit (gudang lab) dan dibatasi ke petugas tertentu |
| **Kategori** | Pohon 2 tingkat; tipe *Aset* atau *Habis Pakai*; golongan KIB (B/C/E…) & prefiks kode BMD opsional | |
| **Satuan** | pcs, unit, set, rim, box, liter, meter, kg, … | |
| **Sumber Dana** | BOS Reguler, BOS Kinerja, BOSDA/BOP, Komite, Yayasan, Hibah, Lainnya | Dipakai di usulan, pengadaan, penerimaan, laporan |
| **Penyedia** | Toko/vendor | Nama, alamat, NPWP opsional |
| **Pagu Anggaran** | Batas anggaran per unit × sumber dana × tahun | Opsional; dipakai Verifikator saat menilai usulan |
| **Tahun Anggaran & Periode** | Default Januari–Desember; periode bulanan bisa *ditutup* (§6.6) | |

### 5.2 Template per jenjang

Disediakan agar sekolah tidak mulai dari nol. Contoh isi:

| Template | Unit | Kategori contoh |
|---|---|---|
| SD/MI | Kelas 1–6, Perpustakaan, UKS | ATK, Alat Kebersihan, Alat Peraga, Buku, Mebeler, Elektronik |
| SMP/MTs, SMA/MA | Mapel/Lab IPA, Lab Komputer, Perpustakaan, TU | + Alat Lab IPA, Bahan Kimia, Alat Olahraga |
| SMK | Per program keahlian (diisi sekolah) + Bengkel/Lab | + Mesin & Peralatan Bengkel, Bahan Praktik per jurusan, Alat Ukur, Kit Robotik |
| SLB | Kelas/ketunaan, Ruang Terapi | + Alat Bantu Khusus |

---

## 6. Barang, Stok & Mesin Posting

### 6.1 Dua jenis barang

| | Barang Habis Pakai | Aset Tetap |
|---|---|---|
| Dicatat sebagai | **Item katalog** + saldo per gudang | **Item katalog** + **unit aset** satu per satu |
| Kode / QR | Kode item (QR untuk ambil cepat saat pengeluaran) | Kode unit aset (label QR ditempel di barang) |
| Bisa dipinjam | Tidak | Ya |
| Nilai | FIFO per lot penerimaan | Harga perolehan per unit |
| Laporan utama | Kartu Stok, Mutasi Persediaan | KIR, KIB, Kartu Peminjaman |

### 6.2 Kode barang & QR

- **Kode item:** `{PREFIKS}-{KODEKATEGORI}-{URUT}` — contoh `ATK-0012`.
- **Kode unit aset:** `{PREFIKS-SEKOLAH}/{KODEKATEGORI}/{TAHUN}/{URUT}` — contoh `INV/KOM/2026/0007`; nomor urut per sekolah per kategori per tahun, dibuat atomik (tabel `doc_counters` + `FOR UPDATE`).
- **Kode BMD:** kolom opsional di item & unit aset untuk laporan KIB (sekolah negeri).
- **Isi QR:** URL `https://inventaris.ankdev.id/q/{token}` dengan *token acak* (bukan kode berurutan) supaya tidak bisa ditebak/di-scan massal. Bila yang memindai sudah login sebagai pengguna sekolah itu → membuka halaman aset/aksi cepat; bila tidak → info minimal (nama barang, sekolah, "milik inventaris sekolah").
- **Cetak label:** lembar label A4 (beberapa ukuran umum) berisi QR + kode + nama + sekolah.

### 6.3 Buku besar stok

```
stock_lots       : satu baris per penerimaan barang habis pakai per gudang
                   (qty_masuk, qty_sisa, harga_satuan, tanggal) — dasar FIFO
stock_balances   : saldo terkini per item × gudang (qty, nilai) — dikunci saat posting
stock_movements  : buku besar, TIDAK BISA diubah/dihapus (dijaga trigger DB)
                   jenis: SALDO_AWAL, MASUK, KELUAR, MUTASI_KELUAR, MUTASI_MASUK,
                          PENYESUAIAN_TAMBAH, PENYESUAIAN_KURANG, PEMBALIK
                   simpan: qty, harga satuan, nilai, saldo qty & nilai SESUDAH baris ini,
                           referensi dokumen & baris, lot, tanggal transaksi, pembuat
```

**Kartu Stok** (per item per gudang, rentang tanggal) = saldo awal periode + baris `stock_movements` berurutan, dengan kolom *Masuk | Keluar | Saldo* (qty & rupiah). Karena saldo sesudah tiap baris disimpan saat posting, kartu stok selalu konsisten dengan saldo saat itu.

### 6.4 Algoritma posting (satu transaksi database)

```
BEGIN
  kunci nomor dokumen           (doc_counters FOR UPDATE)
  urutkan baris dokumen menurut (item_id, gudang_id)       -- cegah deadlock
  untuk tiap baris:
    SELECT stock_balances ... FOR UPDATE                    -- kunci saldo item×gudang
    jika MASUK      : buat stock_lot baru (qty_sisa = qty)
    jika KELUAR     : ambil lot qty_sisa > 0 urut (tanggal, id) FOR UPDATE,
                      kurangi FIFO; jika total tidak cukup → BATAL (stok tidak cukup)
                      nilai keluar = Σ(qty diambil × harga lot)   -- bisa >1 lot per baris
    tulis stock_movements (dengan saldo sesudah)
    update stock_balances
  tandai dokumen POSTED, catat log aktivitas
COMMIT
NOTIFY school_<id>   -- dashboard realtime
```

Pengaman tambahan: `CHECK (qty_sisa >= 0)`, `CHECK (qty >= 0)` di saldo, trigger yang menolak `UPDATE/DELETE` pada `stock_movements`. Mesin posting diuji dengan tes unit FIFO **dan** tes konkurensi (banyak pengeluaran paralel dari stok yang sama tidak boleh menghasilkan stok negatif).

> PRD menyarankan *database trigger* untuk memperbarui stok. Rancangan ini memilih **layanan posting di aplikasi** (lebih mudah diuji & dibaca) dengan **constraint + trigger penjaga** di database. Hasil yang dijamin sama: stok tidak pernah selisih.

### 6.5 Aset per unit

- Penerimaan aset qty N → membuat N unit aset (kode & QR masing-masing), harga perolehan, sumber dana, tanggal perolehan, ruangan awal.
- **Kondisi:** `BAIK`, `RUSAK_RINGAN`, `RUSAK_BERAT`.
- **Status:** `TERSEDIA`, `DIPINJAM`, `DALAM_PERBAIKAN`, `DIHAPUS`, `HILANG`.
- Riwayat lokasi (`asset_location_history`) & riwayat kondisi tersimpan setiap perpindahan ruangan/unit, peminjaman, pemeliharaan, opname.

### 6.6 Tanggal transaksi & tutup buku

- Tanggal transaksi boleh diisi mundur (input susulan), **tetapi** tidak boleh berada di periode yang sudah ditutup dan tidak boleh lebih awal dari mutasi terakhir item×gudang yang sama (menjaga urutan FIFO & kartu stok).
- Kepala Sekolah/Admin dapat **menutup periode** (mis. per bulan/semester) setelah laporan dicetak; dokumen di periode tertutup tidak bisa diposting/dibatalkan.

---

## 7. Modul & Alur Kerja

### 7.1 Usulan Kebutuhan (Proposal)

```
DRAF → DIAJUKAN → [DIVERIFIKASI] → DISETUJUI → DIPROSES (pengadaan) → SELESAI
          ↘ DIKEMBALIKAN (revisi, kembali ke DRAF)   ↘ DITOLAK
   [ ] = hanya bila persetujuan 2 tingkat
```

- Dibuat Pengusul untuk unitnya; baris: item katalog **atau** barang baru (teks bebas + spesifikasi), qty, satuan, perkiraan harga, alasan, prioritas (tinggi/sedang/rendah), sumber dana & tahun anggaran yang diusulkan.
- Verifikator melihat sisa **pagu** unit × sumber dana dan dapat menyetujui **sebagian** (qty disetujui per baris).
- Setiap keputusan tercatat (siapa, kapan, catatan). Pengusul mendapat notifikasi.

### 7.2 Pengadaan

- Dibuat Petugas dari baris usulan yang disetujui (boleh menggabungkan beberapa usulan) atau langsung (pembelian non-usulan, hibah).
- Isi: penyedia, nomor & tanggal nota, sumber dana, baris (item, qty, harga satuan), pajak (dicatat saja), total, lampiran nota (foto/PDF).
- Status: `DRAF → DIPESAN → DITERIMA_SEBAGIAN → DITERIMA`.

### 7.3 Penerimaan → **Kartu Penerimaan**

- Dari pengadaan (sisa qty) atau langsung (hibah/sumbangan/saldo awal).
- Barang habis pakai → ke gudang tujuan (membuat lot FIFO). Aset → ke ruangan tujuan (membuat unit aset + QR).
- Posting → nomor `KP/2026/0001`, cetak **Kartu Penerimaan** & **Berita Acara Penerimaan/Serah Terima**, cetak label QR.

### 7.4 Pengeluaran → **Kartu Pengeluaran**

- Opsional didahului **Permintaan Barang** dari Pengusul (unit, item, qty) → diproses Petugas.
- Petugas memilih/scan item, gudang asal, qty, unit/penerima. Nilai dihitung FIFO saat posting.
- Posting → nomor `KK/2026/0001`, cetak **Kartu Pengeluaran** dengan tanda tangan penyerah & penerima.

### 7.5 Mutasi

- **Antar gudang** (habis pakai): `MUTASI_KELUAR` + `MUTASI_MASUK` dalam satu posting; lot berpindah dengan harga aslinya.
- **Antar ruangan/unit** (aset): pindah lokasi per unit (scan QR), tercatat di riwayat lokasi; KIR otomatis mengikuti.

### 7.6 Peminjaman → **Kartu Peminjaman**

```
[DIAJUKAN → DISETUJUI] → DIPINJAM → DIKEMBALIKAN (per unit)        TERLAMBAT = dihitung otomatis
   [ ] = hanya bila peminjam mengajukan sendiri lewat akunnya
```

- Peminjam: pengguna (siswa/guru) **atau** nama + kelas/NIS bebas (untuk sekolah tanpa akun siswa).
- Petugas scan QR unit aset; hanya unit berstatus `TERSEDIA` (baris dikunci saat checkout). Isi tujuan, tanggal pinjam, **batas kembali**, kondisi awal (+ foto opsional).
- Pengembalian per unit: kondisi akhir (+foto); bila rusak → kondisi aset diperbarui & dapat diteruskan ke pemeliharaan.
- Nomor `PJ/2026/0001`, cetak **Kartu Peminjaman**. Notifikasi H-1 dan saat terlambat.

### 7.7 Stock Opname

- Sesi per gudang (habis pakai) atau per ruangan (aset). Saat sesi dibuka, sistem menyimpan *snapshot* jumlah tercatat, dan **gudang/ruangan itu dibekukan** dari posting lain sampai sesi selesai (menjamin selisih akurat).
- Petugas menghitung/scan; sistem menghitung selisih (qty & rupiah).
- Kepala Sekolah menyetujui → posting `PENYESUAIAN_TAMBAH/KURANG` (habis pakai) dan status `HILANG`/temuan (aset). Cetak **Berita Acara Stock Opname**.

### 7.8 Penghapusan Barang

- Petugas mengusulkan penghapusan unit aset (rusak berat/hilang/usang) atau barang habis pakai (kedaluwarsa/rusak) dengan alasan & foto.
- Alur persetujuan mengikuti pengaturan 1/2 tingkat → posting: aset `DIHAPUS`, habis pakai `PENYESUAIAN_KURANG`.
- Cetak **Berita Acara Penghapusan**.

### 7.9 Pemeliharaan Aset

- Catatan per unit: tanggal, jenis (perawatan rutin/perbaikan), pelaksana/penyedia, biaya, sumber dana, uraian, kondisi sebelum/sesudah, lampiran.
- Selama dikerjakan status aset `DALAM_PERBAIKAN` (tidak bisa dipinjam).

### 7.10 Notifikasi

| Kejadian | Penerima |
|---|---|
| Usulan diajukan / diverifikasi | Verifikator / Kepala Sekolah |
| Usulan disetujui / ditolak / dikembalikan | Pengusul |
| Permintaan barang masuk | Petugas gudang terkait |
| Peminjaman diajukan / H-1 jatuh tempo / terlambat | Petugas / Peminjam |
| Stok di bawah batas minimum | Petugas gudang terkait |
| Penghapusan / opname menunggu persetujuan | Kepala Sekolah |

Lonceng notifikasi di aplikasi (realtime) + email (bila pengguna punya email & SMTP platform diisi). Pengingat jatuh tempo dijalankan timer harian.

### 7.11 Log Aktivitas

Setiap perubahan data penting & setiap posting dicatat: siapa, kapan, aksi, entitas, nilai sebelum/sesudah, IP. Dapat dicari & difilter oleh Admin/Kepala Sekolah. Tidak bisa diubah.

---

## 8. Laporan & Dokumen Cetak

Semua dokumen cetak memakai kop sekolah (logo, nama, alamat) dan blok tanda tangan dari profil sekolah. Format PDF; laporan tabel juga Excel.

| Dokumen | Isi utama | Filter |
|---|---|---|
| **Kartu Penerimaan** | No/tgl, penyedia/asal, sumber dana, baris barang, qty, harga, total, penerima | per dokumen |
| **Kartu Pengeluaran** | No/tgl, gudang asal, unit/penerima, barang, qty, nilai FIFO | per dokumen |
| **Kartu Peminjaman** | Peminjam, unit aset (kode), tgl pinjam/batas/kembali, kondisi awal/akhir | per dokumen / per peminjam |
| **Kartu Stok** | Tanggal, no dokumen, uraian, masuk, keluar, saldo (qty & Rp) | item × gudang × rentang tanggal |
| **KIR** | Daftar aset per ruangan: kode, nama, merk/tipe, tahun, jumlah, kondisi | per ruangan (untuk ditempel) |
| **KIB** | Buku inventaris aset tetap per golongan (B Peralatan & Mesin, E Aset Tetap Lainnya, dst.): kode BMD, register, tahun & harga perolehan, sumber dana, kondisi | golongan × tahun |
| **Laporan Mutasi Persediaan** | Per item: saldo awal, masuk, keluar, saldo akhir (qty & Rp) | periode × gudang × sumber dana |
| **Berita Acara** | Penerimaan/Serah Terima, Penghapusan, Stock Opname | per dokumen |
| **Label QR** | QR + kode + nama + sekolah | pilihan unit aset/item |

---

## 9. Arsitektur Teknis

### 9.1 Komponen

```
PWA / Browser ──HTTPS──▶ Nginx (TLS, rate limit) ──▶ Next.js 16 (systemd, 127.0.0.1:3030)
                                                       │  Server Components + Server Actions
                                                       │  Route Handlers: /api/sse, /api/files, /q/[token], laporan
                                                       ▼
                                          PostgreSQL 16 (db `inventaris`, RLS)  ◀── LISTEN/NOTIFY ── SSE
                                          Disk lokal /var/lib/inventaris/files (foto, nota, logo)
Timer systemd: pengingat jatuh tempo & stok minimum (harian), backup DB + file (harian)
```

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js 16 App Router, TypeScript strict | Sama dengan SIGW/e-vote; UI penuh untuk PWA & scanner |
| Runtime & paket | Bun 1.4 (paket & skrip), Node untuk `next start` | Sama dengan SIGW (sudah terpasang) |
| ORM & migrasi | Drizzle ORM + drizzle-kit | Migrasi SQL eksplisit, mudah dipakai bersama RLS & trigger |
| Auth | Auth.js v5 (Credentials: NPSN + username), JWT sesi 12 jam | Pola e-vote/SIGW; status sekolah dicek ulang per request |
| Validasi | Zod di setiap server action | |
| UI | Tailwind CSS + komponen ala shadcn/ui; TanStack Table untuk tabel padat | Desain bersih: latar off-white, teks slate gelap, aksen emerald (sesuai PRD) |
| QR | `qrcode` (buat) + `BarcodeDetector`/`@zxing/browser` (scan kamera) | Scan berjalan di Android/iOS modern |
| PDF & Excel | pdfmake + exceljs | Sama dengan SIGW |
| Gambar | sharp (kompres & ubah ukuran foto unggahan) | Hemat disk |
| Realtime | Server-Sent Events + Postgres `LISTEN/NOTIFY` per kanal sekolah | Tanpa Redis/WebSocket server terpisah |
| PWA | Web App Manifest + service worker (cache aset statis saja) | Bisa di-install; transaksi tetap online |
| Email | SMTP (nodemailer) melalui antrean tabel `outbox` + timer | Gagal kirim tidak mengganggu transaksi |
| Tes | `bun test` (unit & integrasi DB), Playwright (alur utama end-to-end) | Mesin stok & isolasi sekolah wajib teruji |

### 9.2 Isolasi multi-sekolah (dua lapis)

1. **Aplikasi:** semua akses data lewat helper `withSchool(session, fn)` yang mengambil `school_id` dari sesi (bukan dari input), memeriksa status sekolah `ACTIVE`, dan menjalankan `fn` dalam transaksi.
2. **Database:** Row-Level Security pada setiap tabel ber-`school_id` dengan kebijakan `school_id = current_setting('app.school_id')`. `withSchool` mengisi `SET LOCAL app.school_id` di awal transaksi. Aplikasi terhubung sebagai role tanpa `BYPASSRLS`; hanya modul pengelola platform & migrasi yang memakai role khusus.

### 9.3 Keamanan

- Password bcrypt (cost 12); rate limit login/daftar di Nginx; kunci sementara setelah gagal login berulang.
- File unggahan: dicek isi (magic bytes), ukuran maks, nama dibuat server, disimpan di luar folder publik, disajikan lewat route yang memeriksa hak akses.
- Token QR acak (tidak berurutan); halaman publik QR hanya menampilkan info minimal.
- Header keamanan (CSP, HSTS, X-Frame-Options); server action bergantung pada pemeriksaan Origin bawaan Next.js.
- Audit `bun audit` sebelum setiap rilis; dependensi dikunci (`bun.lock`).

### 9.4 Deploy (mengikuti pola SIGW di server ini)

- Kode: `/var/www/inventaris` (repo git + aplikasi, milik `ubuntu`); aplikasi berjalan sebagai user `inventaris` (read-only terhadap kode).
- Data: DB PostgreSQL `inventaris`; file `/var/lib/inventaris/files`; backup harian `pg_dump` + arsip file (14 hari).
- systemd `inventaris.service` (127.0.0.1:3030, hardening), timer harian notifikasi & backup; Nginx + Let's Encrypt; perintah `inventaris-update`.
- Repo GitHub `pindoyono/inventaris` (dibuat Anda) + deploy key.

---

## 10. Model Data (ringkas)

Semua tabel di bawah (kecuali yang ditandai *platform*) memiliki `id`, `school_id`, `created_at`, `updated_at`, dan dilindungi RLS.

**Platform & sekolah**
`schools` *(platform)* — npsn ᵘ, nama, nama singkat, jenjang, status negeri/swasta, alamat, kab/kota, provinsi, kontak, logo, status (PENDING/ACTIVE/REJECTED/SUSPENDED), catatan status, disetujui_pada
`school_settings` — persetujuan 1/2 tingkat, akun siswa aktif, label jenis unit, prefiks kode, hari pinjam default, nama & NIP kepsek/pengurus barang
`platform_admins` *(platform)*

**Pengguna**
`users` — username ᵘ(per sekolah), nama, NIP/NIS, email, password_hash, aktif, harus_ganti_password
`user_roles` — user, peran
`user_units` · `user_warehouses` — lingkup pengusul & petugas

**Data dasar**
`units`, `buildings`, `rooms`, `warehouses`, `categories` (parent, tipe, golongan KIB, prefiks BMD), `uoms`, `funding_sources`, `vendors`, `budget_ceilings` (unit × sumber dana × tahun), `fiscal_periods` (status buka/tutup)

**Barang & stok**
`items` — kode ᵘ, nama, kategori, tipe (ASET/HABIS_PAKAI), satuan, merk/spesifikasi, kode BMD, stok minimum, foto, token QR
`assets` — kode ᵘ, item, no seri, tgl & harga perolehan, sumber dana, asal (baris penerimaan), ruangan, unit, kondisi, status, kode BMD, no register, token QR
`asset_location_history` · `asset_condition_history`
`stock_lots` · `stock_balances` · `stock_movements` (§6.3)

**Dokumen** (pola sama: kepala + baris, `nomor` ᵘ, `status`, `tanggal`, dibuat/diposting oleh)
`proposals` + `proposal_items` + `proposal_approvals`
`procurements` + `procurement_items` + lampiran
`receipts` + `receipt_items` (Kartu Penerimaan)
`item_requests` + `item_request_items` (permintaan barang)
`issues` + `issue_items` (Kartu Pengeluaran)
`transfers` + `transfer_items` (mutasi gudang) · `asset_moves`
`loans` + `loan_items` (Kartu Peminjaman)
`stock_opnames` + `stock_opname_items`
`disposals` + `disposal_items` (penghapusan)
`maintenances`

**Pendukung**
`doc_counters` (penomoran atomik per sekolah × jenis × tahun), `attachments`, `notifications`, `email_outbox`, `activity_logs` (tidak bisa diubah)

ᵘ = unik (dalam lingkup sekolah kecuali disebut lain)

---

## 11. Antarmuka

- **Gaya:** bersih & minimalis — latar off-white, teks slate gelap, aksen emerald, kartu sudut membulat, tabel padat untuk Kartu Stok, tombol aksi utama menonjol (Scan QR, Terima Barang, Keluarkan Barang). Mode gelap otomatis.
- **Navigasi per peran:** Petugas melihat *Gudang Hari Ini* (permintaan masuk, peminjaman jatuh tempo, stok menipis, tombol scan); Kepala Sekolah melihat *Menunggu Persetujuan* + ringkasan nilai persediaan & aset; Pengusul melihat usulan & permintaannya.
- **Mobile-first untuk Petugas:** scan QR → aksi cepat (lihat/pinjamkan/kembalikan/pindahkan/catat kondisi).
- **Halaman utama:** Dashboard · Barang (Katalog, Aset, Stok per Gudang) · Transaksi (Penerimaan, Pengeluaran, Mutasi, Peminjaman) · Usulan & Pengadaan · Audit (Opname, Penghapusan, Pemeliharaan) · Laporan · Pengaturan.
- Mockup layar utama dibuat di awal Fase 0 untuk disetujui sebelum UI dibangun penuh.

---

## 12. Tahapan Pengembangan

Setiap fase: dikembangkan → tes otomatis lulus → uji coba Anda di server → live.

### Fase 0 — Fondasi
Repo & CI tes lokal · skema dasar + RLS · Auth (NPSN) · pendaftaran sekolah + panel pengelola platform · wizard setup + template jenjang · pengguna & peran · data dasar (unit, gedung/ruangan, gudang, kategori, satuan, sumber dana, penyedia) · log aktivitas · deploy `inventaris.ankdev.id`.
**Selesai bila:** dua sekolah uji terisolasi total (tes otomatis), sekolah pending/nonaktif tidak bisa masuk.

### Fase 1 — Inti Stok (MVP live)
Katalog barang · penerimaan + **Kartu Penerimaan** + unit aset + **label QR** · pengeluaran + **Kartu Pengeluaran** · mutasi gudang & pindah ruangan · **Kartu Stok FIFO** · impor saldo awal · scan QR (PWA) · dashboard dasar · tutup periode.
**Selesai bila:** tes FIFO & tes konkurensi lulus; saldo = Σ buku besar untuk setiap item×gudang; kartu cetak sesuai contoh yang Anda setujui.

### Fase 2 — Alur Kerja
Usulan berjenjang + pagu · pengadaan · permintaan barang · peminjaman + **Kartu Peminjaman** + akun siswa opsional · notifikasi di aplikasi + email · pengingat jatuh tempo.

### Fase 3 — Audit & Laporan
Stock opname · penghapusan · pemeliharaan · **KIR** · **KIB** · **Laporan Mutasi Persediaan** · **Berita Acara** · dashboard realtime (SSE) · ekspor Excel.

---

## 13. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Selisih stok karena transaksi bersamaan | Kunci baris saldo & lot, urutan kunci tetap, constraint, tes konkurensi |
| Kebocoran data antar sekolah | RLS + helper `withSchool` + tes isolasi otomatis di setiap fase |
| Input mundur merusak urutan FIFO | Aturan tanggal §6.6 + tutup periode |
| NPSN diklaim pihak lain | Persetujuan pengelola platform + cek ke referensi Kemendikdasmen |
| Format cetak tidak sesuai kebutuhan sekolah/Pemda | Contoh format disetujui sebelum Fase 1/3; template kop & tanda tangan dapat diatur |
| Server dipakai bersama aplikasi lain | systemd + batas memori, port & user terpisah, backup harian |
| Ruang lingkup membesar | Fase berurutan dengan kriteria selesai yang jelas |

---

## 14. Yang Masih Perlu Diputuskan

1. **[KEPUTUSAN] Contoh format cetak.** Apakah ada format Kartu Penerimaan/Pengeluaran/Stok/KIR/KIB yang selama ini dipakai sekolah atau diminta Dinas/Yayasan? Bila ada, kirimkan contohnya; bila tidak, saya buat format standar untuk Anda setujui.
2. **[KEPUTUSAN] Repo GitHub.** Buat repo kosong `pindoyono/inventaris` (privat/publik) dan pasang deploy key yang akan saya siapkan.
3. **[KEPUTUSAN] DNS.** Tambahkan record `inventaris.ankdev.id` → 43.156.77.229 (atau CNAME ke `ankdev.id`).
4. **[KEPUTUSAN] Email.** Akun SMTP untuk notifikasi (mis. alamat no-reply di domain Anda) — bisa menyusul di Fase 2.
5. **[KEPUTUSAN] Data aplikasi persediaan lama.** Ada cadangan berisi 4 kategori & 10 barang. Dipindahkan sebagai data awal SMKN 2 Malinau, atau mulai bersih?
6. **[KEPUTUSAN] Tahun anggaran.** Diasumsikan Januari–Desember (sesuai BOS). Ada sekolah yang memakai tahun ajaran (Juli–Juni) untuk anggarannya?
