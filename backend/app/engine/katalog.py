"""Katalog kalimat komentar.

Setiap temuan punya kode (mis. "judul.jumlah_kata") dan kalimat bawaan berisi variabel $nama.
Profil jurnal boleh mengganti kalimatnya (`Profil.teks_komentar`); angka dan nama tetap diisi mesin.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from string import Template

from .temuan import Temuan


@dataclass(frozen=True)
class Var:
    nama: str
    arti: str
    contoh: str


@dataclass(frozen=True)
class Entri:
    kode: str
    grup: str
    judul: str  # kapan komentar ini muncul
    bawaan: str
    variabel: tuple[Var, ...] = field(default_factory=tuple)
    tingkat: str = "wajib"


GRUP = [
    "Tata Letak", "Format", "Struktur", "Judul", "Penulis", "Abstrak", "Kata Kunci", "Paragraf", "Tabel & Gambar",
    "Referensi", "Naskah", "Naratif (AI)", "Ringkasan & label",
]

# variabel yang dipakai berulang
_AKTUAL = lambda arti, contoh: Var("aktual", arti, contoh)  # noqa: E731
_HARAPAN = lambda arti, contoh: Var("harapan", arti, contoh)  # noqa: E731
_ELEMEN = Var("elemen", "nama elemen yang dicek", "Teks isi (paragraf)")
_JUMLAH = lambda arti, contoh: Var("jumlah", arti, contoh)  # noqa: E731
_KETENTUAN = lambda contoh: Var("ketentuan", "batas dari template, sudah dirangkai", contoh)  # noqa: E731
_MINIMAL = lambda contoh: Var("minimal", "batas minimal dari template", contoh)  # noqa: E731
_MAKSIMAL = lambda contoh: Var("maksimal", "batas maksimal dari template", contoh)  # noqa: E731


def _fmt(kode, judul, bawaan, aktual, harapan, tingkat="wajib"):
    return Entri(kode, "Format", judul, bawaan, (_ELEMEN, _AKTUAL(*aktual), _HARAPAN(*harapan)), tingkat)


def _fmt_ya(kode, judul, bawaan):
    return Entri(kode, "Format", judul, bawaan, (_ELEMEN,))


KATALOG: list[Entri] = [
    # ---- Tata letak ------------------------------------------------------------
    Entri("tata_letak.kertas", "Tata Letak", "Ukuran kertas berbeda",
          "Ukuran kertas $aktual, sedangkan template memakai $harapan.",
          (_AKTUAL("ukuran kertas naskah", "Letter (21,59 × 27,94 cm)"), _HARAPAN("ukuran kertas template", "A4 (21 × 29,7 cm)"))),
    Entri("tata_letak.orientasi", "Tata Letak", "Orientasi halaman berbeda",
          "Halaman$bagian_dokumen diatur $aktual, sedangkan template memakai orientasi $harapan.",
          (Var("bagian_dokumen", "keterangan bagian dokumen, kosong bila hanya satu bagian", " di bagian dokumen ke-2"),
           _AKTUAL("orientasi naskah", "lanskap"), _HARAPAN("orientasi template", "potret")), "saran"),
    Entri("tata_letak.margin", "Tata Letak", "Margin berbeda",
          "Margin $sisi $aktual cm, sedangkan template menetapkan $harapan cm.",
          (Var("sisi", "sisi margin", "kiri"), _AKTUAL("margin naskah", "2,54"), _HARAPAN("margin template", "4"))),
    Entri("tata_letak.kolom_isi", "Tata Letak", "Jumlah kolom isi berbeda",
          "Isi naskah ditulis dalam $aktual kolom, sedangkan template memakai $harapan kolom.",
          (_AKTUAL("jumlah kolom naskah", "1"), _HARAPAN("jumlah kolom template", "2"))),
    Entri("tata_letak.kolom_depan", "Tata Letak", "Jumlah kolom bagian depan berbeda",
          "Bagian judul sampai kata kunci ditulis dalam $aktual kolom, sedangkan template memakai $harapan kolom.",
          (_AKTUAL("jumlah kolom naskah", "2"), _HARAPAN("jumlah kolom template", "1"))),

    # ---- Format per elemen ---------------------------------------------------------
    _fmt("format.font", "Font berbeda", "$elemen memakai font $aktual. Template meminta $harapan.",
         ("font di naskah", "Calibri"), ("font template", "Times New Roman")),
    _fmt("format.ukuran", "Ukuran font berbeda", "$elemen berukuran $aktual pt. Template meminta $harapan pt.",
         ("ukuran di naskah", "11"), ("ukuran template", "12")),
    _fmt_ya("format.tebal_kurang", "Belum dicetak tebal", "$elemen belum dicetak tebal, padahal template memintanya tebal."),
    _fmt_ya("format.tebal_lebih", "Dicetak tebal padahal tidak perlu", "$elemen dicetak tebal, padahal template memakai huruf biasa."),
    _fmt_ya("format.miring_kurang", "Belum dicetak miring", "$elemen belum dicetak miring, padahal template memintanya miring."),
    _fmt_ya("format.miring_lebih", "Dicetak miring padahal tidak perlu", "$elemen dicetak miring, padahal template memakai huruf tegak."),
    _fmt_ya("format.kapital_kurang", "Belum kapital semua", "$elemen perlu ditulis dengan huruf kapital semua."),
    _fmt_ya("format.kapital_lebih", "Kapital semua padahal tidak perlu",
            "$elemen tidak perlu ditulis kapital semua. Cukup huruf besar di awal kata."),
    _fmt("format.perataan", "Perataan paragraf berbeda", "$elemen memakai $aktual. Template meminta $harapan.",
         ("perataan di naskah", "rata kiri"), ("perataan template", "rata kanan-kiri (justify)")),
    _fmt("format.spasi", "Spasi baris berbeda", "$elemen memakai spasi baris $aktual. Template meminta spasi $harapan.",
         ("spasi di naskah", "1,15"), ("spasi template", "1")),
    _fmt("format.indentasi", "Indentasi berbeda", "$elemen memakai indentasi $aktual. Template meminta indentasi $harapan.",
         ("indentasi di naskah", "baris pertama 1,27 cm"), ("indentasi template", "baris pertama 0,75 cm")),
    _fmt("format.jarak_sebelum", "Jarak sebelum paragraf berbeda",
         "$elemen memakai jarak $aktual pt sebelum paragraf. Template meminta $harapan pt.",
         ("jarak di naskah", "6"), ("jarak template", "0")),
    _fmt("format.jarak_sesudah", "Jarak sesudah paragraf berbeda",
         "$elemen memakai jarak $aktual pt sesudah paragraf. Template meminta $harapan pt.",
         ("jarak di naskah", "8"), ("jarak template", "0")),

    # ---- Struktur ------------------------------------------------------------------
    Entri("struktur.tanpa_judul_bagian", "Struktur", "Tidak ada judul bagian yang terbaca",
          "Judul bagian seperti PENDAHULUAN atau METODE tidak terbaca. Tulis setiap judul bagian di baris tersendiri, "
          "cetak tebal, atau pakai style Heading."),
    Entri("struktur.bagian_hilang", "Struktur", "Bagian wajib tidak ada",
          "Bagian “$bagian” tidak ada di naskah.", (Var("bagian", "nama bagian menurut template", "METODE PENELITIAN"),)),
    Entri("struktur.bagian_hilang_sebelum", "Struktur", "Bagian wajib tidak ada (ada bagian sesudahnya)",
          "Bagian “$bagian” tidak ada di naskah. Menurut template, bagian itu letaknya sebelum bagian ini.",
          (Var("bagian", "nama bagian menurut template", "METODE PENELITIAN"),)),
    Entri("struktur.nama_bagian", "Struktur", "Judul bagian ditulis berbeda",
          "Judul bagian “$aktual” sebaiknya ditulis “$harapan”, sama dengan template.",
          (_AKTUAL("judul bagian di naskah", "METODOLOGI"), _HARAPAN("judul bagian di template", "METODE PENELITIAN")), "saran"),
    Entri("struktur.subbagian_hilang", "Struktur", "Subbagian wajib tidak ada",
          "Subbagian “$subbagian” belum ada di bagian “$bagian”.",
          (Var("subbagian", "nama subbagian", "Saran"), Var("bagian", "nama bagian induk", "PENUTUP"))),
    Entri("struktur.urutan", "Struktur", "Urutan bagian tidak sesuai",
          "Bagian “$bagian” seharusnya muncul sebelum “$sebelum”, mengikuti urutan template.",
          (Var("bagian", "bagian yang posisinya salah", "METODE PENELITIAN"), Var("sebelum", "bagian yang seharusnya sesudahnya", "HASIL DAN PEMBAHASAN"))),
    Entri("struktur.jarak_heading_beda", "Struktur", "Jarak heading beda tingkat tidak sesuai",
          "Ada $aktual baris kosong antara “$sebelumnya” dan “$judul”, sedangkan template meminta $harapan antar heading beda tingkat.",
          (_AKTUAL("jumlah baris kosong di naskah", "0"), _HARAPAN("ketentuan template", "2 baris kosong"),
           Var("judul", "heading ini", "Dataset Sintetis"), Var("sebelumnya", "heading sebelumnya", "HASIL DAN PEMBAHASAN"))),
    Entri("struktur.jarak_subheading", "Struktur", "Jarak sebelum subjudul setingkat tidak sesuai",
          "Ada $aktual baris kosong sebelum subjudul “$judul”, sedangkan template meminta $harapan antar subjudul setingkat.",
          (_AKTUAL("jumlah baris kosong di naskah", "1"), _HARAPAN("ketentuan template", "tanpa baris kosong"),
           Var("judul", "subjudul ini", "Pengujian Model"), Var("sebelumnya", "subjudul sebelumnya", "Dataset Sintetis"))),
    Entri("struktur.nomor_wajib", "Struktur", "Judul belum bernomor",
          "Judul ini belum diberi nomor. Template memakai penomoran seperti 1. atau 2.1."),
    Entri("struktur.nomor_dilarang", "Struktur", "Judul diberi nomor padahal tidak perlu",
          "Judul ini tidak perlu diberi nomor. Template menulis judul bagian tanpa nomor."),

    # ---- Judul -----------------------------------------------------------------------
    Entri("judul.tidak_ada", "Judul", "Judul artikel tidak terbaca", "Judul artikel tidak terbaca di awal naskah."),
    Entri("judul.jumlah_kata", "Judul", "Jumlah kata judul di luar batas",
          "Judul terdiri atas $jumlah kata, sedangkan ketentuan template $ketentuan.",
          (_JUMLAH("jumlah kata judul di naskah", "18"), _KETENTUAN("maksimal 15 kata"), _MINIMAL("-"), _MAKSIMAL("15"))),
    Entri("judul.inggris_wajib", "Judul", "Judul bahasa Inggris belum ada",
          "Judul bahasa Inggris belum ada. Template meminta judul dalam bahasa Indonesia dan Inggris."),
    Entri("judul.inggris_tidak_perlu", "Judul", "Judul bahasa Inggris tidak diminta",
          "Template tidak meminta judul bahasa Inggris.", (), "saran"),
    Entri("judul.inggris_jumlah_kata", "Judul", "Judul bahasa Inggris terlalu panjang",
          "Judul bahasa Inggris terdiri atas $jumlah kata, sedangkan ketentuan template maksimal $maksimal kata.",
          (_JUMLAH("jumlah kata judul Inggris", "16"), _MAKSIMAL("12"))),

    Entri("judul.singkatan", "Judul", "Judul memuat singkatan",
          "Judul memuat singkatan $daftar. Template meminta judul ditulis tanpa singkatan.",
          (Var("daftar", "singkatan yang ditemukan", "SPK, AHP"),)),

    # ---- Penulis ---------------------------------------------------------------------
    Entri("penulis.email", "Penulis", "Email penulis belum ada",
          "Email penulis belum dicantumkan. Template meminta email penulis di bawah nama dan afiliasi."),
    Entri("penulis.orcid", "Penulis", "ORCID penulis belum ada",
          "ORCID penulis belum dicantumkan. Template meminta ORCID untuk setiap penulis."),

    # ---- Abstrak ---------------------------------------------------------------------
    Entri("abstrak.tidak_ada", "Abstrak", "Abstrak belum ada",
          "$nama belum ada di naskah.", (Var("nama", "Abstrak atau Abstract (bahasa Inggris)", "Abstrak"),)),
    Entri("abstrak.tidak_diminta", "Abstrak", "Abstract bahasa Inggris tidak diminta",
          "$nama tidak diminta template. Abstrak cukup ditulis dalam bahasa Indonesia.",
          (Var("nama", "nama abstrak", "Abstract (bahasa Inggris)"),)),
    Entri("abstrak.jumlah_kata", "Abstrak", "Jumlah kata abstrak di luar batas",
          "$nama terdiri atas $jumlah kata, sedangkan ketentuan template $ketentuan.",
          (Var("nama", "Abstrak atau Abstract (bahasa Inggris)", "Abstrak"), _JUMLAH("jumlah kata abstrak", "174"),
           _KETENTUAN("200 sampai 250 kata"), _MINIMAL("200"), _MAKSIMAL("250"))),
    Entri("abstrak.paragraf", "Abstrak", "Abstrak lebih dari satu paragraf",
          "$nama terbagi menjadi $jumlah paragraf. Template meminta satu paragraf saja.",
          (Var("nama", "nama abstrak", "Abstrak"), _JUMLAH("jumlah paragraf", "2"))),

    Entri("abstrak.sitasi", "Abstrak", "Abstrak memuat sitasi",
          "$nama memuat sitasi $daftar. Template meminta abstrak tanpa sitasi.",
          (Var("nama", "Abstrak atau Abstract (bahasa Inggris)", "Abstrak"), Var("daftar", "sitasi yang ditemukan", "[3], [7]"))),

    # ---- Kata kunci ------------------------------------------------------------------
    Entri("kata_kunci.tidak_ada", "Kata Kunci", "Kata kunci belum ada",
          "$nama belum ada di naskah.", (Var("nama", "Kata kunci atau Keywords", "Kata kunci"),)),
    Entri("kata_kunci.pemisah", "Kata Kunci", "Tanda pemisah berbeda",
          "$nama dipisahkan dengan tanda $aktual. Gunakan tanda $harapan sesuai template.",
          (Var("nama", "Kata kunci atau Keywords", "Kata kunci"), _AKTUAL("pemisah di naskah", "koma (,)"),
           _HARAPAN("pemisah template", "titik koma (;)"))),
    Entri("kata_kunci.jumlah", "Kata Kunci", "Jumlah kata kunci di luar batas",
          "$nama berjumlah $jumlah, sedangkan ketentuan template $ketentuan.",
          (Var("nama", "Kata kunci atau Keywords", "Kata kunci"), _JUMLAH("jumlah kata kunci", "7"),
           _KETENTUAN("3 sampai 5 kata kunci"), _MINIMAL("3"), _MAKSIMAL("5"))),
    Entri("kata_kunci.huruf_kecil", "Kata Kunci", "Kata kunci belum huruf kecil",
          "$nama sebaiknya ditulis dengan huruf kecil kecuali singkatan: $daftar.",
          (Var("nama", "Kata kunci atau Keywords", "Kata kunci"), Var("daftar", "kata kunci yang berhuruf besar", "Wisata Terestrial, Website")),
          "saran"),

    # ---- Paragraf ----------------------------------------------------------------------
    Entri("paragraf.kurang_kalimat", "Paragraf", "Paragraf terlalu pendek",
          "Paragraf ini hanya berisi $jumlah kalimat. Template meminta minimal $minimal kalimat: satu kalimat utama dan kalimat penjelas.",
          (_JUMLAH("jumlah kalimat", "1"), _MINIMAL("2")), "saran"),
    Entri("paragraf.lebih_kalimat", "Paragraf", "Paragraf terlalu panjang",
          "Paragraf ini berisi $jumlah kalimat, lebih dari batas $maksimal kalimat.",
          (_JUMLAH("jumlah kalimat", "12"), _MAKSIMAL("8")), "saran"),

    # ---- Tabel & gambar --------------------------------------------------------------------
    Entri("tabel_gambar.nomor", "Tabel & Gambar", "Nomor tabel/gambar tidak berurutan",
          "Nomor $jenis tidak berurutan: tertulis $label $aktual, seharusnya $label $harapan.",
          (Var("jenis", "tabel atau gambar", "tabel"), Var("label", "Tabel atau Gambar", "Tabel"),
           _AKTUAL("nomor di naskah", "3"), _HARAPAN("nomor yang benar", "2"))),
    Entri("tabel_gambar.posisi_judul", "Tabel & Gambar", "Letak judul tabel/gambar berbeda",
          "Judul $jenis ada di $aktual $jenis. Template meletakkannya di $harapan $jenis.",
          (Var("jenis", "tabel atau gambar", "tabel"), _AKTUAL("letak di naskah", "bawah"), _HARAPAN("letak di template", "atas"))),
    Entri("tabel_gambar.belum_dirujuk", "Tabel & Gambar", "Tabel/gambar belum dirujuk di teks",
          "$label $nomor belum disebut di dalam teks. Rujuk dengan kalimat seperti “seperti terlihat pada $label $nomor”.",
          (Var("label", "Tabel atau Gambar", "Gambar"), Var("nomor", "nomor tabel/gambar", "2"))),
    Entri("tabel_gambar.tanpa_judul", "Tabel & Gambar", "Tabel tampaknya belum berjudul",
          "$label ini tampaknya belum punya judul, misalnya “$label 1. ...”.",
          (Var("label", "Tabel atau Gambar", "Tabel"),), "saran"),
    Entri("tabel_gambar.gambar_tanpa_judul", "Tabel & Gambar", "Gambar belum berjudul",
          "Gambar ini belum punya judul, misalnya “Gambar 1. ...”."),

    Entri("tabel_gambar.garis", "Tabel & Gambar", "Pola garis tabel berbeda",
          "$tabel memakai $aktual, sedangkan template memakai $harapan.",
          (Var("tabel", "nama tabel", "Tabel 2"), _AKTUAL("pola garis di naskah: grid penuh, garis vertikal, garis horizontal saja, atau format tanpa garis", "grid penuh (garis horizontal dan vertikal)"),
           _HARAPAN("pola garis template", "garis horizontal saja, tanpa garis vertikal"))),
    Entri("tabel_gambar.perataan_tabel", "Tabel & Gambar", "Perataan tabel berbeda",
          "$tabel diletakkan $aktual, sedangkan template meletakkan tabel $harapan.",
          (Var("tabel", "nama tabel", "Tabel 2"), _AKTUAL("perataan di naskah", "rata kiri"),
           _HARAPAN("perataan template", "di tengah (center)"))),
    Entri("tabel_gambar.lebar_tabel", "Tabel & Gambar", "Lebar tabel belum selebar halaman",
          "$tabel selebar $aktual cm, belum mengikuti lebar area teks $harapan cm. Pakai AutoFit Window sesuai template.",
          (Var("tabel", "nama tabel", "Tabel 2"), _AKTUAL("lebar tabel", "9,8"), _HARAPAN("lebar area teks", "15"))),
    Entri("tabel_gambar.melebihi_margin", "Tabel & Gambar", "Tabel/gambar melewati margin",
          "$objek selebar $aktual cm, melewati lebar area teks $harapan cm. Perkecil agar tidak keluar dari margin.",
          (Var("objek", "Tabel 2, Tabel ini, atau Gambar ini", "Tabel 2"), _AKTUAL("lebar objek", "17,3"),
           _HARAPAN("lebar area teks", "15"))),
    Entri("tabel_gambar.tabel_berupa_gambar", "Tabel & Gambar", "Tabel disisipkan sebagai gambar",
          "$tabel tampaknya disisipkan sebagai gambar. Buat ulang sebagai tabel Word agar isinya bisa dibaca dan disunting.",
          (Var("tabel", "nama tabel", "Tabel 3"),), "saran"),
    Entri("tabel_gambar.tanpa_sumber", "Tabel & Gambar", "Keterangan sumber belum ada",
          "$objek belum diberi keterangan sumber, misalnya “Sumber: ...” di bawahnya.",
          (Var("objek", "nama tabel/gambar", "Gambar 2"),)),
    Entri("tabel_gambar.perataan_gambar", "Tabel & Gambar", "Perataan gambar berbeda",
          "Gambar ini diletakkan $aktual, sedangkan template meletakkan gambar $harapan.",
          (_AKTUAL("perataan di naskah", "rata kiri"), _HARAPAN("perataan template", "di tengah (center)"))),
    Entri("tabel_gambar.gambar_melayang", "Tabel & Gambar", "Gambar tidak In Line with Text",
          "Gambar ini memakai Wrap Text “$aktual”. Ubah menjadi “In Line with Text” sesuai template.",
          (_AKTUAL("pengaturan Wrap Text di naskah", "Square"),)),
    Entri("tabel_gambar.resolusi_rendah", "Tabel & Gambar", "Resolusi gambar rendah",
          "Resolusi gambar ini sekitar $aktual dpi, di bawah $harapan dpi. Gambar bisa tampak buram saat dicetak.",
          (_AKTUAL("perkiraan resolusi", "72"), _HARAPAN("resolusi minimal", "150")), "saran"),
    Entri("tabel_gambar.persamaan_gambar", "Tabel & Gambar", "Persamaan berupa gambar",
          "Persamaan ini berupa gambar. Tulis ulang dengan Equation Editor agar bisa disunting."),
    Entri("tabel_gambar.nomor_persamaan", "Tabel & Gambar", "Nomor persamaan tidak berurutan",
          "Nomor persamaan tidak berurutan: tertulis ($aktual), seharusnya ($harapan).",
          (_AKTUAL("nomor di naskah", "4"), _HARAPAN("nomor yang benar", "3"))),

    # ---- Referensi ---------------------------------------------------------------------------
    Entri("referensi.tidak_ada", "Referensi", "Daftar pustaka tidak ditemukan",
          "Daftar pustaka tidak ditemukan, atau judul bagiannya tidak dikenali."),
    Entri("referensi.gaya_sitasi", "Referensi", "Gaya sitasi berbeda",
          "Sitasi di naskah memakai gaya $aktual, sedangkan template meminta gaya $harapan.",
          (_AKTUAL("gaya di naskah", "nama-tahun (Nama, 2020)"), _HARAPAN("gaya template", "numerik [1]"))),
    Entri("referensi.jumlah", "Referensi", "Jumlah referensi kurang",
          "Daftar pustaka berisi $jumlah referensi, sedangkan template meminta minimal $minimal.",
          (_JUMLAH("jumlah referensi", "8"), _MINIMAL("15"))),
    Entri("referensi.mutakhir", "Referensi", "Referensi mutakhir kurang",
          "Referensi terbitan $rentang baru $jumlah dari $total ($persen%). Template meminta minimal $persen_minimal%.",
          (Var("rentang", "rentang tahun mutakhir", "2017 sampai 2026"), _JUMLAH("referensi mutakhir", "9"),
           Var("total", "referensi bertahun", "15"), Var("persen", "persentase di naskah", "60"),
           Var("persen_minimal", "persentase minimal template", "80"))),
    Entri("referensi.tanpa_tahun", "Referensi", "Tahun terbit tidak terbaca",
          "Tahun terbit referensi ini tidak terbaca.", (), "saran"),
    Entri("referensi.abjad", "Referensi", "Daftar pustaka belum urut abjad",
          "Daftar pustaka belum urut abjad: “$aktual” seharusnya berada sebelum “$sebelum”.",
          (_AKTUAL("penulis yang posisinya salah", "Anwar"), Var("sebelum", "penulis di atasnya", "Zulkifli"))),
    Entri("referensi.sitasi_tidak_ada", "Referensi", "Nomor sitasi tidak ada di daftar pustaka",
          "Sitasi [$nomor] tidak ada di daftar pustaka, yang hanya memuat $total referensi.",
          (Var("nomor", "nomor sitasi", "18"), Var("total", "jumlah referensi", "15"))),
    Entri("referensi.urutan_sitasi", "Referensi", "Nomor sitasi tidak berurutan",
          "Sitasi [$nomor] muncul sebelum [$harapan]. Nomor sitasi harus berurutan sesuai kemunculan di naskah.",
          (Var("nomor", "nomor yang muncul terlalu awal", "8"), _HARAPAN("nomor yang seharusnya muncul dulu", "7")), "saran"),
    Entri("referensi.tidak_disitasi_nomor", "Referensi", "Referensi bernomor tidak disitasi",
          "Referensi [$nomor] tidak pernah disitasi di naskah.", (Var("nomor", "nomor referensi", "7"),), "saran"),
    Entri("referensi.sitasi_tidak_cocok", "Referensi", "Sitasi tidak ada di daftar pustaka",
          "Sitasi “$sitasi” tidak ada padanannya di daftar pustaka. Periksa ejaan nama dan tahunnya.",
          (Var("sitasi", "sitasi di teks", "Citra (2019)"),), "saran"),
    Entri("referensi.tidak_disitasi", "Referensi", "Referensi tidak disitasi",
          "Referensi ini tidak pernah disitasi di naskah.", (), "saran"),

    Entri("referensi.manajer", "Referensi", "Tidak memakai aplikasi manajemen referensi",
          "Sitasi dan daftar pustaka tampaknya ditulis manual. Gunakan aplikasi manajemen referensi seperti Mendeley atau Zotero sesuai template.",
          (), "saran"),
    Entri("referensi.tanpa_doi", "Referensi", "Referensi tanpa DOI",
          "Referensi ini belum mencantumkan DOI.", (), "saran"),
    Entri("referensi.sumber_primer", "Referensi", "Sumber primer kurang",
          "Referensi dari jurnal atau prosiding diperkirakan $jumlah dari $total ($persen%), di bawah ketentuan template minimal $persen_minimal%.",
          (_JUMLAH("referensi jurnal/prosiding", "9"), Var("total", "jumlah referensi", "15"),
           Var("persen", "persentase di naskah", "60"), Var("persen_minimal", "persentase minimal template", "80")), "saran"),
    Entri("referensi.sumber_terlarang", "Referensi", "Merujuk sumber yang dilarang",
          "Referensi ini bersumber dari $situs, yang tidak diperbolehkan template.",
          (Var("situs", "sumber yang dilarang", "Wikipedia"),)),

    # ---- Naskah ------------------------------------------------------------------------------
    Entri("naskah.jumlah_kata", "Naskah", "Panjang naskah di luar batas",
          "Naskah berisi sekitar $jumlah kata di luar daftar pustaka dan isi tabel, sedangkan ketentuan template $ketentuan.",
          (_JUMLAH("jumlah kata naskah", "3.120"), _KETENTUAN("4.000 sampai 8.000 kata"), _MINIMAL("4.000"), _MAKSIMAL("8.000"))),
    Entri("naskah.halaman", "Naskah", "Jumlah halaman di luar batas",
          "Naskah berjumlah $jumlah halaman menurut data Word, sedangkan ketentuan template $ketentuan.",
          (_JUMLAH("jumlah halaman", "12"), _KETENTUAN("5 sampai 10 halaman"), _MINIMAL("5"), _MAKSIMAL("10"))),
    Entri("naskah.kata_terlarang", "Naskah", "Memakai kata yang dilarang",
          "Paragraf ini memakai kata yang tidak dianjurkan template: $daftar.",
          (Var("daftar", "kata yang ditemukan", "saya, kami"),)),
    Entri("naskah.sisa_petunjuk", "Naskah", "Petunjuk template belum dihapus",
          "Petunjuk dari template sepertinya belum dihapus: $petunjuk",
          (Var("petunjuk", "potongan teks petunjuk", "[Times New Roman 11 Bold]"),), "saran"),

    Entri("naskah.bahasa", "Naskah", "Bahasa naskah berbeda",
          "Naskah tampaknya ditulis dalam bahasa $aktual, sedangkan template meminta bahasa $harapan.",
          (_AKTUAL("bahasa naskah", "Indonesia"), _HARAPAN("bahasa template", "Inggris"))),
    Entri("naskah.track_changes", "Naskah", "Masih ada track changes",
          "Naskah masih berisi $jumlah perubahan terlacak (track changes). Terima atau tolak semua perubahan sebelum naskah dikirim.",
          (_JUMLAH("jumlah perubahan", "14"),), "saran"),
    Entri("naskah.komentar_lama", "Naskah", "Masih ada komentar lama",
          "Naskah masih berisi $jumlah komentar lama. Hapus komentar tersebut sebelum naskah dikirim.",
          (_JUMLAH("jumlah komentar", "3"),), "saran"),
    Entri("naskah.sorotan", "Naskah", "Teks masih disorot (highlight)",
          "Teks di paragraf ini masih diberi sorotan (highlight) $aktual. Hapus sorotan sebelum naskah dikirim.",
          (_AKTUAL("warna sorotan", "kuning"),)),
    Entri("naskah.teks_berwarna", "Naskah", "Teks tidak berwarna hitam",
          "$elemen memakai warna teks $aktual. Template memakai teks hitam.",
          (_ELEMEN, _AKTUAL("warna teks di naskah", "biru (#2F5496)"))),
    Entri("naskah.spasi_ganda", "Naskah", "Spasi ganda antarkata",
          "Paragraf ini berisi $jumlah spasi ganda antarkata, misalnya di antara “$sebelum” dan “$sesudah”.",
          (_JUMLAH("jumlah spasi ganda", "2"), Var("sebelum", "kata sebelum spasi ganda", "sistem"),
           Var("sesudah", "kata sesudah spasi ganda", "informasi")), "saran"),
    Entri("naskah.baris_kosong", "Naskah", "Baris kosong berturut-turut",
          "Setelah paragraf ini ada $jumlah baris kosong berturut-turut. Atur jarak antarparagraf lewat Spacing, bukan baris kosong.",
          (_JUMLAH("jumlah baris kosong", "3"),), "saran"),
    Entri("naskah.catatan_kaki", "Naskah", "Memakai catatan kaki",
          "Naskah memakai $jumlah catatan kaki (footnote), padahal template tidak memperbolehkannya. Pindahkan isinya ke dalam teks.",
          (_JUMLAH("jumlah catatan kaki", "2"),)),

    # ---- Naratif (AI) -------------------------------------------------------------------------
    Entri("naratif.tidak_sesuai", "Naratif (AI)", "Aturan isi tidak terpenuhi (penilaian AI)",
          "$aturan. $penjelasan",
          (Var("aturan", "aturan naratif dari profil", "Pendahuluan memuat research gap"),
           Var("penjelasan", "penjelasan dari AI", "Belum ada kalimat yang menegaskan kesenjangan penelitian."),
           Var("bagian", "bagian naskah", "Pendahuluan")), "saran"),
    Entri("naratif.bagian_tidak_ada", "Naratif (AI)", "Bagian untuk aturan isi tidak ditemukan",
          "Bagian “$bagian” tidak ditemukan, jadi aturan isi untuk bagian itu belum bisa dinilai.",
          (Var("bagian", "nama bagian", "Metode Penelitian"),), "saran"),
    Entri("naratif.gagal", "Naratif (AI)", "Penilaian AI gagal",
          "Penilaian AI untuk bagian $bagian gagal: $galat",
          (Var("bagian", "nama bagian", "Pendahuluan"), Var("galat", "pesan galat teknis", "batas waktu habis")), "saran"),

    # ---- Ringkasan di judul & label ------------------------------------------------------------------
    Entri("ringkasan.judul", "Ringkasan & label", "Baris pertama komentar ringkasan",
          "Hasil cek otomatis: $jurnal", (Var("jurnal", "nama profil jurnal", "Jurnal SIBC"),)),
    Entri("ringkasan.jumlah", "Ringkasan & label", "Jumlah masalah di komentar ringkasan",
          "$jumlah hal perlu diperbaiki, ditandai di $tempat tempat pada naskah.",
          (_JUMLAH("jenis masalah", "19"), Var("tempat", "jumlah tempat yang ditandai", "34"))),
    Entri("ringkasan.nihil", "Ringkasan & label", "Tidak ada masalah",
          "Tidak ada pelanggaran aturan template yang ditemukan."),
    Entri("ringkasan.pemeriksa", "Ringkasan & label", "Nama pemeriksa",
          "Diperiksa oleh $pemeriksa", (Var("pemeriksa", "nama dan email akun", "Muhammad Yahya Zahid <nama@gmail.com>"),)),
    Entri("ringkasan.scope_sesuai", "Ringkasan & label", "Putusan scope: sesuai",
          "Kesesuaian scope: sesuai, naskah dapat diterima ($skor). $alasan",
          (Var("skor", "skor kesesuaian", "86/100"), Var("alasan", "alasan dari AI", "Kontribusi utama berupa sistem informasi pariwisata."))),
    Entri("ringkasan.scope_tidak_sesuai", "Ringkasan & label", "Putusan scope: tidak sesuai",
          "Kesesuaian scope: tidak sesuai, naskah ditolak ($skor). $alasan",
          (Var("skor", "skor kesesuaian", "18/100"), Var("alasan", "alasan dari AI", "Kontribusi utama ada di bidang pedagogi."))),
    Entri("ringkasan.masalah_sama", "Ringkasan & label", "Catatan masalah berulang",
          "(Masalah yang sama juga ada di $jumlah tempat lain.)", (_JUMLAH("tempat lain", "12"),)),
    Entri("label.wajib", "Ringkasan & label", "Label temuan wajib (bila label diaktifkan)",
          "[WAJIB · $kategori]", (Var("kategori", "kategori temuan", "Abstrak"),)),
    Entri("label.saran", "Ringkasan & label", "Label temuan saran (bila label diaktifkan)",
          "[SARAN · $kategori]", (Var("kategori", "kategori temuan", "Referensi"),)),
    Entri("label.ai", "Ringkasan & label", "Label temuan AI (bila label diaktifkan)",
          "[SARAN AI · $kategori]", (Var("kategori", "kategori temuan", "Naratif · Pendahuluan"),)),
    Entri("label.keterangan", "Ringkasan & label", "Keterangan label (bila label diaktifkan)",
          "WAJIB berarti tidak sesuai aturan template. SARAN berarti perlu dicek manual."),
]

INDEKS: dict[str, Entri] = {e.kode: e for e in KATALOG}
MAKS_PANJANG = 600
_RX_VAR = re.compile(r"\$(?:\{([_a-zA-Z]\w*)\}|([_a-zA-Z]\w*))", re.ASCII)  # sama dengan idpattern string.Template


def teks(kustom: dict[str, str] | None, kode: str, **data) -> str:
    """Kalimat final: kalimat kustom profil (bila ada) atau bawaan, dengan variabel diisi."""
    templat = (kustom or {}).get(kode) or INDEKS[kode].bawaan
    return Template(templat).safe_substitute({k: "" if v is None else str(v) for k, v in data.items()})


def aktif(prof, kode: str | None) -> bool:
    """False bila kalimat ini dimatikan di menu Komentar untuk profil jurnal ini."""
    return not kode or kode not in (getattr(prof, "komentar_mati", None) or [])


def validasi(kode: str, templat: str) -> str | None:
    """Pesan galat bila kalimat kustom tidak sah, None bila sah."""
    e = INDEKS.get(kode)
    if e is None:
        return f"Kode komentar {kode} tidak dikenal."
    if not templat.strip():
        return "Kalimat tidak boleh kosong."
    if len(templat) > MAKS_PANJANG:
        return f"Kalimat terlalu panjang (maksimal {MAKS_PANJANG} karakter)."
    boleh = {v.nama for v in e.variabel}
    asing = sorted({(a or b) for a, b in _RX_VAR.findall(templat.replace("$$", ""))} - boleh)
    if asing:
        tersedia = ", ".join(f"${v}" for v in sorted(boleh)) or "tidak ada variabel"
        return f"Variabel {', '.join('$' + a for a in asing)} tidak dikenal. Yang tersedia: {tersedia}."
    return None


def bersihkan(kustom: dict) -> tuple[dict[str, str], list[str]]:
    """Pisahkan kalimat kustom yang sah dari yang galat. Kalimat kosong atau sama dengan bawaan dibuang."""
    sah, galat = {}, []
    for kode, templat in (kustom or {}).items():
        if not isinstance(templat, str) or not templat.strip():
            continue
        templat = templat.strip()
        if kode in INDEKS and templat == INDEKS[kode].bawaan:
            continue
        pesan = validasi(kode, templat)
        if pesan:
            judul = INDEKS[kode].judul if kode in INDEKS else kode
            galat.append(f"{judul}: {pesan}")
        else:
            sah[kode] = templat
    return sah, galat


def temuan(prof, kategori: str, kode: str, *, tingkat: str | None = None, para: int | None = None,
           kelompok: str | None = None, sumber: str = "bot", **data) -> Temuan:
    """Buat Temuan dengan kalimat dari katalog (memakai kalimat kustom profil bila ada)."""
    return Temuan(kategori, teks(getattr(prof, "teks_komentar", None), kode, **data),
                  tingkat or INDEKS[kode].tingkat, para, kelompok, sumber, kode)


def ketentuan(mn: int | float | None, mx: int | float | None, satuan: str) -> str:
    """Batas dari template dalam kalimat: '200 sampai 250 kata', 'maksimal 15 kata', 'minimal 5 kata'."""
    from .teks import angka

    if mn and mx:
        return f"{angka(mn)} sampai {angka(mx)} {satuan}"
    if mx:
        return f"maksimal {angka(mx)} {satuan}"
    return f"minimal {angka(mn)} {satuan}"


def cm(v: float) -> str:
    """Ukuran dalam cm, satu desimal, gaya Indonesia: 15.04 -> '15'."""
    from .teks import angka

    return angka(round(v, 1))


def di_luar_batas(n: int, mn: int | None, mx: int | None) -> bool:
    if mn and mx:
        return not (mn <= n <= mx)
    if mx:
        return n > mx
    if mn:
        return n < mn
    return False


def ekspor() -> list[dict]:
    """Katalog untuk frontend."""
    return [
        {"kode": e.kode, "grup": e.grup, "judul": e.judul, "bawaan": e.bawaan, "tingkat": e.tingkat,
         "variabel": [{"nama": v.nama, "arti": v.arti, "contoh": v.contoh} for v in e.variabel]}
        for e in sorted(KATALOG, key=lambda x: GRUP.index(x.grup))
    ]
