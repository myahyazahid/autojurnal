from __future__ import annotations

import docx

from app.engine import teks as T
from app.engine.ekstrak import ekstrak_template
from app.engine.layanan import cek_naskah
from app.engine.petunjuk import baca_format


def test_utilitas_teks():
    assert T.hitung_kata("Satu dua, tiga — empat.") == 4
    assert len(T.pecah_kalimat("Menurut Budi dkk. hasilnya 3.5 persen. Kalimat kedua di sini.")) == 2
    assert T.nomor_judul("2.1\tHasil") == ("2.1", 2)
    assert T.normalisasi_judul("1. PENDAHULUAN") == "pendahuluan"
    assert T.kanonik_bagian("metodologi penelitian") == "metode"
    bersih, petunjuk = T.pisah_petunjuk("JUDUL [Times New Roman 14 Bold, Center]")
    assert bersih == "JUDUL" and petunjuk == ["Times New Roman 14 Bold, Center"]


def test_baca_petunjuk_format():
    h = baca_format("Heading Level 1: Huruf besar semua, Times New Roman 11 bold; paragraph-spacing-after: 6pt, before: 0pt")
    assert h["font"] == "Times New Roman" and h["ukuran_pt"] == 11 and h["tebal"] is True
    assert h["kapital"] is True and h["spasi_sesudah_pt"] == 6 and h["spasi_sebelum_pt"] == 0
    assert baca_format("posisi tengah (center justified)")["perataan"] == "tengah"
    assert baca_format("Center, Max 14 Kata")["maks_kata"] == 14


def test_ekstrak_template(template_docx):
    prof, peta = ekstrak_template(str(template_docx))
    tl = prof.tata_letak
    assert (tl.lebar_kertas_cm, tl.tinggi_kertas_cm) == (21.0, 29.7)
    assert (tl.margin_kiri_cm, tl.margin_kanan_cm) == (4.0, 3.0)
    assert [b.judul for b in prof.struktur.bagian] == [
        "PENDAHULUAN", "METODE PENELITIAN", "HASIL DAN PEMBAHASAN", "KESIMPULAN", "DAFTAR PUSTAKA"]
    assert prof.format.judul.ukuran_pt == 14 and prof.format.judul.tebal is True
    assert prof.format.teks_isi.font == "Times New Roman" and prof.format.teks_isi.ukuran_pt == 12
    assert prof.format.teks_isi.indentasi_pertama_cm == 1.0
    assert (prof.abstrak.min_kata, prof.abstrak.maks_kata) == (150, 250)
    assert (prof.kata_kunci.min_jumlah, prof.kata_kunci.maks_jumlah, prof.kata_kunci.pemisah) == (3, 5, ";")
    assert prof.judul.maks_kata == 15
    assert prof.paragraf.min_kalimat == 2
    assert prof.referensi.min_jumlah == 10 and prof.referensi.rentang_tahun == 10 and prof.referensi.persen_mutakhir == 80
    assert prof.referensi.gaya_sitasi == "penulis_tahun" and prof.referensi.urutan == "abjad"
    assert prof.tabel_gambar.posisi_judul_tabel == "atas"
    assert any(a.bagian == "Metode Penelitian" for a in prof.aturan_naratif)
    assert any(p["peran"] == "judul_bagian" for p in peta)


def test_cek_naskah_menemukan_pelanggaran(template_docx, naskah_docx, tmp_path):
    prof, _ = ekstrak_template(str(template_docx))
    keluar = tmp_path / "hasil.docx"
    hasil = cek_naskah(str(naskah_docx), prof, "Jurnal Uji", keluar)
    pesan = " | ".join(t["pesan"] for t in hasil["temuan"])

    assert "Ukuran kertas Letter" in pesan
    assert "Margin kiri 2,54 cm, seharusnya 4 cm" in pesan
    assert "Bagian “METODE PENELITIAN” tidak ditemukan" in pesan
    assert "Judul terdiri atas 18 kata; maksimal 15 kata" in pesan
    assert "Abstrak terdiri atas 40 kata; seharusnya 150–250 kata" in pesan
    assert "dipisahkan tanda “,”, seharusnya “;”" in pesan
    assert "Jumlah kata kunci 7" in pesan
    assert "font Calibri, seharusnya Times New Roman" in pesan
    assert "spasi baris 1,5, seharusnya 1" in pesan
    assert "Paragraf hanya 1 kalimat" in pesan
    assert "Judul tabel diletakkan di bawah tabel; seharusnya di atas" in pesan
    assert "Tabel 1 belum dirujuk" in pesan
    assert "Jumlah referensi 3, minimal 10" in pesan
    assert "Referensi mutakhir" in pesan
    assert "Sitasi “Citra (2019)” tidak ditemukan" in pesan
    assert "belum urut abjad" in pesan

    # komentar Word benar-benar tertulis dan berkas bisa dibuka lagi
    d = docx.Document(str(keluar))
    komentar = list(d.comments)
    assert len(komentar) >= 10
    assert any("HASIL CEK OTOMATIS" in k.text for k in komentar)
    assert hasil["ringkasan"]["wajib"] > 0 and hasil["statistik"]["jumlah_referensi"] == 3


def test_naskah_patuh_tanpa_temuan_format(template_docx, tmp_path):
    """Template dicek terhadap profilnya sendiri: tidak boleh ada temuan tata letak/format."""
    prof, _ = ekstrak_template(str(template_docx))
    hasil = cek_naskah(str(template_docx), prof, "Uji", tmp_path / "x.docx")
    kategori = {t["kategori"] for t in hasil["temuan"] if t["tingkat"] == "wajib"}
    assert "Tata Letak" not in kategori and "Format" not in kategori and "Struktur" not in kategori
