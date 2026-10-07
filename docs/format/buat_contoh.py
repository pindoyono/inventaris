"""Membuat contoh format cetak (HTML) dengan data contoh, untuk disetujui sebelum modul dibangun.

Jalankan: python3 buat_contoh.py  → menulis *.html di folder ini.
Struktur HTML/CSS ini akan dipindahkan menjadi komponen cetak di aplikasi.
"""
from html import escape as e
from pathlib import Path

DIR = Path(__file__).parent

SEKOLAH = {
    "pemda": "PEMERINTAH PROVINSI KALIMANTAN UTARA",
    "dinas": "DINAS PENDIDIKAN DAN KEBUDAYAAN",
    "nama": "SMK NEGERI 2 MALINAU",
    "alamat": "Jl. Contoh Alamat Sekolah No. 1, Malinau, Kalimantan Utara · NPSN 30402834",
    "kota": "Malinau",
    "kode_lokasi": "11.01.65.00.010101.00103.00000",
    "kepsek": ("NAMA KEPALA SEKOLAH, S.Pd., M.Pd.", "19700101 199503 1 001"),
    "pengurus": ("NAMA PENGURUS BARANG, S.Kom.", "19850202 201001 1 002"),
}


def rp(n):
    return f"{n:,.0f}".replace(",", ".")


def kop():
    s = SEKOLAH
    return f"""
<div class="kop">
  <div class="logo">LOGO<br>PEMDA</div>
  <div>
    <div class="pemda">{e(s['pemda'])}</div>
    <div class="dinas">{e(s['dinas'])}</div>
    <div class="sekolah">{e(s['nama'])}</div>
    <div class="alamat">{e(s['alamat'])}</div>
  </div>
  <div class="logo">LOGO<br>SEKOLAH</div>
</div>"""


def identitas(baris):
    isi = "".join(f"<tr><td>{e(a)}</td><td>:</td><td>{b}</td></tr>" for a, b in baris)
    return f'<table class="identitas">{isi}</table>'


def ttd(kolom, tanggal="30 Juni 2026", kota_di=-1):
    """kolom: [(jabatan, (nama, nip))]; tempat & tanggal tampil di kolom kota_di (None = tidak ditampilkan)."""
    sel = []
    for i, (jabatan, (nama, nip)) in enumerate(kolom):
        tampil = "tampil" if kota_di is not None and i == (kota_di % len(kolom)) else ""
        sel.append(f"""<div>
  <div class="tempat {tampil}">{e(SEKOLAH['kota'])}, {e(tanggal)}</div>
  <div>{jabatan}</div><div class="ruang"></div>
  <div class="nama">{e(nama)}</div><div>NIP. {e(nip)}</div></div>""")
    kelas = {1: "satu", 2: "dua", 3: "tiga"}.get(len(kolom), "dua")
    return f'<div class="ttd {kelas}">{"".join(sel)}</div>'


KEPSEK = ("Mengetahui,<br>Kepala Sekolah<br>selaku Kuasa Pengguna Barang", SEKOLAH["kepsek"])
PENGURUS = ("Pengurus Barang Pembantu", SEKOLAH["pengurus"])


def halaman(judul_file, orientasi, isi, keterangan, kelas=""):
    return f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(judul_file)} — Contoh Format</title>
<link rel="stylesheet" href="cetak.css"></head>
<body>
<div class="bilah tanpa-cetak">
  <a href="index.html">← Semua format</a>
  <strong>{e(judul_file)}</strong>
  <span class="ket">{e(keterangan)}</span>
  <button onclick="window.print()">Cetak / Simpan PDF</button>
</div>
<div class="halaman a4-{orientasi} {kelas}">{isi}</div>
</body></html>"""


def tabel(kepala_html, baris, n_kolom, jumlah=None):
    body = "".join("<tr>" + "".join(c for c in r) + "</tr>" for r in baris)
    nomor = "<tr class='nomor-kolom'>" + "".join(f"<th>{i}</th>" for i in range(1, n_kolom + 1)) + "</tr>"
    return f'<table class="data"><thead>{kepala_html}{nomor}</thead><tbody>{body}{jumlah or ""}</tbody></table>'


td = lambda v, k="": f'<td class="{k}">{v}</td>'

# ---------------------------------------------------------------- data contoh persediaan
PERSEDIAAN = [
    # nusp, nama spesifikasi, satuan, qty, harga
    ("1.1.7.01.03.02.001.0001", "Kertas HVS A4 70 gram", "rim", 20, 52_000),
    ("1.1.7.01.03.01.001.0002", "Pulpen hitam 0,5 mm", "kotak", 10, 24_000),
    ("1.1.7.01.03.06.004.0001", "Tinta printer hitam 70 ml", "botol", 12, 95_000),
    ("1.1.7.01.03.07.008.0001", "Cairan pembersih lantai 800 ml", "botol", 15, 18_500),
]


def kartu_penerimaan():
    kepala = """<tr><th rowspan="2">No</th><th rowspan="2">Tanggal<br>Terima</th><th rowspan="2">Dari / Penyedia</th>
<th colspan="2">Dokumen Sumber</th><th rowspan="2">NUSP</th><th rowspan="2">Nama / Spesifikasi Barang</th>
<th rowspan="2">Jumlah</th><th rowspan="2">Satuan</th><th rowspan="2">Harga Satuan<br>(Rp)</th><th rowspan="2">Jumlah Harga<br>(Rp)</th>
<th rowspan="2">Sumber Dana</th><th rowspan="2">Gudang</th></tr>
<tr><th>Nomor</th><th>Tanggal</th></tr>"""
    baris, total = [], 0
    for i, (nusp, nama, sat, qty, h) in enumerate(PERSEDIAAN, 1):
        total += qty * h
        baris.append([td(i, "tengah"), td("05-01-2026", "tengah"), td("CV Contoh Sejahtera", "unit"), td("INV/0126/015", "tengah"),
                      td("05-01-2026", "tengah"), td(nusp, "kode"), td(e(nama), "nama"), td(qty, "angka"), td(sat, "tengah"),
                      td(rp(h), "angka"), td(rp(qty * h), "angka"), td("BOS Reguler", "tengah"), td("Gudang Utama", "tengah")])
    jumlah = f"<tr class='jumlah'><td colspan='10' class='angka'>JUMLAH</td><td class='angka'>{rp(total)}</td><td colspan='2'></td></tr>"
    isi = kop() + """<div class="judul"><h1>Kartu Penerimaan Barang Persediaan</h1>
<div class="nomor">(Buku Penerimaan Persediaan) · Nomor: KP/2026/0001</div></div>""" + identitas([
        ("Kode Lokasi", SEKOLAH["kode_lokasi"]),
        ("Periode", "Januari 2026"),
        ("Cara Perolehan", "Pembelian (pengadaan)"),
    ]) + tabel(kepala, baris, 13, jumlah) + ttd([KEPSEK, PENGURUS])
    return halaman("Kartu Penerimaan", "lanskap", isi, "Format II.I.3 — rekap penerimaan persediaan")


def kartu_pengeluaran():
    kepala = """<tr><th rowspan="2">No</th><th rowspan="2">Tanggal<br>Keluar</th><th colspan="2">Dokumen</th>
<th rowspan="2">Unit / Penerima</th><th rowspan="2">NUSP</th><th rowspan="2">Nama / Spesifikasi Barang</th>
<th rowspan="2">Jumlah</th><th rowspan="2">Satuan</th><th rowspan="2">Harga Satuan<br>(Rp, FIFO)</th><th rowspan="2">Jumlah Harga<br>(Rp)</th>
<th rowspan="2">Untuk Keperluan</th></tr><tr><th>No. SPPB</th><th>No. BAST</th></tr>"""
    keluar = [(0, 5, "Tata Usaha"), (1, 2, "Prog. Keahlian TKJ"), (2, 3, "Prog. Keahlian TKJ"), (3, 6, "Kebersihan")]
    baris, total = [], 0
    for i, (k, qty, unit) in enumerate(keluar, 1):
        nusp, nama, sat, _, h = PERSEDIAAN[k]
        total += qty * h
        baris.append([td(i, "tengah"), td("12-01-2026", "tengah"), td(f"SPPB/2026/000{i}", "tengah"), td(f"BAST/2026/000{i}", "tengah"),
                      td(unit, "unit"), td(nusp, "kode"), td(e(nama), "nama"), td(qty, "angka"), td(sat, "tengah"), td(rp(h), "angka"),
                      td(rp(qty * h), "angka"), td("Administrasi & pembelajaran", "unit")])
    jumlah = f"<tr class='jumlah'><td colspan='10' class='angka'>JUMLAH</td><td class='angka'>{rp(total)}</td><td></td></tr>"
    isi = kop() + """<div class="judul"><h1>Kartu Pengeluaran Barang Persediaan</h1>
<div class="nomor">(Buku Pengeluaran / Penyaluran Persediaan) · Nomor: KK/2026/0001</div></div>""" + identitas([
        ("Kode Lokasi", SEKOLAH["kode_lokasi"]), ("Gudang", "Gudang Utama"), ("Periode", "Januari 2026")]) \
        + tabel(kepala, baris, 12, jumlah) + ttd([KEPSEK, PENGURUS])
    return halaman("Kartu Pengeluaran", "lanskap", isi, "Format II.I.4 & II.I.10 — nilai keluar dihitung FIFO")


def bast():
    kepala = """<tr><th>No</th><th>NUSP</th><th>Nama / Spesifikasi Barang</th><th>Jumlah</th><th>Satuan</th><th>Keterangan</th></tr>"""
    nusp, nama, sat, _, _ = PERSEDIAAN[0]
    n2, nm2, s2, _, _ = PERSEDIAAN[1]
    baris = [[td(1, "tengah"), td(nusp, "kode"), td(nama), td(5, "angka"), td(sat, "tengah"), td("Baik")],
             [td(2, "tengah"), td(n2, "kode"), td(nm2), td(1, "angka"), td(s2, "tengah"), td("Baik")]]
    isi = kop() + """<div class="judul"><h1>Berita Acara Serah Terima</h1>
<div class="nomor">Nomor: BAST/2026/0001</div></div>
<p class="paragraf">Pada hari ini <b>Senin</b> tanggal <b>dua belas</b> bulan <b>Januari</b> tahun <b>dua ribu dua puluh enam</b>,
yang bertanda tangan di bawah ini:</p>""" + identitas([
        ("1. Nama", f"{SEKOLAH['pengurus'][0]} (NIP. {SEKOLAH['pengurus'][1]})"),
        ("    Jabatan", "Pengurus Barang Pembantu — selanjutnya disebut <b>PIHAK PERTAMA</b>"),
        ("2. Nama", "NAMA PENERIMA, S.Pd. (NIP. 19900303 201502 2 003)"),
        ("    Jabatan", "Staf Tata Usaha — selanjutnya disebut <b>PIHAK KEDUA</b>"),
    ]) + """<p class="paragraf">Berdasarkan Surat Perintah Penyaluran Barang Nomor SPPB/2026/0001 tanggal 12 Januari 2026,
PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA barang persediaan sebagai berikut:</p>""" + tabel(kepala, baris, 6) + \
        """<p class="paragraf" style="margin-top:3mm">Barang tersebut telah diterima PIHAK KEDUA dalam keadaan baik dan lengkap
untuk dipergunakan sebagaimana mestinya.</p>""" + ttd([
            ("PIHAK KEDUA<br>Yang Menerima", ("NAMA PENERIMA, S.Pd.", "19900303 201502 2 003")),
            ("PIHAK PERTAMA<br>Yang Menyerahkan", SEKOLAH["pengurus"])], tanggal="12 Januari 2026") + \
        ttd([KEPSEK], kota_di=None)
    return halaman("Berita Acara Serah Terima", "potret", isi, "Format II.I.9 — penyaluran persediaan")


def kartu_barang_persediaan():
    kepala = """<tr><th rowspan="2">No</th><th rowspan="2">Tanggal</th><th rowspan="2">No. Dokumen</th><th rowspan="2">Uraian</th>
<th colspan="3">Masuk</th><th colspan="3">Keluar</th><th colspan="2">Saldo</th></tr>
<tr><th>Jml</th><th>Harga</th><th>Jumlah (Rp)</th><th>Jml</th><th>Harga</th><th>Jumlah (Rp)</th><th>Jml</th><th>Jumlah (Rp)</th></tr>"""
    mut = [  # tanggal, dok, uraian, masuk(qty,harga), keluar(qty,harga)
        ("01-01-2026", "SA/2026/0001", "Saldo awal", (8, 50_000), None),
        ("05-01-2026", "KP/2026/0001", "Penerimaan dari CV Contoh Sejahtera", (20, 52_000), None),
        ("12-01-2026", "BAST/2026/0001", "Penyaluran ke Tata Usaha", None, (5, 50_000)),
        ("20-01-2026", "BAST/2026/0005", "Penyaluran ke Prog. Keahlian TKJ", None, [(3, 50_000), (4, 52_000)]),
    ]
    baris, sq, sv = [], 0, 0
    for i, (tgl, dok, ur, m, k) in enumerate(mut, 1):
        cells = [td(i, "tengah"), td(tgl, "tengah"), td(dok, "tengah"), td(ur)]
        if m:
            sq += m[0]; sv += m[0] * m[1]
            cells += [td(m[0], "angka"), td(rp(m[1]), "angka"), td(rp(m[0] * m[1]), "angka"), td(""), td(""), td("")]
        else:
            lots = k if isinstance(k, list) else [k]
            q = sum(a for a, _ in lots); v = sum(a * b for a, b in lots)
            sq -= q; sv -= v
            harga = "<br>".join(f"{a}×{rp(b)}" for a, b in lots) if len(lots) > 1 else rp(lots[0][1])
            cells += [td(""), td(""), td(""), td(q, "angka"), td(harga, "angka"), td(rp(v), "angka")]
        cells += [td(sq, "angka"), td(rp(sv), "angka")]
        baris.append(cells)
    isi = kop() + """<div class="judul"><h1>Kartu Barang Persediaan</h1><div class="nomor">(Kartu Stok)</div></div>""" + identitas([
        ("Kode Lokasi", SEKOLAH["kode_lokasi"]), ("Gudang", "Gudang Utama"),
        ("NUSP", "<span style='font-family:monospace'>1.1.7.01.03.02.001.0001</span>"),
        ("Kode Barang", "1.1.7.01.03.02.001 — Kertas HVS"),
        ("Nama / Spesifikasi", "Kertas HVS A4 70 gram"), ("Satuan", "rim"),
        ("Metode Penilaian", "FIFO (masuk pertama keluar pertama)"), ("Periode", "Semester I Tahun 2026")]) \
        + tabel(kepala, baris, 12) + \
        '<p class="catatan">Nilai keluar dihitung per batch FIFO — '\
        'baris ke-4 mengambil 3 rim dari saldo awal (Rp50.000) dan 4 rim dari penerimaan 5 Januari (Rp52.000).</p>' \
        + ttd([KEPSEK, PENGURUS])
    return halaman("Kartu Barang Persediaan", "potret", isi, "Format II.I.5 — per NUSP per gudang, FIFO", "rapat")


def kartu_peminjaman():
    kepala = """<tr><th rowspan="2">No</th><th rowspan="2">Kode Barang / No. Register</th><th rowspan="2">Nama / Merk / Tipe</th>
<th colspan="2">Kondisi</th><th rowspan="2">Tgl<br>Kembali</th><th rowspan="2">Paraf<br>Petugas</th></tr><tr><th>Pinjam</th><th>Kembali</th></tr>"""
    baris = [
        [td(1, "tengah"), td("1.3.2.10.01.02.002<br>000014", "kode"), td("Laptop · Lenovo ThinkPad E14"), td("Baik", "tengah"), td("Baik", "tengah"), td("14-01-2026", "tengah"), td("")],
        [td(2, "tengah"), td("1.3.2.05.01.05.043<br>000003", "kode"), td("LCD Projector · Epson EB-X51"), td("Baik", "tengah"), td("Rusak ringan", "tengah"), td("14-01-2026", "tengah"), td("")],
    ]
    isi = kop() + """<div class="judul"><h1>Kartu Peminjaman Barang</h1><div class="nomor">Nomor: PJ/2026/0007</div></div>""" + identitas([
        ("Nama Peminjam", "NAMA SISWA CONTOH"), ("Kelas / NIS", "XI TKJ 1 / 2324101"), ("Keperluan", "Presentasi tugas praktik jaringan"),
        ("Tanggal Pinjam", "13 Januari 2026, 07.30"), ("Batas Pengembalian", "14 Januari 2026, 15.00")]) \
        + tabel(kepala, baris, 7) + \
        '<p class="catatan">Peminjam bertanggung jawab atas kerusakan atau kehilangan barang selama masa peminjaman. ' \
        'Catatan pengembalian no. 2: lensa tergores — diteruskan ke pemeliharaan.</p>' + ttd([
            ("Peminjam", ("NAMA SISWA CONTOH", "-")), ("Petugas Barang", SEKOLAH["pengurus"])], tanggal="13 Januari 2026")
    return halaman("Kartu Peminjaman", "potret", isi, "Dokumen internal sekolah — peminjaman alat")


ASET_RUANG = [
    ("1.3.2.10.01.02.001", "000021", "P.C Unit", "Lenovo ThinkCentre M70s", "2024", 24, 9_850_000, "Baik"),
    ("1.3.2.05.01.05.043", "000003", "LCD Projector/Infocus", "Epson EB-X51", "2023", 1, 6_250_000, "Rusak Ringan"),
    ("1.3.2.05.02.01.002", "000041", "Meja Kerja Kayu", "Lokal / kayu", "2019", 25, 650_000, "Baik"),
    ("1.3.2.05.02.01.004", "000088", "Kursi Kayu", "Lokal / kayu", "2019", 25, 350_000, "Baik"),
    ("1.3.2.05.01.05.078", "000006", "Papan Tulis", "Whiteboard 120×240", "2022", 1, 1_200_000, "Baik"),
]


def kir():
    kepala = """<tr><th rowspan="2">No</th><th rowspan="2">Kode Barang</th><th rowspan="2">Nomor<br>Register</th><th rowspan="2">Nama Barang</th>
<th rowspan="2">Merk / Tipe</th><th rowspan="2">Tahun<br>Perolehan</th><th rowspan="2">Jumlah</th><th rowspan="2">Harga Perolehan<br>(Rp)</th>
<th colspan="3">Kondisi</th><th rowspan="2">Keterangan</th></tr><tr><th>B</th><th>RR</th><th>RB</th></tr>"""
    baris = []
    for i, (kode, reg, nama, merk, th, jml, h, kond) in enumerate(ASET_RUANG, 1):
        b, rr, rb = (jml, "", "") if kond == "Baik" else ("", jml, "") if kond == "Rusak Ringan" else ("", "", jml)
        baris.append([td(i, "tengah"), td(kode, "kode"), td(reg if jml == 1 else f"{reg} s/d {int(reg)+jml-1:06d}", "kode"), td(nama),
                      td(e(merk)), td(th, "tengah"), td(jml, "angka"), td(rp(h * jml), "angka"), td(b, "tengah"), td(rr, "tengah"), td(rb, "tengah"), td("")])
    isi = kop() + """<div class="judul"><h1>Kartu Inventaris Ruangan (KIR)</h1><div class="nomor">Semester I Tahun 2026</div></div>""" + identitas([
        ("Kode Lokasi", SEKOLAH["kode_lokasi"]), ("Ruangan", "Laboratorium Komputer 1 (Gedung B, Lantai 1)"),
        ("Penanggung Jawab Ruangan", "NAMA KEPALA LAB, S.Kom.")]) + tabel(kepala, baris, 12) + \
        '<p class="catatan">B = Baik, RR = Rusak Ringan, RB = Rusak Berat. KIR dibuat rangkap 2 (ditempel di ruangan dan arsip), ' \
        'diperbarui setiap semester dan setiap ada perpindahan/penambahan barang atau pergantian penanggung jawab ruangan.</p>' + ttd([
            KEPSEK, ("Penanggung Jawab Ruangan", ("NAMA KEPALA LAB, S.Kom.", "19880404 201101 1 004")), PENGURUS])
    return halaman("KIR", "lanskap", isi, "Format II.K.2 — Kartu Inventaris Ruangan")


def kib_b():
    kepala = """<tr><th rowspan="2">No</th><th rowspan="2">Kode Barang</th><th rowspan="2">Jenis Barang /<br>Nama Barang</th><th rowspan="2">Nomor<br>Register</th>
<th rowspan="2">Merk / Type</th><th rowspan="2">Ukuran /<br>CC</th><th rowspan="2">Bahan</th><th rowspan="2">Tahun<br>Pembelian</th>
<th colspan="5">Nomor</th><th rowspan="2">Asal-usul</th><th rowspan="2">Harga<br>(Rp)</th><th rowspan="2">Keterangan</th></tr>
<tr><th>Pabrik</th><th>Rangka</th><th>Mesin</th><th>Polisi</th><th>BPKB</th></tr>"""
    data = ASET_RUANG + [("1.3.2.02.01.04.001", "000001", "Sepeda Motor", "Honda Supra X 125", "2021", 1, 18_500_000, "Baik")]
    baris, total = [], 0
    for i, (kode, reg, nama, merk, th, jml, h, _) in enumerate(data, 1):
        total += h * jml
        motor = nama == "Sepeda Motor"
        baris.append([td(i, "tengah"), td(kode, "kode"), td(nama), td(reg if jml == 1 else f"{reg} s/d {int(reg)+jml-1:06d}", "kode"),
                      td(e(merk)), td("125 cc" if motor else "-", "tengah"), td("Logam" if motor else ("Kayu" if "Kayu" in nama else "Campuran"), "tengah"),
                      td(th, "tengah"), td("-"), td("MH1JB..." if motor else "-"), td("JB91E..." if motor else "-"),
                      td("KU 1234 XX" if motor else "-"), td("P-0123456" if motor else "-"), td("Pembelian"), td(rp(h * jml), "angka"), td("")])
    jumlah = f"<tr class='jumlah'><td colspan='14' class='angka'>JUMLAH</td><td class='angka'>{rp(total)}</td><td></td></tr>"
    isi = kop() + """<div class="judul"><h1>Kartu Inventaris Barang (KIB) B</h1><div class="sub">Peralatan dan Mesin</div></div>""" + identitas([
        ("Provinsi", "Kalimantan Utara"), ("Pengguna Barang", "Dinas Pendidikan dan Kebudayaan"),
        ("Kuasa Pengguna Barang", SEKOLAH["nama"]), ("No. Kode Lokasi", SEKOLAH["kode_lokasi"])]) \
        + tabel(kepala, baris, 16, jumlah) + ttd([KEPSEK, PENGURUS])
    return halaman("KIB B Peralatan dan Mesin", "lanskap", isi, "16 kolom, mengikuti format KIB B yang dipakai Pemda", "rapat")


def nota_permintaan():
    kepala = "<tr><th>No</th><th>Nama / Spesifikasi Barang</th><th>Jumlah</th><th>Satuan</th><th>Untuk Keperluan</th></tr>"
    baris = [[td(1, "tengah"), td("Kertas HVS A4 70 gram"), td(5, "angka"), td("rim", "tengah"), td("Administrasi TU")],
             [td(2, "tengah"), td("Pulpen hitam 0,5 mm"), td(1, "angka"), td("kotak", "tengah"), td("Administrasi TU")]]
    isi = kop() + """<div class="judul"><h1>Nota Permintaan Barang</h1><div class="nomor">Nomor: NP/2026/0001</div></div>""" + identitas([
        ("Kepada", "Pengurus Barang Pembantu"), ("Dari (Unit)", "Tata Usaha"), ("Tanggal", "10 Januari 2026")]) \
        + "<p class='paragraf'>Mohon disediakan barang persediaan sebagai berikut:</p>" + tabel(kepala, baris, 5) + ttd([
            ("Mengetahui,<br>Kepala Tata Usaha", ("NAMA KEPALA TU", "19800505 200501 1 005")),
            ("Yang Meminta", ("NAMA PENERIMA, S.Pd.", "19900303 201502 2 003"))], tanggal="10 Januari 2026")
    return halaman("Nota Permintaan", "potret", isi, "Format II.I.6 — diajukan oleh pihak yang membutuhkan")


def sppb():
    kepala = "<tr><th>No</th><th>NUSP</th><th>Nama / Spesifikasi Barang</th><th>Jumlah</th><th>Satuan</th><th>Diserahkan Kepada</th></tr>"
    baris = [[td(1, "tengah"), td(PERSEDIAAN[0][0], "kode"), td(PERSEDIAAN[0][1]), td(5, "angka"), td("rim", "tengah"), td("Tata Usaha")],
             [td(2, "tengah"), td(PERSEDIAAN[1][0], "kode"), td(PERSEDIAAN[1][1]), td(1, "angka"), td("kotak", "tengah"), td("Tata Usaha")]]
    isi = kop() + """<div class="judul"><h1>Surat Perintah Penyaluran Barang</h1><div class="nomor">Nomor: SPPB/2026/0001</div></div>""" + \
        "<p class='paragraf'>Berdasarkan Surat Permintaan Barang Nomor SPB/2026/0001 tanggal 11 Januari 2026, dengan ini " \
        "memerintahkan Pengurus Barang Pembantu untuk menyalurkan barang persediaan dari <b>Gudang Utama</b> sebagai berikut:</p>" \
        + tabel(kepala, baris, 6) + "<p class='paragraf' style='margin-top:3mm'>Penyaluran dituangkan dalam Berita Acara Serah Terima.</p>" \
        + ttd([("Kepala Sekolah<br>selaku Kuasa Pengguna Barang", SEKOLAH["kepsek"])], tanggal="12 Januari 2026")
    return halaman("Surat Perintah Penyaluran Barang", "potret", isi, "Format II.I.8 — persetujuan penyaluran")


def label_register():
    satu = """<div class="label">
  <div class="qr">{QR_SVG}</div>
  <div class="teks">
    <div class="pemilik">MILIK PEMPROV KALIMANTAN UTARA</div>
    <div class="sek">SMK NEGERI 2 MALINAU</div>
    <div class="reg atas">11.01.65.00.010101.00103.00000.2024</div>
    <div class="reg">1.3.2.10.01.02.002.000014</div>
    <div class="nm">Laptop · Lenovo ThinkPad E14</div>
  </div></div>"""
    # QR contoh (di aplikasi, QR berisi tautan acak ke halaman barang)
    satu = satu.replace("{QR_SVG}", (Path(__file__).parent / "contoh-qr.svg").read_text())
    gaya = """<style>
.label-grid { display: grid; grid-template-columns: repeat(2, 90mm); gap: 4mm 6mm; justify-content: center; }
.label { border: 1px solid #000; border-radius: 2mm; height: 32mm; display: grid; grid-template-columns: 26mm 1fr; gap: 2mm; padding: 2mm; }
.label .qr { display: grid; place-items: center; }
.label .qr svg { width: 100%; height: 100%; }
.label .pemilik { font-size: 6.5pt; font-weight: bold; }
.label .sek { font-size: 8pt; font-weight: bold; margin-bottom: .8mm; }
.label .reg { font-family: "DejaVu Sans Mono", Consolas, monospace; font-size: 7.6pt; text-align: center; }
.label .reg.atas { border-bottom: 1px solid #000; padding-bottom: .4mm; margin-bottom: .4mm; }
.label .nm { font-size: 7.5pt; margin-top: .8mm; }
</style>"""
    isi = gaya + """<div class="judul"><h1>Lembar Label Kode Register</h1>
<div class="nomor">Ukuran label 90 × 32 mm · 2 kolom × 7 baris per A4 (ukuran lain dapat dipilih)</div></div>
<div class="label-grid">""" + satu * 14 + "</div>"
    return halaman("Label Kode Register", "potret", isi, "Permendagri 108/2016 — kode lokasi + tahun (atas), kode barang + nomor register (bawah)")


FORMAT = [
    ("01-kartu-penerimaan.html", "Kartu Penerimaan Barang Persediaan", "Format II.I.3", kartu_penerimaan),
    ("02-kartu-pengeluaran.html", "Kartu Pengeluaran Barang Persediaan", "Format II.I.4 & II.I.10", kartu_pengeluaran),
    ("03-kartu-barang-persediaan.html", "Kartu Barang Persediaan (Kartu Stok)", "Format II.I.5", kartu_barang_persediaan),
    ("04-nota-permintaan.html", "Nota Permintaan Barang", "Format II.I.6", nota_permintaan),
    ("05-sppb.html", "Surat Perintah Penyaluran Barang", "Format II.I.8", sppb),
    ("06-bast.html", "Berita Acara Serah Terima", "Format II.I.9", bast),
    ("07-kartu-peminjaman.html", "Kartu Peminjaman Barang", "Internal sekolah", kartu_peminjaman),
    ("08-kir.html", "Kartu Inventaris Ruangan (KIR)", "Format II.K.2", kir),
    ("09-kib-b.html", "KIB B Peralatan dan Mesin", "Pembukuan BMD", kib_b),
    ("10-label-register.html", "Label Kode Register", "Permendagri 108/2016", label_register),
]


def index():
    items = "".join(f'<li><a href="{f}">{e(n)}</a> <span>— {e(r)}</span></li>' for f, n, r, _ in FORMAT)
    return f"""<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contoh Format Cetak — Inventaris</title>
<style>body{{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#111}}
li{{margin:6px 0}} span{{color:#666}} .info{{background:#f1f5f9;border-radius:8px;padding:12px 16px}}</style></head>
<body><h1>Contoh Format Cetak — Inventaris Sekolah Negeri</h1>
<p class="info">Berisi <b>data contoh</b> untuk persetujuan format. Unsur kolom mengikuti Permendagri 47/2021 (pembukuan persediaan, KIR),
format KIB yang dipakai Pemda, dan kode register Permendagri 108/2016. Kode lokasi, nama, dan NIP adalah contoh.
Buka setiap format lalu klik <b>Cetak / Simpan PDF</b> untuk melihat hasil di kertas.</p>
<ol>{items}</ol></body></html>"""


if __name__ == "__main__":
    for f, _, _, fn in FORMAT:
        (DIR / f).write_text(fn(), encoding="utf-8")
    (DIR / "index.html").write_text(index(), encoding="utf-8")
    print("ditulis:", len(FORMAT) + 1, "berkas")
