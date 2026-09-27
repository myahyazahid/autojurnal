"""Daftar pustaka & sitasi: jumlah, kemutakhiran, urutan, dan kecocokan sitasi <-> daftar pustaka."""
from __future__ import annotations

import datetime as _dt
import re
from dataclasses import dataclass, field

from . import teks as T
from .docmodel import DocModel, Para
from .profil import Profil
from .temuan import Temuan

RX_TAHUN = re.compile(r"\b(19[5-9]\d|20[0-4]\d)[a-z]?\b")
RX_SITASI_NUM = re.compile(r"\[(\s*\d{1,3}(?:\s*[-–,;]\s*\d{1,3})*\s*)\]")
# "[1] ...", "1. ...", "1) ..." — tapi bukan potongan DOI seperti "10.33557/..."
RX_AWALAN_NUM = re.compile(r"^\s*(?:\[(\d{1,3})\]\s*|(\d{1,3})[.)](?:\s+|\t)(?!\d))")
RX_KURUNG = re.compile(r"\(([^()]*?\b(?:19|20)\d{2}[a-z]?\b[^()]*)\)")
RX_NARATIF = re.compile(
    r"(?P<nama>[A-Z][A-Za-zÀ-ÿ'’\-]+(?:\s+(?:et\.? al\.?|dkk\.?|&|dan|and)(?:\s+[A-Z][A-Za-zÀ-ÿ'’\-]+)?)?)"
    r"\s*\((?P<tahun>(?:19|20)\d{2})[a-z]?(?:\s*[,:;][^)]*)?\)"
)
_BUKAN_NAMA = {
    "tahun", "pada", "sejak", "hingga", "sampai", "periode", "bulan", "dalam", "menurut", "tanggal", "the",
    "in", "on", "since", "year", "mei", "juni", "juli", "januari", "februari", "maret", "april", "agustus",
    "september", "oktober", "november", "desember", "semester", "triwulan", "edisi", "revisi", "versi",
}


@dataclass
class Entri:
    paras: list[Para]
    teks: str
    nomor: int
    tahun: int | None = None
    penulis: str = ""  # bagian teks sebelum tahun (huruf kecil, tanpa aksen)
    kunci: str = ""  # untuk urut abjad
    disitasi: bool = False


@dataclass
class Sitasi:
    para: Para
    teks: str
    nama: list[str] = field(default_factory=list)
    tahun: int | None = None
    nomor: list[int] = field(default_factory=list)


def _norm(s: str) -> str:
    return T.tanpa_aksen(s).lower()


def _perluas(s: str) -> list[int]:
    hasil: list[int] = []
    for bagian in re.split(r"[,;]", s):
        bagian = bagian.strip()
        m = re.match(r"(\d+)\s*[-–]\s*(\d+)$", bagian)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if 0 < a <= b and b - a < 50:
                hasil.extend(range(a, b + 1))
        elif bagian.isdigit():
            hasil.append(int(bagian))
    return hasil


def entri_pustaka(dm: DocModel, numerik: bool) -> list[Entri]:
    paras = [p for p in dm.paras if p.peran == "daftar_pustaka" and not p.kosong]
    entri: list[Entri] = []
    otomatis = sum(1 for p in paras if p.pp_nilai("bernomor")) > len(paras) / 2
    if numerik and not otomatis and paras:
        # profil numerik tapi daftar pustaka tidak bernomor sama sekali -> perlakukan per paragraf
        numerik = sum(1 for p in paras if RX_AWALAN_NUM.match(p.bersih)) >= len(paras) * 0.3
    for p in paras:
        m = RX_AWALAN_NUM.match(p.bersih)
        if otomatis:  # daftar bernomor otomatis Word: paragraf tanpa nomor = sambungan entri sebelumnya
            awal_baru = bool(p.pp_nilai("bernomor"))
            m = None
        else:
            awal_baru = bool(m) or not numerik
        if not numerik and entri and not RX_TAHUN.search(p.bersih) and p.kata < 8:
            awal_baru = False
        if awal_baru or not entri:
            nomor = int(m.group(1) or m.group(2)) if m else len(entri) + 1
            entri.append(Entri(paras=[p], teks=p.bersih[m.end():] if m else p.bersih, nomor=nomor))
        else:
            entri[-1].paras.append(p)
            entri[-1].teks += " " + p.bersih
    batas = _dt.date.today().year + 1
    for e in entri:
        tahun = [(int(x.group(1)), x.start()) for x in RX_TAHUN.finditer(e.teks) if int(x.group(1)) <= batas]
        if tahun:
            kurung = re.search(r"\((19|20)\d{2}[a-z]?\)", e.teks)
            if kurung and not numerik:
                e.tahun, posisi = int(kurung.group(0)[1:5]), kurung.start()
            else:
                e.tahun, posisi = tahun[-1] if numerik else tahun[0]
            e.penulis = _norm(e.teks[:posisi])
        else:
            e.penulis = _norm(e.teks[:80])
        kata = re.findall(r"[A-Za-zÀ-ÿ]+", T.tanpa_aksen(e.teks))
        e.kunci = (kata[0].lower() if kata else "")
    return entri


def _paragraf_isi(dm: DocModel) -> list[Para]:
    return [
        p for p in dm.paras
        if not p.kosong and p.peran in ("teks_isi", "judul_tabel", "judul_gambar", "sumber", "isi_tabel", "sub_judul")
    ]


def sitasi_numerik(dm: DocModel) -> list[Sitasi]:
    hasil = []
    for p in _paragraf_isi(dm):
        for m in RX_SITASI_NUM.finditer(p.bersih):
            nomor = _perluas(m.group(1))
            if nomor:
                hasil.append(Sitasi(para=p, teks=m.group(0), nomor=nomor))
    return hasil


def _nama_dari(bagian: str) -> list[str]:
    bagian = re.sub(r"\b(et\.? al\.?|dkk\.?)", " ", bagian)
    pertama = re.split(r"\s+(?:&|dan|and)\s+|,", bagian)[0]
    return [_norm(w) for w in re.findall(r"[A-Za-zÀ-ÿ'’\-]{2,}", pertama) if _norm(w) not in _BUKAN_NAMA]


def sitasi_penulis_tahun(dm: DocModel) -> list[Sitasi]:
    hasil = []
    for p in _paragraf_isi(dm):
        t = p.bersih
        for m in RX_KURUNG.finditer(t):
            for bagian in re.split(r";", m.group(1)):
                mm = re.match(
                    r"\s*(?:(?:lihat|see|cf\.|e\.g\.,?|dalam|in)\s+)?(?P<nama>[^\d()]+?)\s*,?\s*(?P<tahun>(?:19|20)\d{2})[a-z]?",
                    bagian,
                )
                if not mm or not re.search(r"[A-Za-z]{2,}", mm.group("nama")):
                    continue
                nama = _nama_dari(mm.group("nama"))
                if nama:
                    hasil.append(Sitasi(para=p, teks=bagian.strip(), nama=nama, tahun=int(mm.group("tahun"))))
        for m in RX_NARATIF.finditer(t):
            nama = _nama_dari(m.group("nama"))
            if nama:
                hasil.append(Sitasi(para=p, teks=m.group(0), nama=nama, tahun=int(m.group("tahun"))))
    return hasil


def cek_referensi(dm: DocModel, prof: Profil) -> list[Temuan]:
    ref = prof.referensi
    out: list[Temuan] = []
    K = "Referensi"
    num = sitasi_numerik(dm)
    ay = sitasi_penulis_tahun(dm)
    terdeteksi = "numerik" if len(num) > len(ay) else ("penulis_tahun" if ay else None)
    gaya = ref.gaya_sitasi if ref.gaya_sitasi != "otomatis" else (terdeteksi or "penulis_tahun")
    # kecocokan sitasi dicek memakai gaya yang benar-benar dipakai naskah; beda gaya dilaporkan terpisah
    numerik = (terdeteksi or gaya) == "numerik"
    entri = entri_pustaka(dm, numerik)
    judul_pustaka = next((p for p in dm.paras if p.peran == "judul_bagian" and T.adalah_daftar_pustaka(T.normalisasi_judul(p.bersih))), None)
    jangkar = judul_pustaka.i if judul_pustaka else None

    if not entri:
        if ref.wajib:
            out.append(Temuan(K, "Daftar pustaka tidak ditemukan (atau judul bagiannya tidak dikenali).", para=jangkar))
        return out

    if ref.gaya_sitasi != "otomatis" and terdeteksi and terdeteksi != ref.gaya_sitasi:
        contoh = "[1]" if ref.gaya_sitasi == "numerik" else "(Nama, 2020)"
        nyata = "numerik [1]" if terdeteksi == "numerik" else "nama-tahun (Nama, 2020)"
        out.append(Temuan(K, f"Gaya sitasi di naskah tampak {nyata}, sedangkan template meminta gaya {contoh}.", para=jangkar))

    n = len(entri)
    if ref.min_jumlah and n < ref.min_jumlah:
        out.append(Temuan(K, f"Jumlah referensi {n}, minimal {ref.min_jumlah}.", para=jangkar))

    bertahun = [e for e in entri if e.tahun]
    if ref.rentang_tahun and ref.persen_mutakhir and bertahun:
        kini = _dt.date.today().year
        batas = kini - ref.rentang_tahun + 1
        baru = sum(1 for e in bertahun if e.tahun >= batas)
        persen = baru * 100 / len(bertahun)
        if persen + 1e-9 < ref.persen_mutakhir:
            out.append(Temuan(
                K,
                f"Referensi mutakhir ({batas}–{kini}) baru {baru} dari {len(bertahun)} ({T.angka(round(persen, 1))}%); "
                f"minimal {T.angka(ref.persen_mutakhir)}%.",
                para=jangkar,
            ))
    for e in entri:
        if e.tahun is None and not re.search(r"n\.d\.|t\.t\.|tanpa tahun", e.teks, re.I):
            out.append(Temuan(K, "Tahun terbit referensi ini tidak terbaca.", tingkat="saran", para=e.paras[0].i, kelompok="ref.tanpa_tahun"))

    if ref.urutan == "abjad" and not numerik:
        for a, b in zip(entri, entri[1:]):
            if b.kunci and a.kunci and b.kunci < a.kunci:
                out.append(Temuan(
                    K, f"Daftar pustaka belum urut abjad: “{b.kunci.title()}” seharusnya sebelum “{a.kunci.title()}”.",
                    para=b.paras[0].i, kelompok="ref.abjad",
                ))

    if not ref.cek_kecocokan_sitasi:
        return out

    if numerik:
        nomor_ada = {e.nomor for e in entri}
        maks_lihat = 0
        dilaporkan_urutan = 0
        for s in num:
            for x in s.nomor:
                if x not in nomor_ada:
                    out.append(Temuan(K, f"Sitasi [{x}] tidak ada di daftar pustaka (hanya {n} referensi).", para=s.para.i, kelompok="ref.sitasi_hilang"))
                if ref.urutan == "kemunculan" and x > maks_lihat + 1 and dilaporkan_urutan < 3:
                    out.append(Temuan(
                        K, f"Urutan sitasi: [{x}] muncul sebelum [{maks_lihat + 1}]. Nomor sitasi harus berurutan sesuai kemunculan.",
                        tingkat="saran", para=s.para.i, kelompok="ref.urutan_num",
                    ))
                    dilaporkan_urutan += 1
                maks_lihat = max(maks_lihat, x)
        dikutip = {x for s in num for x in s.nomor}
        for e in entri:
            if e.nomor not in dikutip:
                out.append(Temuan(K, f"Referensi [{e.nomor}] tidak pernah disitasi di naskah.", tingkat="saran", para=e.paras[0].i, kelompok="ref.tidak_disitasi"))
    else:
        for s in ay:
            cocok = [e for e in entri if e.tahun == s.tahun and any(nm in e.penulis for nm in s.nama)]
            for e in cocok:
                e.disitasi = True
            if not cocok:
                out.append(Temuan(
                    K, f"Sitasi “{s.teks}” tidak ditemukan padanannya di daftar pustaka (cek nama/tahun).",
                    tingkat="saran", para=s.para.i, kelompok="ref.sitasi_hilang",
                ))
        if ay:
            for e in entri:
                if not e.disitasi:
                    out.append(Temuan(K, "Referensi ini tidak ditemukan sitasinya di naskah.", tingkat="saran", para=e.paras[0].i, kelompok="ref.tidak_disitasi"))
    return out
