"""Skema PROFIL ATURAN jurnal.

Satu skema ini dipakai untuk tiga hal: (1) form edit di frontend (dibangkitkan dari JSON Schema),
(2) format keluaran AI saat membaca template, (3) validasi sebelum pengecekan.
Nilai `None` artinya "tidak dicek".
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Perataan = Literal["kiri", "tengah", "kanan", "rata_kanan_kiri"]


class _Dasar(BaseModel):
    model_config = ConfigDict(extra="ignore")


class FormatElemen(_Dasar):
    font: Optional[str] = Field(None, title="Jenis font")
    ukuran_pt: Optional[float] = Field(None, title="Ukuran font (pt)")
    tebal: Optional[bool] = Field(None, title="Cetak tebal (bold)")
    miring: Optional[bool] = Field(None, title="Cetak miring (italic)")
    kapital: Optional[bool] = Field(None, title="Huruf kapital semua")
    perataan: Optional[Perataan] = Field(None, title="Perataan paragraf")
    spasi_baris: Optional[float] = Field(None, title="Spasi baris (kali)", description="1 = tunggal, 1,5, 2 = ganda")
    indentasi_pertama_cm: Optional[float] = Field(
        None, title="Indentasi baris pertama (cm)", description="Nilai negatif = indentasi gantung (hanging)"
    )
    spasi_sebelum_pt: Optional[float] = Field(None, title="Jarak sebelum paragraf (pt)")
    spasi_sesudah_pt: Optional[float] = Field(None, title="Jarak sesudah paragraf (pt)")


class FormatPerElemen(_Dasar):
    judul: FormatElemen = Field(default_factory=FormatElemen, title="Judul artikel")
    judul_inggris: FormatElemen = Field(default_factory=FormatElemen, title="Judul bahasa Inggris")
    info_penulis: FormatElemen = Field(default_factory=FormatElemen, title="Nama, afiliasi & email penulis")
    abstrak: FormatElemen = Field(default_factory=FormatElemen, title="Abstrak")
    abstrak_inggris: FormatElemen = Field(default_factory=FormatElemen, title="Abstract (Inggris)")
    kata_kunci: FormatElemen = Field(default_factory=FormatElemen, title="Kata kunci / keywords")
    judul_bagian: FormatElemen = Field(default_factory=FormatElemen, title="Judul bagian (heading 1)")
    sub_judul: FormatElemen = Field(default_factory=FormatElemen, title="Subjudul (heading 2+)")
    teks_isi: FormatElemen = Field(default_factory=FormatElemen, title="Teks isi (paragraf)")
    judul_tabel: FormatElemen = Field(default_factory=FormatElemen, title="Judul tabel")
    isi_tabel: FormatElemen = Field(default_factory=FormatElemen, title="Isi tabel")
    judul_gambar: FormatElemen = Field(default_factory=FormatElemen, title="Judul gambar")
    sumber: FormatElemen = Field(default_factory=FormatElemen, title="Keterangan sumber tabel/gambar")
    daftar_pustaka: FormatElemen = Field(default_factory=FormatElemen, title="Daftar pustaka")


class TataLetak(_Dasar):
    lebar_kertas_cm: Optional[float] = Field(None, title="Lebar kertas (cm)", description="A4 = 21")
    tinggi_kertas_cm: Optional[float] = Field(None, title="Tinggi kertas (cm)", description="A4 = 29,7")
    orientasi: Optional[Literal["potret", "lanskap"]] = Field(None, title="Orientasi")
    margin_atas_cm: Optional[float] = Field(None, title="Margin atas (cm)")
    margin_bawah_cm: Optional[float] = Field(None, title="Margin bawah (cm)")
    margin_kiri_cm: Optional[float] = Field(None, title="Margin kiri (cm)")
    margin_kanan_cm: Optional[float] = Field(None, title="Margin kanan (cm)")
    kolom_bagian_depan: Optional[int] = Field(None, title="Jumlah kolom bagian depan", description="Judul s.d. kata kunci")
    kolom_isi: Optional[int] = Field(None, title="Jumlah kolom isi naskah")
    toleransi_cm: float = Field(0.1, title="Toleransi ukuran (cm)")


class Bagian(_Dasar):
    judul: str = Field(..., title="Judul bagian")
    alias: list[str] = Field(default_factory=list, title="Nama lain yang dianggap sama")
    wajib: bool = Field(True, title="Wajib ada")
    sub_bagian: list[str] = Field(default_factory=list, title="Subbagian wajib")


class Struktur(_Dasar):
    bagian: list[Bagian] = Field(default_factory=list, title="Bagian naskah (urut)")
    cek_urutan: bool = Field(True, title="Cek urutan bagian")
    nama_harus_sama: bool = Field(True, title="Judul bagian harus sama persis dengan template")
    penomoran_judul: Optional[Literal["wajib", "dilarang"]] = Field(
        None, title="Penomoran judul bagian & subjudul", description="wajib: 1., 2.1 ... | dilarang: tanpa nomor"
    )


class AturanJudul(_Dasar):
    min_kata: Optional[int] = Field(None, title="Minimal kata judul")
    maks_kata: Optional[int] = Field(None, title="Maksimal kata judul")
    judul_inggris: Optional[Literal["wajib", "opsional", "tidak_boleh"]] = Field(None, title="Judul bahasa Inggris")
    maks_kata_inggris: Optional[int] = Field(None, title="Maksimal kata judul Inggris")
    tanpa_singkatan: Optional[bool] = Field(None, title="Judul tanpa singkatan")


class AturanPenulis(_Dasar):
    wajib_email: Optional[bool] = Field(None, title="Email penulis wajib dicantumkan")
    wajib_orcid: Optional[bool] = Field(None, title="ORCID penulis wajib dicantumkan")


class AturanAbstrak(_Dasar):
    wajib: bool = Field(True, title="Abstrak wajib ada")
    min_kata: Optional[int] = Field(None, title="Minimal kata")
    maks_kata: Optional[int] = Field(None, title="Maksimal kata")
    satu_paragraf: Optional[bool] = Field(None, title="Harus satu paragraf")
    abstrak_inggris: Literal["wajib", "opsional", "tidak_boleh"] = Field("opsional", title="Abstract bahasa Inggris")
    min_kata_inggris: Optional[int] = Field(None, title="Minimal kata abstract Inggris")
    maks_kata_inggris: Optional[int] = Field(None, title="Maksimal kata abstract Inggris")
    tanpa_sitasi: Optional[bool] = Field(None, title="Abstrak tanpa sitasi")


class AturanKataKunci(_Dasar):
    wajib: bool = Field(True, title="Kata kunci wajib ada")
    min_jumlah: Optional[int] = Field(None, title="Minimal jumlah kata kunci")
    maks_jumlah: Optional[int] = Field(None, title="Maksimal jumlah kata kunci")
    pemisah: Optional[Literal[";", ","]] = Field(None, title="Tanda pemisah")
    huruf_kecil: Optional[bool] = Field(None, title="Ditulis huruf kecil (kecuali singkatan)")


class AturanParagraf(_Dasar):
    min_kalimat: Optional[int] = Field(None, title="Minimal kalimat per paragraf")
    maks_kalimat: Optional[int] = Field(None, title="Maksimal kalimat per paragraf")


class AturanNaskah(_Dasar):
    min_kata: Optional[int] = Field(None, title="Minimal kata naskah", description="Tanpa daftar pustaka & isi tabel")
    maks_kata: Optional[int] = Field(None, title="Maksimal kata naskah")
    min_halaman: Optional[int] = Field(None, title="Minimal halaman", description="Menurut metadata Word (perkiraan)")
    maks_halaman: Optional[int] = Field(None, title="Maksimal halaman")
    kata_terlarang: list[str] = Field(default_factory=list, title="Kata yang tidak boleh dipakai", description="mis. saya, kami")
    cek_sisa_petunjuk: bool = Field(True, title="Cek sisa petunjuk template yang belum dihapus")
    bahasa: Optional[Literal["indonesia", "inggris"]] = Field(None, title="Bahasa naskah")
    naskah_bersih: bool = Field(
        True, title="Naskah bersih", description="Tanpa track changes, komentar lama, dan sorotan (highlight)"
    )
    teks_hitam: Optional[bool] = Field(None, title="Teks harus berwarna hitam", description="Tautan tidak ikut dicek")
    catatan_kaki_dilarang: Optional[bool] = Field(None, title="Catatan kaki (footnote) tidak diperbolehkan")
    cek_spasi_ganda: bool = Field(True, title="Cek spasi ganda antarkata")
    cek_baris_kosong: bool = Field(True, title="Cek baris kosong berturut-turut")


class AturanTabelGambar(_Dasar):
    posisi_judul_tabel: Optional[Literal["atas", "bawah"]] = Field(None, title="Posisi judul tabel")
    posisi_judul_gambar: Optional[Literal["atas", "bawah"]] = Field(None, title="Posisi judul gambar")
    wajib_dirujuk: bool = Field(True, title="Tabel/gambar wajib dirujuk di teks")
    penomoran_berurutan: bool = Field(True, title="Penomoran harus berurutan")
    wajib_judul: bool = Field(True, title="Setiap tabel/gambar wajib punya judul")
    garis_tabel: Optional[Literal["horizontal", "grid", "tanpa_garis"]] = Field(
        None, title="Pola garis tabel", description="Diambil dari contoh tabel di template"
    )
    perataan_tabel: Optional[Literal["tengah", "kiri"]] = Field(None, title="Perataan tabel di halaman")
    tabel_selebar_halaman: Optional[bool] = Field(None, title="Lebar tabel mengikuti lebar halaman (AutoFit Window)")
    cek_lebar_objek: bool = Field(True, title="Tabel/gambar tidak boleh melewati margin")
    tabel_bukan_gambar: bool = Field(True, title="Tabel harus berupa tabel Word, bukan gambar")
    wajib_sumber: Optional[bool] = Field(None, title="Tabel/gambar wajib diberi keterangan sumber")
    perataan_gambar: Optional[Literal["tengah", "kiri"]] = Field(None, title="Perataan gambar")
    gambar_sebaris: Optional[bool] = Field(None, title="Gambar harus “In Line with Text”")
    min_dpi_gambar: Optional[int] = Field(None, title="Resolusi gambar minimal (dpi)")
    persamaan_editor: Optional[bool] = Field(None, title="Persamaan ditulis dengan Equation Editor (bukan gambar)")


class AturanReferensi(_Dasar):
    wajib: bool = Field(True, title="Daftar pustaka wajib ada")
    min_jumlah: Optional[int] = Field(None, title="Minimal jumlah referensi")
    rentang_tahun: Optional[int] = Field(None, title="Referensi mutakhir = terbit dalam N tahun terakhir")
    persen_mutakhir: Optional[float] = Field(None, title="Minimal persentase referensi mutakhir (%)")
    gaya_sitasi: Literal["otomatis", "penulis_tahun", "numerik"] = Field(
        "otomatis", title="Gaya sitasi", description="penulis_tahun: (Nama, 2020) | numerik: [1]"
    )
    urutan: Optional[Literal["abjad", "kemunculan"]] = Field(None, title="Urutan daftar pustaka")
    cek_kecocokan_sitasi: bool = Field(True, title="Cek sitasi di teks ↔ daftar pustaka")
    manajer_referensi: Optional[Literal["wajib", "disarankan"]] = Field(
        None, title="Aplikasi manajemen referensi", description="Mendeley, Zotero, EndNote, atau fitur sitasi Word"
    )
    wajib_doi: Optional[bool] = Field(None, title="Referensi mencantumkan DOI")
    persen_sumber_primer: Optional[float] = Field(
        None, title="Minimal persentase sumber primer (%)", description="Jurnal atau prosiding; dihitung perkiraan"
    )
    sumber_terlarang: list[str] = Field(
        default_factory=list, title="Sumber yang tidak boleh dirujuk", description="mis. wikipedia, blog"
    )


class AturanNaratif(_Dasar):
    bagian: str = Field("Seluruh naskah", title="Berlaku untuk bagian")
    aturan: str = Field(..., title="Aturan")
    aktif: bool = Field(True, title="Aktif")


class PengaturanKomentar(_Dasar):
    nama_pemeriksa: str = Field(
        "AutoJurnal", title="Nama pemeriksa cadangan",
        description="Di web, komentar memakai nama akun yang login; nilai ini hanya untuk CLI"
    )
    maks_komentar_per_masalah: int = Field(
        3, title="Maks. komentar untuk masalah yang sama", description="Sisanya diringkas agar tidak membanjiri naskah"
    )
    tulis_saran: bool = Field(
        False, title="Tulis temuan SARAN ke naskah Word",
        description="Bila mati, temuan saran hanya tampil di web; naskah hanya berisi pelanggaran wajib (dan hasil AI bila dipakai)",
    )
    label_kategori: bool = Field(
        False, title="Awali komentar dengan label [WAJIB · Kategori]",
        description="Bila mati, komentar langsung berisi pesannya saja",
    )


class AturanScope(_Dasar):
    fokus_dan_ruang_lingkup: str = Field(
        "", title="Focus & Scope jurnal",
        description="Tempel apa adanya dari halaman Focus and Scope situs jurnal (paragraf maupun daftar bidang)",
        json_schema_extra={"format": "textarea"},
    )
    cek_ai: bool = Field(True, title="Nilai kesesuaian naskah dengan scope (AI) dan beri putusan terima/tolak")


class Profil(_Dasar):
    scope: AturanScope = Field(default_factory=AturanScope, title="Focus & Scope",
                               description="Dipakai AI untuk memutuskan naskah diterima/ditolak dari sisi ruang lingkup")
    tata_letak: TataLetak = Field(default_factory=TataLetak, title="Tata letak halaman")
    format: FormatPerElemen = Field(default_factory=FormatPerElemen, title="Format per elemen")
    struktur: Struktur = Field(default_factory=Struktur, title="Struktur naskah")
    judul: AturanJudul = Field(default_factory=AturanJudul, title="Judul")
    penulis: AturanPenulis = Field(default_factory=AturanPenulis, title="Penulis")
    abstrak: AturanAbstrak = Field(default_factory=AturanAbstrak, title="Abstrak")
    kata_kunci: AturanKataKunci = Field(default_factory=AturanKataKunci, title="Kata kunci")
    paragraf: AturanParagraf = Field(default_factory=AturanParagraf, title="Paragraf")
    naskah: AturanNaskah = Field(default_factory=AturanNaskah, title="Naskah keseluruhan")
    tabel_gambar: AturanTabelGambar = Field(default_factory=AturanTabelGambar, title="Tabel & gambar")
    referensi: AturanReferensi = Field(default_factory=AturanReferensi, title="Referensi & sitasi")
    aturan_naratif: list[AturanNaratif] = Field(
        default_factory=list, title="Aturan naratif (dicek AI)", description="Aturan isi yang butuh pemahaman, mis. 'abstrak memuat tujuan, metode, hasil'"
    )
    komentar: PengaturanKomentar = Field(default_factory=PengaturanKomentar, title="Komentar")
    catatan_ekstraksi: list[str] = Field(default_factory=list, title="Catatan hasil pembacaan template")
    # kalimat komentar kustom {kode katalog: kalimat}; diatur di menu Komentar, bukan di form profil
    teks_komentar: dict[str, str] = Field(default_factory=dict, title="Kalimat komentar kustom")


def skema_json() -> dict:
    skema = Profil.model_json_schema()
    skema["properties"].pop("teks_komentar", None)
    return skema
