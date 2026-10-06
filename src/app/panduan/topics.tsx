import type { ReactNode } from "react";
import { Btn, FlowBlock, Go, H2, H3, List, P, Steps, Table, Tip } from "./ui";

export type Topic = { slug: string; title: string; summary: string; who: string; flow?: string; body: () => ReactNode };

const Y = "✔";

export const TOPICS: Topic[] = [
  {
    slug: "mulai",
    title: "Memulai",
    summary: "Mendaftarkan sekolah, masuk, mengenal tampilan, notifikasi, pindai QR, dan memasang aplikasi di HP.",
    who: "Semua pengguna",
    flow: "umum",
    body: () => (
      <>
        <P>Inventaris adalah aplikasi penatausahaan Barang Milik Daerah (BMD) untuk sekolah negeri. Aplikasi ini mencatat barang habis pakai (persediaan) dan aset tetap per unit, lengkap dengan kode register, label QR, dan cetakan format resmi (Permendagri 47/2021, 19/2016, dan 7/2024). Data setiap sekolah terpisah dan hanya bisa dilihat pengguna sekolah itu.</P>

        <H2 id="daftar">1. Mendaftarkan sekolah</H2>
        <Steps>
          <li>Buka <Go href="/daftar">Daftar sekolah</Go>. Isi NPSN, nama sekolah, jenjang, wilayah, kontak penanggung jawab, dan akun Admin pertama.</li>
          <li>Centang pernyataan, lalu kirim. Pendaftaran diperiksa pengelola platform; Anda menerima email setelah disetujui.</li>
          <li>Setelah disetujui, masuk di <Go href="/login">halaman masuk</Go> dengan <b>NPSN + nama pengguna + kata sandi</b>.</li>
        </Steps>
        <Tip>Hanya sekolah negeri milik Pemerintah Daerah yang dapat didaftarkan. Satu NPSN hanya bisa didaftarkan sekali.</Tip>

        <H2 id="masuk">2. Masuk & kata sandi</H2>
        <List>
          <li>Masuk selalu memakai tiga isian: NPSN sekolah, nama pengguna, dan kata sandi.</li>
          <li>Setelah 5 kali salah kata sandi, akun dikunci 15 menit.</li>
          <li>Ganti kata sandi lewat nama Anda di pojok kanan atas, atau buka <Go href="/akun/password">Ganti kata sandi</Go>. Pengguna baru wajib mengganti kata sandi saat pertama masuk.</li>
          <li>Lupa kata sandi? Minta Admin sekolah mengatur ulang dari menu <Go href="/pengguna">Pengguna</Go>.</li>
        </List>

        <H2 id="tampilan">3. Mengenal tampilan</H2>
        <List>
          <li><b>Menu atas</b> hanya menampilkan menu yang sesuai peran Anda (lihat <Go href="/panduan/peran">Peran & hak akses</Go>).</li>
          <li><b>Dasbor</b> berisi ringkasan: nilai aset, nilai persediaan, stok menipis, peminjaman terlambat, aset rusak berat, KIR yang perlu diperbarui, dan pekerjaan yang menunggu tindakan Anda. Angkanya diperbarui otomatis.</li>
          <li><b>Ikon lonceng</b> (<Go href="/notifikasi">Notifikasi</Go>) menampilkan pemberitahuan seperti permintaan yang perlu disetujui, barang siap diambil, peminjaman jatuh tempo, atau stok menipis. Notifikasi penting juga dikirim lewat email bila alamat email pengguna diisi.</li>
          <li><b>Ikon pindai</b> (<Go href="/pindai">Pindai QR</Go>) membuka kamera untuk membaca label QR barang.</li>
          <li>Daftar dan dasbor ikut berubah sendiri ketika pengguna lain menyimpan data, tanpa perlu memuat ulang halaman.</li>
        </List>

        <H2 id="hp">4. Memakai di HP</H2>
        <P>Aplikasi bisa dipasang seperti aplikasi biasa. Di Chrome Android, buka situs lalu pilih menu ⋮ → <Btn>Tambahkan ke layar utama</Btn> atau <Btn>Instal aplikasi</Btn>. Di iPhone (Safari): tombol Bagikan → <Btn>Tambah ke Layar Utama</Btn>. Fitur pindai QR dan unggah foto langsung memakai kamera HP.</P>

        <H2 id="alur">5. Alur besar penggunaan</H2>
        <P>Klik kotak berwarna hijau toska untuk membuka halaman yang dimaksud. Semua alur rinci ada di <Go href="/panduan/alur">halaman Flowchart</Go>.</P>
        <FlowBlock id="umum" compact />
      </>
    ),
  },
  {
    slug: "peran",
    title: "Peran & hak akses",
    summary: "Enam peran pengguna, padanannya dalam jabatan BMD, dan menu yang bisa diakses masing-masing.",
    who: "Admin, Kepala Sekolah",
    body: () => (
      <>
        <P>Satu pengguna boleh memiliki lebih dari satu peran. Admin mengatur peran di menu <Go href="/pengguna">Pengguna</Go>.</P>
        <Table
          head={["Peran", "Jabatan BMD / contoh", "Tugas utama"]}
          rows={[
            [<b key="a">Admin Sekolah</b>, "Operator sekolah", "Penyiapan, data dasar, pengguna, impor, tutup buku"],
            [<b key="k">Kepala Sekolah</b>, "Kuasa Pengguna Barang", "Menyetujui usulan, permintaan (SPPB), stock opname; mengajukan usulan penghapusan; menandatangani dokumen"],
            [<b key="v">Verifikator</b>, "Wakasek sarpras / bendahara", "Memeriksa usulan & permintaan bila persetujuan 2 tingkat"],
            [<b key="p">Petugas Barang</b>, "Pengurus Barang Pembantu", "Mencatat persediaan & aset, menyalurkan, pengadaan, audit, pemeliharaan, KDP, pemanfaatan, laporan"],
            [<b key="u">Pengusul</b>, "Guru / kepala unit / kaprodi", "Membuat usulan kebutuhan dan nota permintaan untuk unitnya"],
            [<b key="m">Peminjam</b>, "Guru / staf / siswa berakun", "Mengajukan peminjaman barang"],
          ]}
        />
        <H3>Menu yang terlihat</H3>
        <Table
          head={["Menu", "Admin", "Kepsek", "Verifikator", "Petugas", "Pengusul", "Peminjam"]}
          rows={[
            ["Dasbor, Aset, Kode Barang", Y, Y, Y, Y, Y, Y],
            ["Usulan", Y, Y, Y, Y, Y, ""],
            ["Permintaan", Y, Y, Y, Y, Y, ""],
            ["Peminjaman", Y, Y, Y, Y, "", Y],
            ["Pengadaan, Persediaan, Audit, Laporan", Y, Y, Y, Y, "", ""],
            ["Data Dasar, Impor Excel", Y, "", "", Y, "", ""],
            ["Penyiapan, Pengguna", Y, "", "", "", "", ""],
            ["Log Aktivitas", Y, Y, "", "", "", ""],
            ["Pagu, Tutup buku", Y, Y, "", "", "", ""],
          ]}
        />
        <Tip>Pengusul hanya melihat dan mengajukan untuk unit yang ditetapkan baginya. Semua tindakan tercatat di <Go href="/log">Log Aktivitas</Go>.</Tip>
      </>
    ),
  },
  {
    slug: "penyiapan",
    title: "Penyiapan sekolah",
    summary: "Profil & kop, kode BMD, batas kapitalisasi, unit/ruangan/gudang, alur kerja, dan pengguna.",
    who: "Admin",
    flow: "penyiapan",
    body: () => (
      <>
        <P>Buka <Go href="/pengaturan">Penyiapan</Go>. Halaman ini menampilkan daftar langkah beserta tanda selesai. Selama penyiapan belum ditandai selesai, Admin melihat pengingat di bagian atas setiap halaman.</P>
        <H2>Langkah-langkah</H2>
        <Steps>
          <li><Go href="/pengaturan/profil">Profil & kop dokumen</Go>: alamat lengkap, logo Pemda & sekolah, nama dan NIP Kepala Sekolah (Kuasa Pengguna Barang) serta Pengurus Barang. Data ini muncul di kop dan tanda tangan semua cetakan.</li>
          <li><Go href="/pengaturan/kode-bmd">Kode BMD & kapitalisasi</Go>: kode Pengguna/Kuasa Pengguna Barang dari BPKAD dan <b>batas kapitalisasi</b> (bawaan Rp2.000.000; sesuaikan dengan Perkada). Selama kode belum diisi, kode register dicetak dengan tanda <i>SEMENTARA</i>.</li>
          <li><Go href="/data-dasar">Data dasar</Go>: <Go href="/data-dasar/unit">Unit</Go>, <Go href="/data-dasar/gedung">Gedung</Go>, <Go href="/data-dasar/ruangan">Ruangan</Go> (isi penanggung jawab untuk KIR), <Go href="/data-dasar/gudang">Gudang</Go> (tandai satu sebagai gudang utama), <Go href="/data-dasar/satuan">Satuan</Go>, <Go href="/data-dasar/sumber-dana">Sumber dana</Go> & <Go href="/data-dasar/komponen-dana">komponen</Go> (mis. BOSP), dan <Go href="/data-dasar/penyedia">Penyedia</Go>.</li>
          <li><Go href="/pengaturan/alur-kerja">Alur kerja</Go>:
            <List>
              <li><b>Tingkat persetujuan</b>: 1 tingkat (langsung Kepala Sekolah) atau 2 tingkat (Verifikator lalu Kepala Sekolah).</li>
              <li><b>Mode distribusi</b>: <i>Ringkas</i> (permintaan langsung disalurkan Petugas) atau <i>Lengkap</i> (surat permintaan → SPPB → BAST sesuai Permendagri 47/2021).</li>
              <li><b>Akun siswa</b>: izinkan siswa punya akun peminjam.</li>
            </List>
          </li>
          <li><Go href="/pengguna">Pengguna</Go>: buat akun Kepala Sekolah, Petugas Barang, Verifikator, Pengusul (pilih unitnya), dan Peminjam. Kata sandi awal diberikan langsung kepada yang bersangkutan.</li>
          <li>Punya data lama? Gunakan <Go href="/panduan/impor">Impor Excel</Go> untuk ruangan, pengguna, aset (KIB/KIR lama), dan persediaan beserta saldo awal.</li>
          <li>Kembali ke <Go href="/pengaturan">Penyiapan</Go> lalu klik <Btn>Tandai penyiapan selesai</Btn>.</li>
        </Steps>
        <Tip>Semua isian penyiapan bisa diubah kapan saja. Data dasar yang sudah dipakai transaksi tidak bisa dihapus, tetapi bisa dinonaktifkan.</Tip>
        <H2>Flowchart</H2>
        <FlowBlock id="penyiapan" compact />
      </>
    ),
  },
  {
    slug: "usulan-pengadaan",
    title: "Usulan kebutuhan & pengadaan",
    summary: "Pagu per unit, usulan dan persetujuannya, pengadaan, serta penerimaan barang yang otomatis masuk persediaan/aset.",
    who: "Pengusul, Verifikator, Kepala Sekolah, Petugas",
    flow: "usulan",
    body: () => (
      <>
        <H2>Pagu</H2>
        <P>Admin atau Kepala Sekolah mengisi <Go href="/usulan/pagu">Pagu</Go> per tahun, unit, dan sumber dana. Saat menyetujui usulan, Kepala Sekolah melihat sisa pagu, dan nilai yang disetujui tidak boleh melebihinya.</P>
        <H2>Membuat usulan (Pengusul)</H2>
        <Steps>
          <li>Buka <Go href="/usulan/baru">Usulan baru</Go>. Pilih unit, tahun anggaran, sumber dana, dan judul.</li>
          <li>Tambahkan barang dengan <Btn>+ Persediaan</Btn> (pilih dari daftar barang) atau <Btn>+ Aset tetap</Btn> (pilih kode barang), lalu isi jumlah, perkiraan harga, dan alasan kebutuhan.</li>
          <li>Klik <Btn>Simpan draf</Btn> bila belum selesai, atau <Btn>Ajukan usulan</Btn>.</li>
        </Steps>
        <H2>Persetujuan</H2>
        <List>
          <li><b>2 tingkat</b>: Verifikator memeriksa dulu (<Btn>Verifikasi</Btn>), kemudian Kepala Sekolah menyetujui.</li>
          <li>Kepala Sekolah boleh mengurangi jumlah yang disetujui per baris. Kembalikan untuk diperbaiki atau tolak, dengan alasan.</li>
          <li>Pengusul mendapat notifikasi di setiap perubahan status.</li>
        </List>
        <H2>Pengadaan (Petugas)</H2>
        <Steps>
          <li>Dari usulan yang disetujui klik <Btn>Buat pengadaan dari usulan ini</Btn>, atau buat <Go href="/pengadaan/baru">pengadaan langsung</Go>.</li>
          <li>Isi penyedia, nomor dan tanggal nota/SPK, harga satuan, dan pajak bila ada. Klik <Btn>Tandai dipesan</Btn>.</li>
          <li>Saat barang datang, buka pengadaan lalu <b>terima barang</b>. Penerimaan boleh bertahap. Barang persediaan masuk ke gudang yang dipilih lewat dokumen penerimaan yang langsung diposting. Aset tetap dicatat per unit dengan nomor register, status intra/ekstrakomptabel, dan QR; ruangan dan kondisinya bisa dipilih.</li>
          <li>Unggah nota/kuitansi/foto di bagian lampiran.</li>
        </Steps>
        <H2>Flowchart</H2>
        <FlowBlock id="usulan" compact />
      </>
    ),
  },
  {
    slug: "persediaan",
    title: "Persediaan",
    summary: "Daftar barang (NUSP), dokumen stok, posting & pembatalan, FIFO, kartu barang, stok minimum.",
    who: "Petugas (Kepala Sekolah/Verifikator melihat)",
    flow: "persediaan",
    body: () => (
      <>
        <P>Persediaan adalah barang habis pakai, seperti ATK, bahan praktik, bahan kebersihan, dan obat-obatan. Nilainya dihitung dengan metode <b>FIFO</b>: barang yang masuk lebih dulu dianggap keluar lebih dulu, dengan harga lotnya masing-masing.</P>
        <H2>Daftar barang</H2>
        <P>Di <Go href="/persediaan">Persediaan</Go> klik <Btn>+ Barang</Btn>. Pilih kode barang persediaan (NUSP), lalu isi nama, satuan, dan stok minimum. Barang yang stoknya di bawah minimum diberi tanda, dan Petugas menerima notifikasi harian.</P>
        <H2>Dokumen stok</H2>
        <Table
          head={["Dokumen", "Kapan dipakai", "Buka"]}
          rows={[
            ["Saldo awal", "Sekali, saat mulai memakai aplikasi (atau lewat impor Excel)", <Go key="1" href="/persediaan/dokumen/baru?jenis=SALDO_AWAL">Buat</Go>],
            ["Penerimaan", "Barang masuk: pembelian, hibah, dll. (otomatis dari menu Pengadaan)", <Go key="2" href="/persediaan/dokumen/baru?jenis=PENERIMAAN">Buat</Go>],
            ["Penyaluran", "Barang keluar ke unit (otomatis dari menu Permintaan)", <Go key="3" href="/persediaan/dokumen/baru?jenis=PENYALURAN">Buat</Go>],
            ["Mutasi antar gudang", "Memindahkan stok antar gudang", <Go key="4" href="/persediaan/dokumen/baru?jenis=MUTASI">Buat</Go>],
            ["Rusak/usang", "Mengeluarkan barang rusak/kedaluwarsa", <Go key="5" href="/persediaan/dokumen/baru?jenis=RUSAK_USANG">Buat</Go>],
            ["Penyesuaian tambah/kurang", "Otomatis dari hasil stock opname yang disetujui", <Go key="6" href="/audit/opname">Stock opname</Go>],
          ]}
        />
        <H3>Draf, posting, dan pembatalan</H3>
        <List>
          <li>Dokumen disimpan sebagai <b>draf</b> lebih dulu dan masih bisa diubah. Setelah <b>diposting</b>, stok dan kartu barang berubah.</li>
          <li>Dokumen yang sudah diposting tidak bisa diubah atau dihapus. Bila salah, gunakan <Btn>Batalkan dokumen…</Btn>; aplikasi membuat jurnal pembalik, lalu buat dokumen baru yang benar.</li>
          <li>Dokumen bertanggal pada periode yang sudah ditutup buku tidak bisa ditambah atau dibatalkan.</li>
          <li>Selama stock opname berjalan, gudang dibekukan: tidak ada barang masuk atau keluar.</li>
        </List>
        <H3>Kartu barang & cetak</H3>
        <P>Buka barang untuk melihat kartu barang (riwayat masuk/keluar, lot FIFO, dan saldo per gudang). Gunakan <Btn>Cetak kartu barang persediaan</Btn>. Bukti dokumen bisa dicetak dari halaman dokumen. Laporannya ada di <Go href="/laporan/mutasi">Mutasi persediaan</Go> dan <Go href="/laporan/buku">Buku penerimaan & pengeluaran</Go>.</P>
        <H2>Flowchart</H2>
        <FlowBlock id="persediaan" compact />
      </>
    ),
  },
  {
    slug: "permintaan",
    title: "Permintaan barang",
    summary: "Nota permintaan dari unit, persetujuan, penyaluran, dan dokumen nota/surat permintaan/SPPB/BAST.",
    who: "Pengusul, Petugas, Verifikator, Kepala Sekolah",
    flow: "permintaan",
    body: () => (
      <>
        <H2>Membuat nota permintaan (Pengusul)</H2>
        <Steps>
          <li>Buka <Go href="/permintaan/baru">Nota permintaan baru</Go>. Pilih unit, ketik nama barang, lalu pilih dari daftar. Stok yang tersedia ikut ditampilkan.</li>
          <li>Isi jumlah dan keperluan, lalu klik <Btn>Ajukan</Btn> (atau simpan sebagai draf dulu).</li>
          <li>Ikuti statusnya di <Go href="/permintaan">Permintaan</Go>; Anda diberi notifikasi saat barang disalurkan, dikembalikan, atau ditolak.</li>
        </Steps>
        <H2>Pemrosesan</H2>
        <Table
          head={["Status", "Menunggu", "Tindakan"]}
          rows={[
            ["Diajukan", "Petugas Barang", "Mode ringkas: Salurkan. Mode lengkap: Teruskan (membuat surat permintaan). Bisa Kembalikan/Tolak."],
            ["Diteruskan", "Verifikator (2 tingkat) atau Kepala Sekolah", "Verifikasi / Setujui (membuat SPPB); jumlah boleh dikurangi"],
            ["Diverifikasi", "Kepala Sekolah", "Setujui (SPPB)"],
            ["Disetujui", "Petugas Barang", "Salurkan: pilih gudang; BAST dibuat dan stok berkurang (FIFO)"],
            ["Selesai / Ditolak / Dibatalkan", "—", "Arsip; dokumen bisa dicetak"],
          ]}
        />
        <Tip>Jumlah yang disalurkan boleh lebih kecil dari yang diminta bila stok kurang. Dari halaman permintaan tersedia <Btn>Cetak nota permintaan</Btn>, <Btn>Cetak surat permintaan</Btn>, <Btn>Cetak SPPB</Btn>, dan <Btn>Cetak BAST</Btn>.</Tip>
        <H2>Flowchart</H2>
        <FlowBlock id="permintaan" compact />
      </>
    ),
  },
  {
    slug: "aset",
    title: "Aset tetap",
    summary: "Mencatat aset per unit, kapitalisasi, kode register & label QR, KIR, pindah/kondisi, reklasifikasi, koreksi.",
    who: "Petugas (semua peran dapat melihat)",
    flow: "aset",
    body: () => (
      <>
        <P>Setiap unit aset dicatat terpisah, misalnya 30 kursi = 30 nomor register. Menu <Go href="/aset">Aset</Go> punya tiga tab: <b>Daftar aset</b>, <Go href="/aset/kdp">KDP & renovasi</Go>, dan <Go href="/aset/pemanfaatan">Pemanfaatan</Go>.</P>
        <H2>Mencatat aset</H2>
        <Steps>
          <li>Klik <Btn>+ Catat aset</Btn>. Cari kode barang dengan kata sehari-hari, misalnya <i>laptop</i>, <i>meja siswa</i>, <i>AC</i>. Kode yang sering dipakai bisa dijadikan favorit.</li>
          <li>Isi nama/merk, tanggal dan cara perolehan, harga satuan, sumber dana, ruangan, kondisi, dan <b>jumlah unit</b>. Kolom khusus sesuai golongan KIB (mis. nomor rangka/BPKB untuk kendaraan, luas & sertifikat untuk tanah) muncul otomatis.</li>
          <li>Aplikasi menetapkan <b>intrakomptabel</b> bila harga ≥ batas kapitalisasi, dan <b>ekstrakomptabel</b> bila di bawahnya. Tanah dan KDP selalu intrakomptabel.</li>
          <li>Setelah disimpan, klik <Btn>Cetak label</Btn> untuk mencetak label berkode register + QR, lalu tempelkan di barang.</li>
        </Steps>
        <Tip>Barang dari pengadaan tidak perlu dicatat ulang karena otomatis tercatat saat diterima. KDP dan aset dalam renovasi dicatat lewat tab KDP & renovasi.</Tip>
        <H2>Halaman barang</H2>
        <List>
          <li><b>Perbarui lokasi / kondisi</b>: pindah ruangan dan ubah kondisi (Baik / Rusak ringan / Rusak berat). Untuk banyak barang sekaligus, centang di daftar aset.</li>
          <li><b>Tidak digunakan untuk tusi</b>: tandai barang yang menganggur beserta rencana (penggunaan/pemanfaatan/pemindahtanganan). Masuk laporan C.3.</li>
          <li><b>Reklasifikasi</b>: memindahkan kode/golongan barang (nomor register baru, QR tetap) atau mengubah intra↔ekstrakomptabel.</li>
          <li><b>Koreksi nilai/tanggal</b>: memperbaiki nilai, tanggal, atau asal perolehan. Selisih nilai tercatat di riwayat.</li>
          <li>Riwayat lengkap (dicatat, pindah, kondisi, status, perubahan nilai/klasifikasi), kartu pemeliharaan, serta foto & dokumen.</li>
        </List>
        <H2>Pindai QR</H2>
        <P>Buka <Go href="/pindai">Pindai</Go> lalu arahkan kamera ke label. Data barang langsung tampil, termasuk ruangan, kondisi, dan statusnya. Orang luar yang memindai label hanya melihat identitas singkat barang.</P>
        <H2>Kartu Inventaris Ruangan (KIR)</H2>
        <List>
          <li><Go href="/laporan/kir">KIR</Go> disusun otomatis dari posisi aset di tiap ruangan.</li>
          <li><Go href="/laporan/kir/status">Status KIR</Go> menandai ruangan yang KIR-nya <i>perlu diperbarui</i>, yaitu bila belum pernah dicetak, sudah berganti semester, ada perpindahan/perubahan barang, atau penanggung jawab berganti.</li>
          <li>Cetak KIR rangkap 2 (satu ditempel di ruangan, satu diarsipkan), lalu klik <Btn>Tandai sudah dicetak & ditempel</Btn>. Bisa juga <Btn>Cetak KIR semua ruangan</Btn> sekaligus.</li>
        </List>
        <H2>Flowchart</H2>
        <FlowBlock id="aset" compact />
      </>
    ),
  },
  {
    slug: "peminjaman",
    title: "Peminjaman",
    summary: "Pengajuan oleh peminjam berakun, peminjaman langsung oleh Petugas, pengembalian, dan keterlambatan.",
    who: "Peminjam, Petugas",
    flow: "peminjaman",
    body: () => (
      <>
        <H2>Peminjam berakun</H2>
        <Steps>
          <li>Buka <Go href="/peminjaman/baru">Ajukan peminjaman</Go>, cari barang yang berstatus <i>digunakan</i>, lalu isi keperluan dan batas pengembalian.</li>
          <li>Petugas menyetujui dan menyerahkan barang (<Btn>Serahkan</Btn>), atau menolak.</li>
        </Steps>
        <H2>Petugas mencatat langsung (siswa/tamu)</H2>
        <Steps>
          <li>Buka <Go href="/peminjaman/baru">Catat peminjaman</Go>, pilih <i>Siswa/tamu</i>, lalu isi nama dan kelas/NIS.</li>
          <li>Tambahkan barang dengan mencari atau <Btn>Pindai label</Btn>, dan catat kondisi saat diserahkan.</li>
        </Steps>
        <H2>Pengembalian</H2>
        <P>Buka peminjaman, pilih barang yang kembali (boleh sebagian), lalu isi kondisi saat kembali. Kondisi aset ikut diperbarui. Peminjaman yang melewati batas waktu masuk tab <Go href="/peminjaman?tab=terlambat">Terlambat</Go>, dan peminjam serta Petugas menerima pengingat setiap hari. <Btn>Cetak kartu peminjaman</Btn> tersedia di halaman peminjaman.</P>
        <H2>Flowchart</H2>
        <FlowBlock id="peminjaman" compact />
      </>
    ),
  },
  {
    slug: "pemeliharaan",
    title: "Pemeliharaan",
    summary: "Kartu pemeliharaan, status dalam pemeliharaan, biaya & sumber dana, kapitalisasi peningkatan.",
    who: "Petugas",
    flow: "pemeliharaan",
    body: () => (
      <>
        <Steps>
          <li>Dari halaman barang klik <Btn>+ Catat pemeliharaan</Btn>, atau buka <Go href="/audit/pemeliharaan/baru">Catat pemeliharaan</Go>.</li>
          <li>Pilih jenis: <b>rutin</b>, <b>perbaikan</b>, atau <b>peningkatan</b> (menambah umur, kapasitas, atau mutu). Isi uraian, pelaksana, biaya, dan sumber dana.</li>
          <li>Bila pekerjaan sudah selesai, centang <i>Sudah selesai</i>. Bila belum, barang berstatus <i>dalam pemeliharaan</i> sampai Anda klik <Btn>Tandai selesai</Btn> di <Go href="/audit/pemeliharaan">Pemeliharaan</Go>.</li>
          <li>Untuk peningkatan, centang <b>Kapitalisasi</b> bila biayanya memenuhi batas kapitalisasi pemeliharaan dalam Perkada. Nilai aset bertambah dan tercatat di riwayat nilai.</li>
        </Steps>
        <P>Kartu pemeliharaan per barang bisa dicetak dari halaman barang (<Btn>Cetak kartu</Btn>).</P>
        <H2>Flowchart</H2>
        <FlowBlock id="pemeliharaan" compact />
      </>
    ),
  },
  {
    slug: "audit",
    title: "Stock opname & inventarisasi",
    summary: "Hitung fisik persediaan per gudang dan cocokkan aset per ruangan setiap semester, beserta tindak lanjut temuannya.",
    who: "Petugas, Kepala Sekolah",
    flow: "audit",
    body: () => (
      <>
        <H2>Stock opname persediaan</H2>
        <Steps>
          <li>Di <Go href="/audit/opname">Stock opname</Go>, mulai opname untuk satu gudang. Gudang langsung dibekukan dan saldo menurut sistem disalin sebagai pembanding.</li>
          <li>Isi hasil hitung fisik per barang (baik dan rusak). Barang yang ada fisiknya tetapi bersaldo 0 bisa ditambahkan. Klik <Btn>Simpan hasil hitung</Btn>, lalu ajukan.</li>
          <li>Kepala Sekolah memeriksa selisih lalu menyetujui. Kelebihan dibukukan sebagai penyesuaian tambah, kekurangan sebagai penyesuaian kurang (FIFO), dan barang rusak sebagai rusak/usang. Gudang dibuka kembali.</li>
          <li>Cetak berita acara stock opname dari halaman opname.</li>
        </Steps>
        <Tip tone="warn">Stock opname wajib dilakukan setiap semester (Permendagri 47/2021 Pasal 39). Aplikasi mengingatkan pada tanggal 15 dan 25 Juni/Desember bila belum dilakukan.</Tip>
        <H2>Inventarisasi aset</H2>
        <Steps>
          <li>Di <Go href="/audit/inventarisasi">Inventarisasi</Go>, mulai untuk satu ruangan. Daftar aset menurut catatan (KIR) muncul otomatis.</li>
          <li>Tandai setiap barang <i>ditemukan</i> atau <i>tidak</i> beserta kondisi fisiknya. Gunakan tombol pindai: barang yang dipindai otomatis ditandai ditemukan, dan muncul peringatan bila barang itu tercatat di ruangan lain.</li>
          <li>Bila data barang salah, pilih kolom <b>Tindak lanjut</b>: <i>perlu reklasifikasi</i> (kode/golongan salah) atau <i>perlu koreksi</i> (nilai/tanggal salah).</li>
          <li>Catat barang yang ada di ruangan tetapi belum tercatat.</li>
          <li>Klik <Btn>Selesaikan</Btn>. Kondisi diperbarui, barang tidak ditemukan berstatus <i>hilang</i>, dan berita acara bisa dicetak.</li>
          <li>Tindak lanjuti temuan dari halaman barang (tombol Reklasifikasi/Koreksi, lalu pilih temuannya). Barang hilang diusulkan penghapusan; barang belum tercatat dicatat sebagai aset baru dengan cara perolehan <i>hasil inventarisasi</i>.</li>
        </Steps>
        <H2>Flowchart</H2>
        <FlowBlock id="audit" compact />
      </>
    ),
  },
  {
    slug: "penghapusan",
    title: "Penghapusan & pemindahtanganan",
    summary: "Usulan penghapusan ke Dinas/BPKAD, tindak lanjut pemusnahan atau pemindahtanganan, dan pencatatan SK.",
    who: "Petugas, Kepala Sekolah",
    flow: "penghapusan",
    body: () => (
      <>
        <Steps>
          <li>Petugas membuka <Go href="/audit/penghapusan/baru">Usulan penghapusan baru</Go> dan memilih barang. Tombol <Btn>+ Semua yang rusak berat</Btn> dan <Btn>+ Semua yang berstatus hilang</Btn> mempercepat pemilihan.</li>
          <li>Isi alasan per barang. Untuk rusak berat/usang, pilih tindak lanjut <b>pemusnahan</b> atau <b>pemindahtanganan</b> beserta bentuknya (penjualan, tukar menukar, hibah, penyertaan modal). Untuk kecurian, wajib diisi nomor surat keterangan kepolisian.</li>
          <li>Kepala Sekolah mengajukan usulan. Status barang menjadi <i>diusulkan hapus</i> sehingga tidak bisa dipinjam atau dipindah.</li>
          <li>Cetak surat usulan & daftar barang, serta RKBMD rencana penghapusan (A.5) dan RKBMD rencana pemindahtanganan (A.3), lalu kirim ke Dinas/BPKAD dan catat pengirimannya.</li>
          <li>Setelah SK Kepala Daerah terbit, klik <Btn>Catat SK</Btn>: isi nomor dan tanggal, unggah SK, lalu centang barang yang disetujui. Barang yang disetujui dihapus dari daftar barang; yang tidak disetujui dipulihkan statusnya.</li>
        </Steps>
        <Tip>Barang tidak pernah benar-benar dihapus dari basis data. Barang yang dihapus tetap ada di riwayat dan tidak lagi muncul di KIR/KIB.</Tip>
        <H2>Flowchart</H2>
        <FlowBlock id="penghapusan" compact />
      </>
    ),
  },
  {
    slug: "kdp",
    title: "KDP & renovasi",
    summary: "Konstruksi dalam pengerjaan (KIB F), aset tetap renovasi, pembayaran termin, BAST, reklasifikasi otomatis.",
    who: "Petugas",
    flow: "kdp",
    body: () => (
      <>
        <P><b>KDP</b> (Konstruksi Dalam Pengerjaan) adalah aset yang sedang dibangun dan belum selesai, misalnya pembangunan ruang kelas baru. <b>Aset tetap renovasi</b> adalah renovasi atas aset milik pihak lain yang dipakai sekolah, misalnya gedung milik Dinas.</P>
        <Steps>
          <li>Di <Go href="/aset/kdp">KDP & renovasi</Go> klik <Btn>+ Catat KDP</Btn> atau <Btn>+ Catat renovasi aset pihak lain</Btn>. Pilih kode (tanah/peralatan/gedung/jalan/aset lainnya dalam pengerjaan), lalu isi nama pekerjaan, lokasi, kontrak/SPK, penyedia, nilai kontrak, dan sumber dana. Untuk renovasi, isi juga pemilik asetnya.</li>
          <li>Setiap ada pembayaran (termin, uang muka, biaya perencanaan/pengawasan), catat lewat <Btn>Simpan pembayaran</Btn>. Nilai KDP sama dengan jumlah pembayaran.</li>
          <li>Perbarui progres fisik dan target selesai secara berkala. Pekerjaan yang melewati target diingatkan setiap Senin.</li>
          <li>Bila pekerjaan dihentikan, klik <Btn>Hentikan</Btn> dengan alasan; bisa <Btn>Lanjutkan pekerjaan</Btn> lagi.</li>
          <li>Saat selesai, isi tanggal dan nomor BAST lalu klik <Btn>Tandai selesai</Btn>. KDP dipindahkan (direklasifikasi) ke kode aset definitif yang Anda pilih, misalnya gedung di KIB C, dengan nilai seluruh pembayaran, dan bisa langsung ditempatkan di ruangan. Untuk renovasi, tetapkan tindak lanjutnya (diusulkan pemindahtanganan atau pengalihan status penggunaan).</li>
        </Steps>
        <P>KDP yang belum selesai muncul di <Go href="/laporan/kib?gol=F">KIB F</Go>, laporan C.21, dan C.25.</P>
        <H2>Flowchart</H2>
        <FlowBlock id="kdp" compact />
      </>
    ),
  },
  {
    slug: "pemanfaatan",
    title: "Pemanfaatan BMD",
    summary: "Sewa, pinjam pakai, BGS/BSG, KSP, KSPI, penggunaan sementara, dan BMD yang dioperasikan pihak lain.",
    who: "Petugas",
    flow: "pemanfaatan",
    body: () => (
      <>
        <P>Contoh: ruang kantin dipinjampakaikan ke koperasi, lahan disewa untuk menara telekomunikasi, atau ruang dipakai sementara oleh instansi lain. Pemanfaatan BMD memerlukan persetujuan Pengelola Barang/Kepala Daerah.</P>
        <Steps>
          <li>Di <Go href="/aset/pemanfaatan">Pemanfaatan</Go> klik <Btn>+ Catat rencana / pemanfaatan</Btn>. Pilih jenis dan bentuk, tahun RKBMD, mitra, peruntukan, rencana jangka waktu, nilai kontribusi/sewa, dan barang (boleh beberapa, dengan bagian/luas yang dimanfaatkan).</li>
          <li>Rencana masuk ke <b>RKBMD Pemanfaatan (A.1)</b>. Setelah persetujuan terbit, klik <Btn>Catat disetujui</Btn> dan isi nomor serta tanggalnya.</li>
          <li>Saat perjanjian ditandatangani, klik <Btn>Mulai</Btn>: isi mitra, nomor perjanjian, tanggal mulai/berakhir, dan kontribusi.</li>
          <li>Aplikasi mengingatkan 30 hari, 7 hari, dan pada hari perjanjian berakhir. Klik <Btn>Tandai selesai</Btn> ketika berakhir.</li>
          <li>Pemanfaatan yang sudah berjalan sebelum memakai aplikasi bisa dicatat dengan mencentang <i>Sudah berjalan</i>. Bila tidak ada nomor persetujuan, statusnya tercatat <b>tanpa persetujuan</b> dan masuk laporan C.11, sehingga perlu segera diurus.</li>
        </Steps>
        <Tip>Satu barang hanya boleh ada di satu pemanfaatan aktif. Unggah surat persetujuan, perjanjian, dan bukti setor di lampiran.</Tip>
        <H2>Flowchart</H2>
        <FlowBlock id="pemanfaatan" compact />
      </>
    ),
  },
  {
    slug: "laporan",
    title: "Laporan, cetak & tutup buku",
    summary: "KIR, KIB, mutasi, buku persediaan, format Permendagri 7/2024, ekspor Excel, kertas A4/F4, tutup buku.",
    who: "Petugas, Kepala Sekolah, Verifikator, Admin",
    flow: "laporan",
    body: () => (
      <>
        <Table
          head={["Laporan", "Isi", "Buka"]}
          rows={[
            ["KIR", "Barang per ruangan per semester, kondisi B/RR/RB", <Go key="1" href="/laporan/kir">KIR</Go>],
            ["KIB A–F", "Aset per golongan (tanah, peralatan & mesin, gedung, jaringan, aset tetap lainnya, KDP)", <Go key="2" href="/laporan/kib?gol=B">KIB</Go>],
            ["Mutasi persediaan", "Saldo awal, masuk, keluar, saldo akhir per NUSP & gudang", <Go key="3" href="/laporan/mutasi">Mutasi</Go>],
            ["Buku persediaan", "Kartu penerimaan & pengeluaran per bulan/semester", <Go key="4" href="/laporan/buku">Buku</Go>],
            ["Permendagri 7/2024", "RKBMD A.1/A.3/A.5, daftar dokumen kepemilikan B.1/B.2, pemantauan C.3–C.29", <Go key="5" href="/laporan/permendagri-7-2024">Buka</Go>],
          ]}
        />
        <H2>Format Permendagri 7/2024 yang tersedia</H2>
        <List>
          <li><b>A.1</b> RKBMD pemanfaatan · <b>A.3</b> RKBMD pemindahtanganan · <b>A.5</b> RKBMD penghapusan (A.3 dan A.5 dicetak dari halaman usulan penghapusan).</li>
          <li><b>B.1/B.2</b> daftar dokumen kepemilikan (sertifikat, BPKB, dokumen gedung).</li>
          <li><b>C.3</b> tidak digunakan untuk tusi · <b>C.5</b> penggunaan sementara · <b>C.7</b> dioperasikan pihak lain · <b>C.9</b> pemanfaatan · <b>C.11</b> pemanfaatan tanpa persetujuan · <b>C.13</b> pemindahtanganan · <b>C.21</b> KDP · <b>C.23</b> rusak berat/usang · <b>C.25</b> aset tetap renovasi · <b>C.27</b> reklasifikasi · <b>C.29</b> koreksi.</li>
        </List>
        <H2>Cetak & unduh</H2>
        <List>
          <li>Halaman cetak terbuka di tab baru. Pilih ukuran kertas <b>A4</b> atau <b>F4</b> di bilah atas, lalu klik <Btn>Cetak / Simpan PDF</Btn>. Untuk PDF, pilih tujuan <i>Simpan sebagai PDF</i>.</li>
          <li>KIR, KIB, dan mutasi bisa diunduh sebagai Excel (<Btn>Unduh Excel</Btn>) atau CSV.</li>
          <li>Kop, logo, dan tanda tangan diambil dari <Go href="/pengaturan/profil">Profil & kop dokumen</Go>.</li>
        </List>
        <H2>Tutup buku</H2>
        <P>Setelah laporan semester dicetak dan diserahkan, Admin atau Kepala Sekolah menutup periode di <Go href="/pengaturan/tutup-buku">Tutup buku</Go>. Transaksi bertanggal pada periode yang sudah ditutup tidak bisa ditambah atau dibatalkan, sehingga laporan yang sudah diserahkan tidak berubah.</P>
        <H2>Flowchart</H2>
        <FlowBlock id="laporan" compact />
      </>
    ),
  },
  {
    slug: "impor",
    title: "Impor Excel",
    summary: "Memasukkan data lama: ruangan, pengguna, aset (KIB/KIR lama), barang persediaan + saldo awal.",
    who: "Admin, Petugas",
    body: () => (
      <>
        <Steps>
          <li>Buka <Go href="/impor">Impor Excel</Go> dan pilih jenis data: <b>Ruangan</b>, <b>Pengguna</b>, <b>Aset tetap (KIB/KIR lama)</b>, atau <b>Barang persediaan + saldo awal</b>.</li>
          <li>Unduh templat, isi sesuai kolom (keterangan dan contoh ada di baris judul), lalu unggah kembali.</li>
          <li>Periksa <b>pratinjau</b>. Baris yang bermasalah diberi pesan galat per kolom; perbaiki di Excel lalu unggah ulang.</li>
          <li>Klik proses bila semua baris sudah benar. Hasilnya langsung terlihat di menu terkait.</li>
        </Steps>
        <Tip>Impor ruangan dan pengguna sebelum aset, karena nama ruangan di file aset harus sudah ada. Untuk aset, nomor register lama bisa dipertahankan agar sama dengan register Dinas.</Tip>
      </>
    ),
  },
  {
    slug: "istilah",
    title: "Istilah & tanya jawab",
    summary: "Glosarium BMD dan jawaban atas pertanyaan yang sering muncul.",
    who: "Semua pengguna",
    body: () => (
      <>
        <H2>Istilah</H2>
        <Table
          head={["Istilah", "Arti"]}
          rows={[
            ["BMD", "Barang Milik Daerah: semua barang yang dibeli atas beban APBD atau perolehan lain yang sah"],
            ["Kuasa Pengguna Barang", "Kepala sekolah selaku pejabat yang menggunakan BMD di sekolah"],
            ["Pengurus Barang Pembantu", "Petugas yang mengurus administrasi barang di sekolah"],
            ["Persediaan", "Barang habis pakai (ATK, bahan praktik, dsb.)"],
            ["NUSP", "Nomor Urut Satuan Persediaan: kode barang persediaan"],
            ["FIFO", "Metode nilai persediaan: yang masuk pertama dikeluarkan pertama"],
            ["Intrakomptabel", "Aset yang harganya ≥ batas kapitalisasi; masuk neraca Pemda"],
            ["Ekstrakomptabel", "Aset di bawah batas kapitalisasi; tetap dicatat dan diawasi, tetapi tidak masuk neraca"],
            ["KIB / KIR", "Kartu Inventaris Barang (per golongan) / Kartu Inventaris Ruangan"],
            ["KDP", "Konstruksi Dalam Pengerjaan (KIB F)"],
            ["SPPB", "Surat Perintah Penyaluran Barang"],
            ["BAST", "Berita Acara Serah Terima"],
            ["RKBMD", "Rencana Kebutuhan Barang Milik Daerah"],
            ["LHI", "Laporan Hasil Inventarisasi"],
            ["Reklasifikasi", "Pemindahan barang ke kode/golongan lain atau perubahan intra/ekstrakomptabel"],
            ["Pemanfaatan", "Pendayagunaan BMD oleh pihak lain tanpa mengubah kepemilikan (sewa, pinjam pakai, dll.)"],
            ["Pemindahtanganan", "Pengalihan kepemilikan BMD: penjualan, tukar menukar, hibah, penyertaan modal"],
          ]}
        />
        <H2>Tanya jawab</H2>
        <H3>Saya salah memasukkan dokumen persediaan yang sudah diposting.</H3>
        <P>Buka dokumennya lalu klik <Btn>Batalkan dokumen…</Btn> dan isi alasannya. Setelah itu buat dokumen baru yang benar. Bila periodenya sudah ditutup buku, minta Admin/Kepala Sekolah membuka periode lebih dulu.</P>
        <H3>Harga aset salah ketik.</H3>
        <P>Buka barangnya lalu klik <Btn>Koreksi nilai/tanggal</Btn>. Nilai lama dan baru tercatat di riwayat. Untuk nama, merk, ruangan, dan atribut lain cukup <Btn>Ubah data barang</Btn>.</P>
        <H3>Kode register bertanda SEMENTARA.</H3>
        <P>Admin belum mengisi kode Pengguna/Kuasa Pengguna Barang di <Go href="/pengaturan/kode-bmd">Kode BMD</Go>. Setelah diisi, kode lengkap tampil otomatis dan label bisa dicetak ulang.</P>
        <H3>Tombol setujui tidak muncul.</H3>
        <P>Tombol hanya muncul untuk peran yang sedang ditunggu (lihat status “menunggu …” di halaman tersebut). Periksa peran Anda di <Go href="/panduan/peran">Peran & hak akses</Go>.</P>
        <H3>Gudang tidak bisa dipakai untuk penyaluran.</H3>
        <P>Gudang sedang dalam stock opname dan dibekukan. Selesaikan atau setujui opnamenya terlebih dahulu.</P>
        <H3>Kamera tidak menyala saat memindai.</H3>
        <P>Izinkan akses kamera untuk situs ini di pengaturan peramban. Pemindaian membutuhkan alamat https.</P>
      </>
    ),
  },
];

export const topicBySlug = (slug: string) => TOPICS.find((t) => t.slug === slug);
