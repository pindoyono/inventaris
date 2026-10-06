# Data Rujukan

Data di folder ini menjadi *seed* aplikasi. Semua berasal dari regulasi resmi; jangan diedit manual tanpa mencatat sumbernya.

## bmd/kode-barang-permendagri-108-2016.json

Kodefikasi barang milik daerah 7 tingkat (Akun.Kelompok.Jenis.Objek.Rincian Objek.Sub Rincian Objek.Sub-sub Rincian Objek).
Format kode: tingkat 1–3 satu digit, tingkat 4–6 dua digit, tingkat 7 tiga digit — mis. `1.3.2.05.01.05.043` (LCD Projector/Infocus).

| Bagian | Sumber | Verifikasi |
|---|---|---|
| Aset Tetap (1.3.x) & Aset Lainnya (1.5.x) | Lampiran Excel "kode Permendagri Nomor 108 Tahun 2016 Lampiran 2" (BPKAD) | 13.064 kode tingkat 7 dicocokkan ke teks PDF resmi Berita Negara 2016 No. 2083; seluruh kode di PDF ada di data ini. 3 kode yang tidak terbaca dari teks PDF diperiksa manual (urutan berurutan di halaman resmi). |
| Persediaan (1.1.7) | PDF resmi Berita Negara 2016 No. 2083, Tabel 2.6 hlm. 95–113 | Disalin manual dari gambar halaman (lapisan teks PDF hasil OCR berisi salah ketik); 336 kode + 66 penanda "Dst" = 402, cocok penuh dengan PDF. |

Kolom tambahan:
- `golongan`: `PERSEDIAAN`, `A`–`F` (KIB), `ATB` (aset tidak berwujud); `null` untuk induk/akumulasi.
- `bisa_dipilih`: kode tingkat ≥ 6 pada golongan di atas, kecuali akumulasi penyusutan/amortisasi, kemitraan, dan aset lain-lain.

Catatan regulasi:
- Entri "Dst…." (dan seterusnya) **dibuang**; artinya daftar tingkat 7 sengaja terbuka. Penambahan kode tingkat 7 dilakukan dengan keputusan kepala daerah (Pasal 3 ayat 2) → aplikasi mendukung *kode lokal Pemda*.
- `bmd/kode-ganda-di-regulasi.json`: 16 baris di 4 kelompok (1.3.2.05.03.04–07, perabot ruang pejabat) yang di regulasinya memakai kode yang sama untuk barang berbeda. Yang dipakai adalah entri pertama tiap kode.
- Contoh kode register di regulasi (Contoh 3, SMPN kabupaten) memakai status kepemilikan `11`, padahal penjelasannya menyebut kab/kota = `12`. Aplikasi mengikuti penjelasan tertulis (11 provinsi, 12 kab/kota).

## bos/sumber-dana-bosp-2026.json

Sumber dana & komponen penggunaan Dana BOS (Reguler/Kinerja/Afirmasi) dari Permendikdasmen No. 8 Tahun 2026 Pasal 42–46, untuk pilihan sumber dana & komponen pada pengadaan.
