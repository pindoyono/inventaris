# Rancangan Sistem Inventaris Sekolah Negeri

Status: **draf untuk disetujui** · Versi 0.2 · 6 Oktober 2026
Sumber kebutuhan: `system_architecture_prd_summary.md` + 5 putaran keputusan + kajian regulasi (§2).

Dokumen ini adalah acuan tunggal selama pengembangan. Hal yang masih perlu ditindaklanjuti ditandai **[TINDAK LANJUT]** di §15.

**Perubahan dari v0.1:** cakupan dibatasi ke sekolah negeri milik Pemda; kategori barang memakai kodefikasi resmi Permendagri 108/2016 (sebelumnya tertulis keliru "108/2014"); alur & dokumen persediaan, KIR, pemeliharaan, inventarisasi mengikuti Permendagri 47/2021; penghapusan mengikuti Permendagri 19/2016 jo. 7/2024 (diputus kepala daerah); kode register & label resmi; sumber dana mengikuti Juknis BOSP 2026; dokumen cetak berbasis template HTML.

---

## 1. Ringkasan Keputusan

| Aspek | Keputusan |
|---|---|
| Cakupan | **Khusus sekolah negeri milik Pemerintah Daerah** — SD/SMP Negeri (kab/kota) dan SMA/SMK/SLB Negeri (provinsi). Barangnya adalah Barang Milik Daerah (BMD). Madrasah (BMN/Kemenag) dan sekolah swasta **tidak dilayani**; hal ini dinyatakan jelas di beranda & form pendaftaran |
| Identitas sekolah | **NPSN** (unik). Pendaftaran berstatus *menunggu* sampai disetujui pengelola platform |
| Kategori barang | **Kodefikasi BMD Permendagri 108/2016** (13.780 kode terverifikasi, `data/bmd/`) + kode lokal Pemda bila ada |
| Stack | Next.js 16 (App Router) + TypeScript + PostgreSQL + Drizzle ORM + Auth.js v5 + Tailwind |
| Infrastruktur | systemd + Nginx + PostgreSQL yang sudah ada; realtime via SSE + Postgres `LISTEN/NOTIFY`; file di disk lokal di balik antarmuka storage |
| Pengguna | Peran tetap yang bisa diaktifkan/dinonaktifkan per sekolah; satu orang boleh memegang beberapa peran |
| Akun siswa | Opsional per sekolah (default mati; petugas mencatat peminjaman atas nama siswa) |
| Aset tetap | Dicatat **per unit** dengan **kode register** resmi (§6.5) & label QR |
| Persediaan | Metode **perpetual**, stok per gudang, penilaian **FIFO** (Permendagri 47/2021 Pasal 33–34), item diberi **NUSP** |
| Persetujuan usulan | 1 atau 2 tingkat per sekolah (default 2: Verifikator → Kepala Sekolah) |
| Penghapusan | Sekolah **mengusulkan**; barang baru dihapus setelah **SK kepala daerah** dicatat (Permendagri 19/2016 jo. 7/2024) |
| Dokumen cetak | Template HTML siap cetak (A4/F4, potret/lanskap) → PDF lewat browser; format mengikuti unsur wajib Permendagri 47/2021 (§8) |
| Audit | Stock opname per semester, penghapusan, pemeliharaan (kartu pemeliharaan), log aktivitas |
| Notifikasi | Di aplikasi + email via Google Workspace `admin@smkn2malinau.sch.id` (App Password) |
| Tahun anggaran | Januari–Desember |
| Data aplikasi persediaan lama | Tidak dipindahkan (kategorinya tidak mengikuti BMD); sekolah mulai dengan saldo awal |
| PWA | Bisa di-install & scan QR via kamera; transaksi wajib online |
| Nama & alamat | **Inventaris** — `inventaris.ankdev.id`, repo `pindoyono/inventaris` |
| Pengembangan | Bertahap; setiap fase diuji lalu langsung live (§13) |

---

## 2. Dasar Regulasi & Implikasinya

Salinan regulasi: `/home/ubuntu/regulasi/` (PDF resmi).

| Regulasi | Dipakai untuk | Implikasi di sistem |
|---|---|---|
| **PP 27/2014 jo. PP 28/2020** — Pengelolaan BMN/BMD | Payung hukum | Istilah & peran pengelolaan BMD |
| **Permendagri 19/2016 jo. 7/2024** — Pedoman Pengelolaan BMD | Penggunaan, pemeliharaan, penghapusan | Penghapusan diusulkan sekolah dan **diputus gubernur/bupati/wali kota**; permohonan wajib memuat tahun perolehan, kode barang, kode register, nama, jenis, identitas, kondisi, lokasi, nilai buku/perolehan; kehilangan karena kecurian wajib surat keterangan kepolisian |
| **Permendagri 108/2016** — Penggolongan & Kodefikasi BMD | Kode barang, kode lokasi, kode register | Kategori = kode 7 tingkat; kode register di label tiap aset (kecuali persediaan); kode tingkat 7 tambahan boleh ditetapkan kepala daerah |
| **Permendagri 47/2021** — Pembukuan, Inventarisasi, Pelaporan BMD | Format & alur pembukuan | Persediaan perpetual + FIFO; buku penerimaan/pengeluaran/penyaluran persediaan, kartu barang persediaan, daftar persediaan rusak/usang; alur nota permintaan → surat permintaan → surat perintah penyaluran → BAST; stock opname **setiap semester**; KIR rangkap 2, diperbarui tiap semester & tiap perubahan; kartu pemeliharaan; lembar kerja & laporan hasil inventarisasi |
| **Permendikdasmen 8/2026** — Juknis BOSP | Sumber dana | Sumber dana BOS Reguler/Kinerja/Afirmasi + komponen penggunaannya (Pasal 42–46) sebagai pilihan di pengadaan, agar selaras dengan RKAS/ARKAS |

> **Catatan:** lampiran Permendagri 47/2021 yang tersedia memuat petunjuk teknis dan nomor format (mis. Format II.I.5 Kartu Barang Persediaan) tetapi **tidak memuat tabel kolomnya**. Format cetak sistem disusun dari unsur wajib yang disebut regulasi + format yang dipakai Pemda (mis. KIB B 16 kolom), lalu disetujui Anda (§8).

---

## 3. Konsep Inti

1. **Setiap data milik satu sekolah.** Semua tabel operasional punya `school_id`; isolasi di dua lapis — kode aplikasi **dan** Row-Level Security PostgreSQL (§10.2).
2. **Stok berasal dari buku besar, bukan diedit** (metode perpetual). Angka stok hanya berubah lewat *posting* dokumen; setiap posting menulis baris `stock_movements` yang tidak bisa diubah/dihapus. Kartu Barang Persediaan = isi buku besar itu.
3. **Dokumen: draf → diposting → (dibatalkan lewat dokumen pembalik).** Setelah diposting, dokumen terkunci; jejak audit utuh.
4. **Mengikuti BMD, ramah jenjang.** Kode barang, kode register, dan dokumen mengikuti regulasi BMD; struktur sekolah (unit, ruangan, gudang) tetap fleksibel untuk SD sampai SMK.
5. **Tidak ada stok negatif & tidak ada selisih.** Transaksi ACID + `SELECT … FOR UPDATE` + constraint database.

---

## 4. Pengguna, Jabatan BMD & Hak Akses

### 4.1 Jenis akun
| Akun | Lingkup | Login |
|---|---|---|
| Pengelola Platform | Seluruh platform | `/platform/login` — username + password |
| Pengguna Sekolah | Satu sekolah | `/login` — **NPSN + username + password** |

### 4.2 Peran sekolah & padanan jabatan BMD

Jabatan BMD tampil di blok tanda tangan dokumen; sebutannya bisa disesuaikan per sekolah (Pemda berbeda-beda menyebutnya).

| Peran sistem | Jabatan BMD (default) | Tugas |
|---|---|---|
| **Admin Sekolah** | — | Pengaturan sekolah, pengguna, data dasar |
| **Kepala Sekolah** | Kuasa Pengguna Barang | Persetujuan akhir, mengetahui/menandatangani dokumen, laporan |
| **Verifikator** | (Wakasek Sarpras/Bendahara) | Verifikasi usulan & anggaran (tingkat 1) |
| **Petugas Barang** | Pengurus Barang Pembantu | Penerimaan, penyaluran, mutasi, peminjaman, opname, KIR, label — dapat dibatasi ke gudang tertentu |
| **Pengusul** | Pihak yang membutuhkan | Usulan kebutuhan & **nota permintaan** barang untuk unitnya |
| **Peminjam** | — | Mengajukan peminjaman sendiri (bila akun siswa/guru-peminjam diaktifkan) |

Pihak di luar sekolah yang hanya muncul di dokumen (tidak login): **Pengguna Barang** (Kepala Dinas Pendidikan) dan **Pengelola Barang** (Sekda/BPKAD) — nama/NIP diisi di profil bila diperlukan pada dokumen tertentu.

### 4.3 Matriks hak akses (ringkas)

| Kemampuan | Admin | Kepsek | Verifikator | Petugas | Pengusul | Peminjam |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Pengaturan sekolah, pengguna, data dasar | ✔ | lihat | | | | |
| Katalog barang & gudang | ✔ | lihat | lihat | ✔ | lihat | |
| Usulan kebutuhan | | setujui | verifikasi | | ajukan | |
| Pengadaan & penerimaan | | lihat | lihat | ✔ | | |
| Nota/surat permintaan & penyaluran | | setujui SPPB | lihat | ✔ | ajukan nota | |
| Peminjaman | | lihat | lihat | ✔ | ajukan | ajukan (bila aktif) |
| Stock opname | | setujui | lihat | ✔ | | |
| Usulan penghapusan | | setujui & kirim | verifikasi | siapkan | | |
| Pemeliharaan aset | | lihat | lihat | ✔ | | |
| Laporan & cetak | ✔ | ✔ | ✔ | ✔ | unitnya | |
| Log aktivitas | ✔ | ✔ | | | | |

---

## 5. Registrasi & Setup Sekolah

```
/daftar  →  PENDING  →  Pengelola Platform setujui  →  ACTIVE  →  Wizard setup  →  siap dipakai
                       ↘ tolak (REJECTED) / nonaktifkan kapan pun (SUSPENDED)
```

**Pernyataan cakupan** (beranda, form daftar, halaman login):
> *Inventaris diperuntukkan bagi **sekolah negeri milik Pemerintah Daerah** (SD/SMP Negeri, SMA/SMK/SLB Negeri) yang barangnya merupakan Barang Milik Daerah. Belum melayani madrasah dan sekolah swasta.*

Form pendaftaran wajib mencentang pernyataan tersebut.

**Form pendaftaran:** NPSN, nama sekolah & singkat, **jenjang** (SD, SMP, SMA, SMK, SLB — semua negeri), provinsi & kab/kota (dari kode wilayah Kemendagri), alamat, penanggung jawab + HP/WA + email, akun admin pertama. Status kepemilikan BMD diturunkan otomatis: SD/SMP → **kab/kota (12)**, SMA/SMK/SLB → **provinsi (11)**.

**Panel pengelola platform:** daftar per status, tautan cek NPSN ke `referensi.data.kemdikbud.go.id` (memastikan status **negeri**), setujui/tolak/nonaktifkan dengan catatan.

**Wizard setup (sekali, bisa diubah kapan pun di Pengaturan):**
1. **Profil & kop surat:** logo, alamat, nama & NIP Kepala Sekolah (Kuasa Pengguna Barang) dan Pengurus Barang Pembantu; opsional Kepala Dinas (Pengguna Barang).
2. **Kode BMD dari Pemda:** kode pengguna barang (Dinas Pendidikan, 6 digit), **kode kuasa pengguna barang (sekolah, 5 digit)**, kode sub kuasa (opsional), dan **batas nilai kapitalisasi** per golongan sesuai Perkada (menentukan intrakomptabel/ekstrakomptabel). Bila belum tahu, boleh diisi belakangan — label register ditandai "sementara".
3. **Struktur:** unit (kelas/mapel/program keahlian/bidang), gedung & ruangan (penanggung jawab ruangan untuk KIR), gudang.
4. **Alur kerja:** persetujuan 1/2 tingkat, akun siswa, mode penyaluran persediaan (§7.4), batas hari peminjaman.
5. **Pengguna & peran.**
6. **Saldo awal:** impor Excel persediaan (NUSP, stok per gudang, harga) dan aset tetap (per unit, termasuk **nomor register lama dari Dinas/BPKAD**). Diposting sebagai dokumen *Saldo Awal*.

---

## 6. Barang, Kode & Stok

### 6.1 Kategori = kode BMD

- Pemilih kategori berupa pencarian atas 12.709 kode yang bisa dipilih (tingkat 6–7) dengan jalur induknya, mis. *Peralatan dan Mesin › Alat Rumah Tangga › Alat Kantor › Alat Kantor Lainnya › LCD Projector/Infocus* (`1.3.2.05.01.05.043`).
- **Golongan** menentukan jenis catatan: `PERSEDIAAN` (1.1.7) → barang habis pakai; `A`–`F` (KIB) dan `ATB` → aset tetap per unit.
- **Kode lokal Pemda:** untuk barang yang tidak ada di tingkat 7 (daftar regulasi sengaja terbuka, "Dst…"), Pemda/sekolah dapat menambah kode di bawah sub rincian objek yang sesuai, ditandai "lokal" + nomor keputusan bila ada.
- **Daftar favorit per jenjang:** saat setup, sekolah mendapat daftar pendek kode yang lazim (ATK, kertas, bahan komputer, alat kebersihan, alat listrik, perlengkapan olahraga, LCD projector, komputer/laptop, meja-kursi, papan tulis, alat laboratorium, buku perpustakaan, dst.) agar tidak perlu mencari dari 12 ribu kode.

### 6.2 Barang persediaan & NUSP

- Setiap item persediaan = **kode barang persediaan** (tingkat 7, mis. `1.1.7.01.03.02.001` Kertas HVS) + **nomor urut spesifikasi** → **NUSP**, mis. `1.1.7.01.03.02.001.0003` = "Kertas HVS A4 70 gram, rim".
- Satuan mengikuti "satuan yang lazim" (Permendagri 47/2021).
- Label QR item persediaan hanya untuk kemudahan operasional (rak/gudang), **bukan** label register (persediaan dikecualikan dari label register — Permendagri 108/2016).

### 6.3 Buku besar persediaan

```
stock_lots       : satu baris per penerimaan per gudang (qty_masuk, qty_sisa, harga_satuan, tanggal) — dasar FIFO
stock_balances   : saldo terkini per NUSP × gudang (qty, nilai) — dikunci saat posting
stock_movements  : buku besar, TIDAK BISA diubah/dihapus (dijaga trigger DB)
                   jenis: SALDO_AWAL, PENERIMAAN, PENYALURAN, MUTASI_KELUAR, MUTASI_MASUK,
                          PENYESUAIAN_TAMBAH, PENYESUAIAN_KURANG (opname),
                          RUSAK_USANG (keluar ke daftar persediaan rusak/usang), PEMBALIK
                   simpan: qty, harga satuan, nilai, saldo qty & nilai sesudah baris ini, dokumen sumber, lot
```

**Algoritma posting** (satu transaksi): kunci penomoran dokumen → urutkan baris (NUSP, gudang) → `SELECT … FOR UPDATE` saldo → penerimaan membuat lot; pengeluaran mengambil lot FIFO (`FOR UPDATE`, urut tanggal) dan gagal bila stok kurang → tulis movement + saldo sesudahnya → update saldo → `COMMIT` → `NOTIFY` dashboard. Pengaman: `CHECK (qty_sisa >= 0)`, `CHECK (qty >= 0)`, trigger anti ubah/hapus buku besar; diuji dengan tes FIFO & tes konkurensi.

### 6.4 Tanggal transaksi & tutup buku
Tanggal mengikuti dokumen sumber (Pasal 6 ayat 2); boleh mundur, tetapi tidak di periode yang sudah ditutup dan tidak lebih awal dari mutasi terakhir NUSP×gudang yang sama. Periode (bulan/semester) dapat ditutup setelah laporan dicetak.

### 6.5 Aset tetap per unit & kode register

**Kode register** (Permendagri 108/2016) dicetak dua baris pada label:
```
12 . 01 . 72 . 04 . 010101 . 00103 . 00000 . 2026     ← kepemilikan . intra/ekstra . prov . kab/kota . pengguna . kuasa pengguna . sub kuasa . tahun perolehan
      1 . 3 . 2 . 05 . 01 . 05 . 043 . 000070          ← kode barang . nomor urut pendaftaran
```
- Kepemilikan 11 (provinsi) / 12 (kab/kota); kode kab/kota `00` untuk barang provinsi.
- Intrakomptabel `01` bila harga ≥ batas kapitalisasi Perkada, ekstrakomptabel `02` bila di bawahnya (tetap dicatat).
- **Nomor urut pendaftaran** 6 digit per kode barang; sistem mengusulkan nomor berikutnya, tetapi **dapat diisi/diimpor** sesuai register yang sudah diberikan Dinas/BPKAD. Unik per sekolah × kode barang.
- QR label berisi URL token acak (§6.6) — tidak menggantikan teks kode register yang wajib tercetak.

Data unit aset: kode barang, nomor register, nama/spesifikasi, merk/tipe, ukuran/CC, bahan, nomor pabrik/rangka/mesin/polisi/BPKB (bila ada), tahun & harga perolehan, asal-usul (pembelian/hibah/…), sumber dana, ruangan, unit, **kondisi** (`BAIK`, `RUSAK_RINGAN`, `RUSAK_BERAT`), **status** (`DIGUNAKAN`, `DIPINJAM`, `DALAM_PEMELIHARAAN`, `DIUSULKAN_HAPUS`, `DIHAPUS`, `HILANG`), riwayat lokasi & kondisi.

### 6.6 QR
URL `https://inventaris.ankdev.id/q/{token}` (token acak). Pengguna sekolah yang login → halaman aset + aksi cepat; publik → info minimal (nama barang, sekolah, kode register).

---

## 7. Modul & Alur Kerja

### 7.1 Usulan Kebutuhan
`DRAF → DIAJUKAN → [DIVERIFIKASI] → DISETUJUI → DIPROSES → SELESAI` (atau `DIKEMBALIKAN` / `DITOLAK`). Baris: kode barang/item atau barang baru (teks + spesifikasi), qty, satuan, perkiraan harga, alasan, prioritas, **sumber dana & komponen BOSP**. Verifikator melihat sisa pagu unit × sumber dana dan dapat menyetujui sebagian.

### 7.2 Pengadaan
Dari usulan yang disetujui atau langsung. Penyedia, nomor & tanggal nota/kuitansi, sumber dana + komponen BOSP, baris barang, pajak (dicatat), total, lampiran nota. `DRAF → DIPESAN → DITERIMA_SEBAGIAN → DITERIMA`.

### 7.3 Penerimaan
Asal: pengadaan, hibah/sumbangan, saldo awal, hasil inventarisasi, lainnya (cara perolehan Pasal 7 Permendagri 47/2021). Persediaan → gudang (lot FIFO, tercatat di **Buku Penerimaan Persediaan**). Aset → ruangan (unit aset + kode register + label). Cetak **Berita Acara Serah Terima/Penerimaan**.

### 7.4 Penyaluran persediaan (pengeluaran)
Mengikuti Permendagri 47/2021 Pasal 36–37, dengan dua mode (diatur per sekolah):
- **Mode lengkap:** *Nota Permintaan* (Pengusul) → *Surat Permintaan Barang* (Petugas) → *Surat Perintah Penyaluran Barang* (Kepala Sekolah) → penyaluran + **BAST** → tercatat di **Buku Pengeluaran** & **Buku Penyaluran Persediaan**.
- **Mode ringkas** (sekolah kecil): Nota Permintaan → disetujui & disalurkan Petugas → BAST. Dokumen yang dilewati tetap dapat dicetak otomatis dari data yang sama.
Nilai keluar dihitung FIFO saat posting.

### 7.5 Mutasi
Antar gudang (persediaan, lot pindah dengan harga aslinya); antar ruangan/unit (aset, riwayat lokasi; KIR otomatis diperbarui).

### 7.6 Peminjaman (internal sekolah)
Peminjaman alat oleh siswa/guru di dalam sekolah (bukan "pinjam pakai" BMD antar-instansi). `[DIAJUKAN → DISETUJUI] → DIPINJAM → DIKEMBALIKAN`, terlambat dihitung otomatis. Hanya unit berstatus `DIGUNAKAN`/tersedia; kondisi awal & akhir (+foto). Cetak **Kartu Peminjaman**.

### 7.7 Persediaan rusak/usang
Petugas membuat **Berita Acara Perubahan Fisik** → item keluar dari stok (`RUSAK_USANG`) ke **Daftar Persediaan Rusak Berat/Usang** (Pasal 38); tindak lanjut pemusnahan/penghapusan mengikuti §7.9.

### 7.8 Stock Opname / Inventarisasi
- **Persediaan:** wajib **setiap semester** (Pasal 39) — sistem mengingatkan menjelang akhir semester. Gudang dibekukan selama sesi; snapshot vs hitung fisik; persetujuan Kepala Sekolah → penyesuaian; cetak **Berita Acara Inventarisasi Fisik Persediaan**.
- **Aset:** per ruangan; mencocokkan KIR dengan fisik, kondisi (baik/rusak ringan/rusak berat), barang tidak ditemukan, barang belum tercatat. Hasil dikelompokkan seperti rekapitulasi hasil inventarisasi Permendagri 47/2021 (hilang, perubahan fisik, belum tercatat, tercatat ganda, dll.).

### 7.9 Usulan Penghapusan
Sesuai Permendagri 19/2016 jo. 7/2024 — **keputusan ada di kepala daerah**:
```
DRAF → DIAJUKAN (Kepsek) → DIKIRIM KE DINAS/BPKAD → [SK TERBIT] → DIHAPUS
                                                  ↘ DITOLAK
```
- Alasan: rusak berat/usang, hilang karena kecurian, hilang tidak ditemukan, terbakar/susut/kedaluwarsa, keadaan kahar, tindak lanjut inventarisasi.
- Data wajib per barang: tahun perolehan, kode barang, kode register, nama, jenis, identitas, kondisi, lokasi, nilai perolehan; lampiran foto; **surat keterangan kepolisian** bila kecurian.
- Cetak **surat usulan & daftar barang usulan penghapusan**. Status aset menjadi `DIUSULKAN_HAPUS` (tidak bisa dipinjam/dipindah). Saat SK terbit, petugas mencatat **nomor & tanggal SK** + lampiran → aset `DIHAPUS` (persediaan: `PENYESUAIAN_KURANG`).

### 7.10 Pemeliharaan
Formulir pemeliharaan → **Kartu Pemeliharaan** per unit aset (Pasal 40): tanggal, jenis (rutin/perbaikan), pelaksana, biaya, sumber dana & komponen BOSP (mis. "Pemeliharaan sarana dan prasarana sekolah"), uraian, kondisi sebelum/sesudah. Pemeliharaan yang menambah umur/kapasitas ditandai terpisah (bukan pemeliharaan rutin).

### 7.11 KIR
Dibentuk otomatis dari data aset per ruangan; dicetak **rangkap 2** (tempel & arsip); sistem menandai KIR "perlu diperbarui" setiap semester dan setiap ada perpindahan barang, penambahan barang, atau pergantian penanggung jawab ruangan (Permendagri 47/2021 Lampiran §K).

### 7.12 Notifikasi
Usulan menunggu, nota permintaan masuk, SPPB menunggu, peminjaman jatuh tempo/terlambat, stok di bawah minimum, opname semester, KIR perlu diperbarui, usulan penghapusan menunggu. Lonceng di aplikasi (realtime) + email.

### 7.13 Log aktivitas
Siapa, kapan, aksi, entitas, sebelum/sesudah, IP — tidak bisa diubah.

---

## 8. Dokumen Cetak (format standar)

Semua dokumen: kop sekolah (logo, nama Pemda/Dinas, nama sekolah, alamat), identitas BMD (kode lokasi), nomor & tanggal, blok tanda tangan sesuai jabatan BMD. Dibuat dari **template HTML** yang sama untuk layar dan cetak (CSS `@page`, A4/F4), diunduh sebagai PDF lewat dialog cetak browser; laporan tabel juga Excel.

| # | Dokumen | Rujukan | Isi pokok |
|---|---|---|---|
| 1 | **Kartu Penerimaan** (Buku Penerimaan Persediaan + BA Penerimaan) | Format II.I.3 | Tanggal, asal/penyedia, dokumen sumber (no/tgl), NUSP & nama barang, qty, satuan, harga, jumlah, sumber dana, keterangan |
| 2 | **Kartu Pengeluaran** (Buku Pengeluaran/Penyaluran + BAST) | Format II.I.4, II.I.9, II.I.10 | Tanggal, no SPPB/BAST, unit penerima, NUSP & nama, qty, harga FIFO, jumlah |
| 3 | **Kartu Barang Persediaan** (Kartu Stok) | Format II.I.5 | Per NUSP × gudang: tanggal, no dokumen, uraian, masuk/keluar/saldo (qty, harga, jumlah) |
| 4 | **Kartu Peminjaman** | Internal sekolah | Peminjam, kode register & nama barang, tgl pinjam/batas/kembali, kondisi awal/akhir, tanda tangan |
| 5 | Nota Permintaan · Surat Permintaan Barang · Surat Perintah Penyaluran Barang | Format II.I.6–8 | Sesuai alur §7.4 |
| 6 | **KIR** | Format II.K.2 | Ruangan, penanggung jawab; no, kode barang, nama/merk/tipe, no register, tahun, jumlah, harga, kondisi, keterangan |
| 7 | **KIB A–F** | Pembukuan BMD | KIB B: kode barang, nama, no register, merk/tipe, ukuran/CC, bahan, tahun pembelian, nomor pabrik/rangka/mesin/polisi/BPKB, asal-usul, harga, keterangan (16 kolom); KIB lain menyesuaikan golongannya |
| 8 | **Laporan Mutasi Persediaan** | Pelaporan semesteran | Per NUSP: saldo awal, masuk, keluar, saldo akhir (qty & Rp), per gudang & sumber dana |
| 9 | **Daftar Persediaan Rusak Berat/Usang** + BA Perubahan Fisik | Format II.I.11 | |
| 10 | **Kartu Pemeliharaan** | Format II.J.2 | Riwayat pemeliharaan per unit aset |
| 11 | **Berita Acara Inventarisasi Fisik / Stock Opname** + lembar kerja | Pasal 39; Lampiran II | Tercatat vs fisik, selisih, kondisi |
| 12 | **Usulan Penghapusan** (surat + daftar barang) | Permendagri 19/2016 jo. 7/2024 Pasal 452 | Data wajib §7.9 |
| 13 | **Label kode register** (QR + 2 baris kode) | Permendagri 108/2016 | Lembar label A4 beberapa ukuran |

Contoh setiap format (dengan data contoh) dibuat lebih dulu dan **disetujui sebelum modul terkait dibangun**.

---

## 9. Data Dasar

| Entitas | Isi |
|---|---|
| Unit | Kelas / mata pelajaran / program keahlian / bidang (label bisa disesuaikan) |
| Gedung & Ruangan | Lokasi aset; **penanggung jawab ruangan** (untuk KIR) |
| Gudang | Tempat persediaan; boleh terhubung ke unit & dibatasi ke petugas tertentu |
| Kode barang | Dataset Permendagri 108/2016 (platform, read-only) + kode lokal Pemda/sekolah |
| Item persediaan | NUSP, nama spesifikasi, satuan, stok minimum |
| Satuan | pcs, unit, set, rim, box, pak, lembar, buah, liter, meter, kg, … |
| Sumber dana | BOS Reguler, BOS Kinerja, BOS Afirmasi (+ komponennya), APBD/BOSDA, DAK, Hibah, Lainnya |
| Penyedia | Nama, alamat, NPWP opsional |
| Pagu anggaran | Unit × sumber dana × tahun (opsional) |
| Periode | Tahun anggaran Jan–Des; periode bulan/semester bisa ditutup |

---

## 10. Arsitektur Teknis

### 10.1 Komponen
```
PWA / Browser ──HTTPS──▶ Nginx (TLS, rate limit) ──▶ Next.js 16 (systemd, 127.0.0.1:3030)
                                                       │  Server Components + Server Actions
                                                       │  Route Handlers: /api/sse, /api/files, /q/[token], /cetak/*
                                                       ▼
                                          PostgreSQL 16 (db `inventaris`, RLS)  ◀── LISTEN/NOTIFY ── SSE
                                          Disk lokal /var/lib/inventaris/files (foto, nota, lampiran, logo)
Timer systemd: pengingat (jatuh tempo, stok minimum, opname semester, KIR), backup DB + file (harian)
```

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js 16 App Router, TypeScript strict |
| Paket & skrip | Bun 1.4 (sama dengan SIGW) |
| ORM & migrasi | Drizzle ORM + drizzle-kit (SQL eksplisit; RLS & trigger di migrasi) |
| Auth | Auth.js v5 (Credentials NPSN + username), sesi JWT 12 jam, status sekolah dicek per request |
| Validasi | Zod di setiap server action |
| UI | Tailwind + komponen ala shadcn/ui; TanStack Table; latar off-white, teks slate, aksen emerald |
| Dokumen cetak | Template HTML + CSS cetak (`@page`); PDF via dialog cetak browser; opsional render PDF di server dengan Chromium headless untuk cetak massal |
| Excel | exceljs (impor saldo awal, ekspor laporan) |
| QR | `qrcode` (buat), `BarcodeDetector`/`@zxing/browser` (scan) |
| Realtime | SSE + Postgres `LISTEN/NOTIFY` |
| Email | nodemailer via SMTP Google Workspace (`smtp.gmail.com:465`, App Password) dengan antrean `email_outbox` |
| Tes | `bun test` (mesin stok, isolasi sekolah), Playwright (alur utama & tampilan cetak) |

### 10.2 Isolasi multi-sekolah
Helper `withSchool(session, fn)` (school_id dari sesi, status `ACTIVE`, transaksi) + **Row-Level Security** dengan `SET LOCAL app.school_id`. Role aplikasi tanpa `BYPASSRLS`; dataset kode BMD adalah tabel platform (baca saja).

### 10.3 Keamanan
bcrypt (cost 12), rate limit login/daftar, kunci sementara setelah gagal berulang; unggahan dicek isi, nama dibuat server, disajikan lewat route ber-otorisasi; token QR acak; header keamanan; `bun audit` sebelum rilis.

### 10.4 Deploy (pola SIGW)
`/var/www/inventaris` (repo + aplikasi, milik `ubuntu`; app berjalan sebagai user `inventaris`, read-only ke kode) · DB `inventaris` · file `/var/lib/inventaris/files` · backup harian 14 hari · `inventaris.service` + timer · Nginx + Let's Encrypt · `inventaris-update`.

---

## 11. Model Data (ringkas)

Semua tabel sekolah memiliki `id`, `school_id`, `created_at`, `updated_at` dan dilindungi RLS.

**Platform:** `schools` (npsn, nama, jenjang, provinsi, kab/kota, status kepemilikan, kode pengguna/kuasa/sub kuasa, status pendaftaran) · `platform_admins` · `bmd_codes` (13.780 kode: kode, tingkat, uraian, induk, golongan, bisa_dipilih) · `regions` (kode wilayah).
**Sekolah:** `school_settings` (persetujuan, mode penyaluran, akun siswa, batas kapitalisasi per golongan, jabatan & penandatangan) · `users` · `user_roles` · `user_units` · `user_warehouses` · `local_bmd_codes` (kode tambahan Pemda/sekolah + dasar keputusan).
**Data dasar:** `units`, `buildings`, `rooms` (+ penanggung jawab), `warehouses`, `uoms`, `funding_sources` (+ komponen), `vendors`, `budget_ceilings`, `fiscal_periods`.
**Barang & stok:** `supply_items` (NUSP, kode barang, spesifikasi, satuan, stok minimum, token QR) · `assets` (kode barang, nomor register, intra/ekstra, atribut KIB, perolehan, sumber dana, ruangan, kondisi, status, token QR) · `asset_location_history` · `asset_condition_history` · `stock_lots` · `stock_balances` · `stock_movements`.
**Dokumen** (kepala + baris, `nomor`, `status`, `tanggal`, dibuat/diposting oleh): `proposals`, `procurements`, `receipts`, `supply_requests` (nota permintaan), `distribution_orders` (surat permintaan & SPPB), `issues` (penyaluran/BAST), `transfers`, `asset_moves`, `loans`, `damage_reports` (BA perubahan fisik), `stock_opnames`, `asset_inventories`, `disposal_proposals` (+ SK), `maintenances`, `kir_snapshots` (KIR tercetak per semester).
**Pendukung:** `doc_counters`, `attachments`, `notifications`, `email_outbox`, `activity_logs`.

---

## 12. Antarmuka
Bersih & minimalis (off-white, slate, emerald), mobile-first untuk Petugas (scan → aksi cepat), navigasi per peran: Dashboard · Barang (Persediaan, Aset, KIR) · Transaksi (Penerimaan, Penyaluran, Mutasi, Peminjaman) · Usulan & Pengadaan · Audit (Opname/Inventarisasi, Rusak/Usang, Penghapusan, Pemeliharaan) · Laporan · Pengaturan. Mockup layar utama disetujui di awal Fase 0.

---

## 13. Tahapan Pengembangan

| Fase | Isi | Selesai bila |
|---|---|---|
| **0 Fondasi** | Repo, skema + RLS, dataset kode BMD & wilayah, Auth NPSN, pendaftaran (pernyataan sekolah negeri) + panel pengelola, wizard setup + kode BMD Pemda, pengguna & peran, data dasar, log, deploy | Dua sekolah uji terisolasi total; sekolah pending/nonaktif terkunci |
| **1 Inti Stok** (live) | Item persediaan (NUSP), penerimaan, penyaluran (mode ringkas & lengkap) + BAST, mutasi, Kartu Barang Persediaan FIFO, aset per unit + kode register + label, saldo awal, scan QR, tutup periode | Tes FIFO & konkurensi lulus; saldo = Σ buku besar; format 1–3, 5, 13 disetujui |
| **2 Alur Kerja** | Usulan + pagu + sumber dana/komponen BOSP, pengadaan, peminjaman + Kartu Peminjaman, notifikasi + email | Format 4 disetujui |
| **3 Audit & Laporan** | Opname semester & inventarisasi aset, persediaan rusak/usang, usulan penghapusan + SK, pemeliharaan, KIR, KIB A–F, laporan mutasi persediaan, dashboard realtime, ekspor Excel | Format 6–12 disetujui |

---

## 14. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Selisih stok karena transaksi bersamaan | Kunci baris saldo & lot, urutan kunci tetap, constraint, tes konkurensi |
| Kebocoran data antar sekolah | RLS + `withSchool` + tes isolasi otomatis |
| Format/kode tidak sesuai aturan Pemda setempat | Kode lokal Pemda, jabatan & penandatangan bisa disesuaikan, nomor register bisa diimpor, format disetujui sebelum dibangun |
| Sekolah tidak tahu kode pengguna/kuasa pengguna | Boleh menyusul; label register ditandai "sementara" sampai kode diisi |
| Dataset regulasi berisi kesalahan | Kode ganda di regulasi didokumentasikan (`data/bmd/kode-ganda-di-regulasi.json`); dataset diverifikasi ke PDF resmi |
| Sekolah non-negeri ikut mendaftar | Pernyataan wajib + verifikasi NPSN (status negeri) oleh pengelola platform |

---

## 15. Tindak Lanjut

1. **[TINDAK LANJUT] Deploy key** `inventaris` ditambahkan ke repo `pindoyono/inventaris` (Settings → Deploy keys, *Allow write access*).
2. **Email — siap.** Record SPF `v=spf1 include:_spf.google.com ~all` sudah aktif di `smkn2malinau.sch.id` (dicek 6 Okt 2026). App Password Google Workspace `admin@smkn2malinau.sch.id` sudah tersedia; dimasukkan langsung ke file env server saat Fase 2 (tidak lewat chat).
3. **Batas kapitalisasi SMKN 2 Malinau: Rp2.000.000** — dipakai sebagai nilai bawaan semua golongan (dapat diubah per golongan di Pengaturan bila Perkada membedakannya). Aset ≥ Rp2.000.000 → intrakomptabel (`01`), di bawahnya → ekstrakomptabel (`02`).
4. **[TINDAK LANJUT] Kode pengguna barang (Dinas) & kode kuasa pengguna barang (sekolah) — belum diketahui.** Sistem tetap berjalan tanpa kode ini: kode register & label ditandai **"SEMENTARA"** dan dapat dicetak ulang otomatis setelah kode diisi. Cara mendapatkannya:
   - lihat **label/stiker barcode inventaris** yang sudah tertempel pada aset sekolah (komputer, meja, proyektor) — baris atas label memuat kode lokasi; atau
   - lihat **KIB/KIR** yang pernah diterbitkan Dinas/BPKAD untuk sekolah (baris "No. Kode Lokasi"); atau
   - tanyakan ke **pengurus barang Dinas Pendidikan dan Kebudayaan Provinsi Kalimantan Utara** atau **BPKAD Provinsi** (aplikasi BMD Pemda).
5. **[TINDAK LANJUT] Persetujuan contoh format cetak** (§8) — sedang ditinjau; perubahan menyusul sebelum fase yang memakainya.

### 15.x Catatan sumber format cetak (7 Oktober 2026)
- PDF Permendagri 47/2021 yang tersedia hanya memuat **uraian** lampiran (hlm. 44–107 berupa gambar, dibaca dengan OCR); **tabel/formulir format II.I.x, II.K.x tidak termasuk**. Format cetak di aplikasi disusun dari unsur yang disebut dalam uraian + praktik Pemda, lalu disetujui pengguna.
- PDF Permendagri 19/2016 berakhir di Pasal 515 **tanpa lampiran** (Pasal 513 menyebut "Format penghapusan barang milik daerah" ada di Lampiran).
- Permendagri 7/2024 memuat format resmi **RKBMD untuk Penghapusan oleh Kuasa Pengguna Barang** (Lampiran A.5, hlm. 94) — sudah diterapkan apa adanya (`/cetak/penghapusan/[id]?format=rkbmd`).
- Tindak lanjut: bila lampiran format lengkap kedua Permendagri diperoleh (JDIH Kemendagri / BPKAD), cocokkan kolom per kolom.
