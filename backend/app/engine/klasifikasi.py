"""Menentukan PERAN tiap paragraf: judul, info_penulis, abstrak, kata_kunci, judul_bagian, sub_judul,
teks_isi, judul_tabel, isi_tabel, judul_gambar, gambar, sumber, daftar_pustaka, dst.

Heuristik sengaja memakai banyak sinyal (style, tebal, kapital, penomoran, nama bagian yang dikenal,
kedekatan dengan tabel/gambar) karena template dan naskah di lapangan jarang rapi memakai Styles.
"""
from __future__ import annotations

import re

from . import teks as T
from .docmodel import DocModel, Para, Tabel

LABEL_ABS_ID = re.compile(r"^\s*(abstrak|intisari)\b\s*[:.\-–—]?\s*", re.I)
LABEL_ABS_EN = re.compile(r"^\s*(abstract)\b\s*[:.\-–—]?\s*", re.I)
LABEL_KK_ID = re.compile(r"^\s*(kata[\s-]*kunci)\b\s*[:.\-–—]?\s*", re.I)
LABEL_KK_EN = re.compile(r"^\s*(key\s*-?\s*words?)\b\s*[:.\-–—]?\s*", re.I)
CAP_TABEL = re.compile(r"^\s*(tabel|table)\s+(\d+)\b", re.I)
CAP_GAMBAR = re.compile(r"^\s*(gambar|figure|fig\.|grafik|diagram|bagan|ilustrasi)\s+(\d+)\b", re.I)
SUMBER = re.compile(r"^\s*(sumber|source)\s*:", re.I)
_KATA_KERJA = re.compile(
    r"\b(menunjukkan|memperlihatkan|menjelaskan|menyajikan|merupakan|adalah|berikut|terlihat|dapat|"
    r"shows|presents|illustrates|depicts|is|are)\b",
    re.I,
)

PERAN_LABEL = {
    "judul": "Judul",
    "judul_inggris": "Judul (Inggris)",
    "info_penulis": "Info penulis",
    "label_abstrak": "Label abstrak",
    "abstrak": "Abstrak",
    "label_abstrak_inggris": "Label abstract",
    "abstrak_inggris": "Abstract",
    "kata_kunci": "Kata kunci",
    "kata_kunci_inggris": "Keywords",
    "depan_lain": "Bagian depan lain",
    "judul_bagian": "Judul bagian",
    "sub_judul": "Subjudul",
    "teks_isi": "Teks isi",
    "judul_tabel": "Judul tabel",
    "isi_tabel": "Isi tabel",
    "judul_gambar": "Judul gambar",
    "gambar": "Gambar",
    "sumber": "Sumber tabel/gambar",
    "persamaan": "Persamaan",
    "daftar_pustaka": "Daftar pustaka",
    "kosong": "Kosong",
    "petunjuk": "Petunjuk template",
}


def _level_style(p: Para) -> int | None:
    nm = (p.style_nama or "").lower()
    m = re.match(r"(heading|judul)\s*(\d)", nm)
    if m:
        return int(m.group(2))
    return p.pp_nilai("outline")


def _inti(teks: str) -> str:
    return T._NOMOR.sub("", teks.strip())


def _kandidat_judul(p: Para, dikenal: set[str]) -> tuple[int | None, bool]:
    """(level, dikenal?) bila paragraf tampak sebagai judul bagian/subjudul."""
    t = p.bersih.strip()
    if not t or p.dalam_tabel or p.ada_gambar:
        return None, False
    kata = T.hitung_kata(t)
    if kata == 0 or kata > 15:
        return None, False
    if CAP_TABEL.match(t) or CAP_GAMBAR.match(t) or SUMBER.match(t) or LABEL_KK_ID.match(t) or LABEL_KK_EN.match(t):
        return None, False
    norm = T.normalisasi_judul(t)
    if not norm:
        return None, False
    kenal = norm in dikenal or T.kanonik_bagian(norm) is not None
    _, lvl_nomor = T.nomor_judul(t)
    lvl_style = _level_style(p)
    inti = _inti(t)
    kapital = T.huruf_kapital_semua(inti) or (p.rasio("kapital") or 0) >= 0.9
    if lvl_style:
        # naskah hasil konversi PDF sering memberi "Heading 2" pada PENDAHULUAN, METODE, dst.
        if kenal and kapital and lvl_style > 1:
            return (lvl_nomor or 1), True
        return lvl_style, kenal
    if inti.rstrip().endswith((".", ",", ";", ":")) and not kenal:
        return None, False
    if re.search(r"[.!?]\s+\S", inti):
        return None, False
    tebal = (p.rasio("tebal") or 0) >= 0.9
    if kenal and kata <= 8:
        return (lvl_nomor or (1 if kapital else 0)), True  # 0 = tentukan dari konteks
    if tebal or (kapital and lvl_nomor):
        if lvl_nomor:
            return lvl_nomor, False
        return (1 if kapital else 2), False
    return None, False


def _objek_dekat(dm: DocModel, p: Para, jenis: str, jarak: int = 3) -> str | None:
    """'atas' bila keterangan berada di atas objeknya, 'bawah' bila di bawah objek."""

    def cocok(b) -> bool:
        if isinstance(b, Tabel):
            return (jenis == "tabel") != b.ada_gambar
        return jenis == "gambar" and b.ada_gambar

    def telusur(arah: int) -> bool:
        i, n = p.blok + arah, 0
        while 0 <= i < len(dm.blok) and n < jarak:
            b = dm.blok[i]
            if cocok(b):
                return True
            if isinstance(b, Para) and not b.kosong:
                n += 1
                if CAP_TABEL.match(b.bersih) or CAP_GAMBAR.match(b.bersih):
                    return False
            i += arah
        return False

    sesudah, sebelum = telusur(1), telusur(-1)
    if sesudah and sebelum:
        return "atas" if jenis == "tabel" else "bawah"
    return "atas" if sesudah else ("bawah" if sebelum else None)


def _tempel_petunjuk(dm: DocModel):
    """Paragraf yang isinya cuma petunjuk -> petunjuknya ditempel ke paragraf isi sebelumnya."""
    sebelumnya: Para | None = None
    for p in dm.paras:
        if p.kosong and p.petunjuk:
            p.peran = "petunjuk"
            if sebelumnya is not None:
                sebelumnya.petunjuk.extend(p.petunjuk)
        elif not p.kosong:
            sebelumnya = p


def klasifikasi(dm: DocModel, dikenal: set[str] | None = None) -> None:
    dikenal = dikenal or set()
    if dm.mode == "template":
        _tempel_petunjuk(dm)
    atas: list[Para] = [b for b in dm.blok if isinstance(b, Para)]
    kandidat = {p.i: _kandidat_judul(p, dikenal) for p in atas}

    # ---- batas bagian depan -------------------------------------------------
    isi = [p for p in atas if not p.kosong]
    if not isi:
        return
    judul = next((p for p in isi if not p.ada_gambar), isi[0])
    batas_cari = len(isi) * 0.6
    kk = [k for k, p in enumerate(isi) if k < batas_cari and (LABEL_KK_ID.match(p.bersih) or LABEL_KK_EN.match(p.bersih))]
    ab = [k for k, p in enumerate(isi) if k < batas_cari and (LABEL_ABS_ID.match(p.bersih) or LABEL_ABS_EN.match(p.bersih))]
    mulai = (kk[-1] + 1) if kk else ((ab[-1] + 1) if ab else isi.index(judul) + 1)

    def level1(p: Para) -> bool:
        lv, _ = kandidat[p.i]
        return lv == 1 or (lv == 0 and kandidat[p.i][1])

    calon = [p for p in isi[mulai:] if level1(p)]
    dikenal_calon = [p for p in calon if kandidat[p.i][1]]
    batas = (dikenal_calon or calon or [None])[0]
    batas_blok = batas.blok if batas is not None else (isi[mulai].blok if mulai < len(isi) else len(dm.blok))

    # ---- bagian depan ------------------------------------------------------
    keadaan = "judul"
    for p in atas:
        if p.blok >= batas_blok:
            break
        if p.kosong:
            p.peran = "petunjuk" if p.peran == "petunjuk" else ("gambar" if p.ada_gambar else "kosong")
            continue
        t = p.bersih
        for rx, peran_label, peran_isi, kondisi in (
            (LABEL_ABS_EN, "label_abstrak_inggris", "abstrak_inggris", "abstrak_en"),
            (LABEL_ABS_ID, "label_abstrak", "abstrak", "abstrak_id"),
            (LABEL_KK_EN, "kata_kunci_inggris", "kata_kunci_inggris", "setelah_kk"),
            (LABEL_KK_ID, "kata_kunci", "kata_kunci", "setelah_kk"),
        ):
            m = rx.match(t)
            if m:
                sisa = t[m.end():].strip()
                if peran_isi.startswith("kata_kunci") or T.hitung_kata(sisa) >= 5:
                    p.peran = peran_isi
                    p.label_inline = m.group(0).strip()
                else:
                    p.peran = peran_label
                keadaan = kondisi
                break
        else:
            if keadaan == "judul":
                if p is judul:
                    p.peran = "judul"
                    continue
                if _mirip_judul(p, judul):
                    p.peran = _jenis_judul(p, judul)
                    continue
                keadaan = "penulis"
            p.peran = {
                "penulis": "info_penulis",
                "abstrak_id": "abstrak",
                "abstrak_en": "abstrak_inggris",
                "setelah_kk": "depan_lain",
            }[keadaan]
    for t in dm.tabel:
        if t.blok < batas_blok:
            for p in t.paras:
                p.peran = "kosong" if p.kosong else "depan_lain"

    # ---- badan naskah --------------------------------------------------------
    l1_kanonik: str | None = None
    di_pustaka = False
    for b in dm.blok:
        if b.blok < batas_blok:
            continue
        if isinstance(b, Tabel):
            for p in b.paras:
                if p.kosong:
                    p.peran = "gambar" if p.ada_gambar else "kosong"
                elif di_pustaka:
                    p.peran = "daftar_pustaka"
                elif p.ada_gambar and p.kata <= 3:
                    p.peran = "gambar"
                elif b.ada_gambar and CAP_GAMBAR.match(p.bersih):
                    p.peran = "judul_gambar"
                    p.ext["posisi"] = "dalam_tabel"
                elif CAP_TABEL.match(p.bersih) and p.kata <= 30:
                    p.peran = "judul_tabel"
                    p.ext["posisi"] = "dalam_tabel"
                else:
                    p.peran = "isi_tabel_gambar" if b.ada_gambar else "isi_tabel"
            continue
        p = b
        if p.kosong:
            if p.peran != "petunjuk":
                p.peran = "gambar" if p.ada_gambar else "kosong"
            continue
        lv, kenal = kandidat[p.i]
        if lv is not None and not (di_pustaka and not kenal and lv != 1):
            norm = T.normalisasi_judul(p.bersih)
            kan = T.kanonik_bagian(norm)
            if lv == 0:  # bagian dikenal, bukan kapital: level 2 bila masih di bawah bagian yang sama
                lv = 2 if (l1_kanonik and kan == l1_kanonik) else 1
            if lv == 1:
                l1_kanonik = kan or norm
                di_pustaka = T.adalah_daftar_pustaka(norm) or (norm in dikenal and kan == "daftar pustaka")
            p.peran = "judul_bagian" if lv == 1 else "sub_judul"
            p.level = lv
            continue
        if di_pustaka:
            p.peran = "daftar_pustaka"
            continue
        t = p.bersih
        if p.ada_gambar and p.kata <= 3:
            p.peran = "gambar"
            continue
        m_t, m_g = CAP_TABEL.match(t), CAP_GAMBAR.match(t)
        if m_t or m_g:
            jenis = "tabel" if m_t else "gambar"
            posisi = _objek_dekat(dm, p, jenis)
            if posisi or (p.kata <= 25 and not _KATA_KERJA.search(t.split(".", 2)[-1][:80])):
                p.peran = "judul_tabel" if m_t else "judul_gambar"
                p.ext["nomor"] = int((m_t or m_g).group(2))
                p.ext["posisi"] = posisi
                continue
        if SUMBER.match(t) and p.kata <= 40:
            p.peran = "sumber"
            continue
        if p.ada_persamaan and p.kata <= 12:
            p.peran = "persamaan"
            continue
        p.peran = "teks_isi"


def _mirip_judul(p: Para, judul: Para) -> bool:
    if "@" in p.bersih or p.kata < 2:
        return False
    style_sama = p.style_id == judul.style_id and (judul.style_nama or "").lower() not in ("normal", "")
    if style_sama:
        return True
    inti = p.bersih
    miring = (p.rasio("miring") or 0) >= 0.8
    return T.huruf_kapital_semua(inti) or (miring and p.kata >= 4)


def _jenis_judul(p: Para, judul: Para) -> str:
    b_p, b_j = T.deteksi_bahasa(p.bersih), T.deteksi_bahasa(judul.bersih)
    if b_p == "en" and b_j != "en":
        return "judul_inggris"
    uk_p, uk_j = p.dominan("ukuran")[0], judul.dominan("ukuran")[0]
    if uk_p and uk_j and abs(uk_p - uk_j) >= 1:
        return "judul_inggris"
    if (p.rasio("miring") or 0) >= 0.8 and (judul.rasio("miring") or 0) < 0.5:
        return "judul_inggris"
    return "judul"
