"""Membaca petunjuk format yang ditulis sebagai teks, mis. 'Times New Roman 11 Bold Center',
'font Times New Roman, 12 pt', 'spasi 1', 'paragraph-spacing-after: 6pt'."""
from __future__ import annotations

import re

FONT_DIKENAL = [
    "Times New Roman", "Arial", "Calibri", "Cambria", "Georgia", "Garamond", "Book Antiqua", "Tahoma",
    "Verdana", "Helvetica", "Century Gothic", "Bookman Old Style", "Palatino Linotype", "Segoe UI",
    "Candara", "Constantia", "Trebuchet MS", "Aptos",
]
_RX_FONT = re.compile("|".join(re.escape(f) for f in FONT_DIKENAL), re.I)
_ANGKA = r"(\d{1,2}(?:[.,]\d)?)"


def _f(s: str) -> float:
    return float(s.replace(",", "."))


def baca_format(teks: str) -> dict:
    """Ambil atribut format dari satu petunjuk. Kunci mengikuti FormatElemen + 'maks_kata'."""
    t = teks.strip()
    tl = t.lower()
    out: dict = {}
    m = _RX_FONT.search(t)
    if m:
        out["font"] = next(f for f in FONT_DIKENAL if f.lower() == m.group(0).lower())
        m2 = re.match(r"\s*,?\s*" + _ANGKA + r"\b(?!\s*(?:cm|mm|kata|word))", t[m.end():])
        if m2 and 6 <= _f(m2.group(1)) <= 28:
            out["ukuran_pt"] = _f(m2.group(1))
    if "ukuran_pt" not in out:
        for m in list(re.finditer(_ANGKA + r"\s*(?:pt|poin|point)\b", tl)) + list(
            re.finditer(r"ukuran(?: font| huruf)?\s*" + _ANGKA + r"\b", tl)
        ):
            konteks = tl[max(0, m.start() - 30): m.start()]
            if re.search(r"after|before|spacing|sebelum|sesudah|jarak|margin|header|footer|indent", konteks):
                continue
            if 6 <= _f(m.group(1)) <= 28:
                out["ukuran_pt"] = _f(m.group(1))
                break
    if re.search(r"\b(bold|tebal)\b", tl) and not re.search(r"(tidak|tanpa|non)[\s-]*(bold|tebal)", tl):
        out["tebal"] = True
    elif re.search(r"\bnormal\b", tl) or re.search(r"(tidak|tanpa|non)[\s-]*(bold|tebal)", tl):
        out["tebal"] = False
    if re.search(r"\b(italic|miring)\b", tl) and not re.search(r"(tidak|tanpa|non)[\s-]*(italic|miring)", tl):
        out["miring"] = True
    elif re.search(r"\bnormal\b", tl):
        out["miring"] = False
    if re.search(r"huruf besar kecil|title case|sentence case", tl):
        out["kapital"] = False
    elif re.search(r"\bkapital\b|huruf besar semua|all caps|uppercase|huruf kapital", tl):
        out["kapital"] = True
    if re.search(r"cent(er|re)[\s-]*justif", tl):
        out["perataan"] = "tengah"
    elif re.search(r"justif|rata kiri[\s-]*kanan|kiri[\s-]*kanan", tl):
        out["perataan"] = "rata_kanan_kiri"
    elif re.search(r"\bcent(er|re)\b|rata tengah|\btengah\b", tl):
        out["perataan"] = "tengah"
    elif re.search(r"rata kiri|\bleft\b", tl):
        out["perataan"] = "kiri"
    elif re.search(r"rata kanan|\bright\b", tl):
        out["perataan"] = "kanan"
    m = re.search(r"spasi\s*" + _ANGKA + r"(?!\s*(?:pt|cm))\b", tl) or re.search(_ANGKA + r"\s*spasi\b", tl)
    if m and 0.8 <= _f(m.group(1)) <= 3:
        out["spasi_baris"] = _f(m.group(1))
    elif re.search(r"(line[\s-]*spacing\s*:?\s*single|spasi\s*(single|tunggal))", tl):
        out["spasi_baris"] = 1.0
    elif re.search(r"spasi\s*ganda|double", tl):
        out["spasi_baris"] = 2.0
    m = re.search(r"after\s*-?\s*before\s*:?\s*" + _ANGKA, tl) or re.search(r"before\s*(?:and|dan)\s*after\s*:?\s*" + _ANGKA, tl)
    if m:
        out["spasi_sebelum_pt"] = out["spasi_sesudah_pt"] = _f(m.group(1))
    else:
        m = re.search(r"(?:spacing[\s-]*)?after\s*:?\s*" + _ANGKA + r"\s*pt", tl)
        if m:
            out["spasi_sesudah_pt"] = _f(m.group(1))
        m = re.search(r"(?:spacing[\s-]*)?before\s*:?\s*" + _ANGKA + r"\s*pt", tl)
        if m:
            out["spasi_sebelum_pt"] = _f(m.group(1))
    m = re.search(r"(?:max(?:imal|imum)?|maks(?:imal|imum)?)\.?\s*(\d{1,3})\s*(?:kata|words)", tl)
    if m:
        out["maks_kata"] = int(m.group(1))
    return out


# ---------------------------------------------------------------------------
# Kalimat instruksi -> sasaran elemen

SASARAN = [
    ("judul_tabel", r"judul tabel"),
    ("isi_tabel", r"isi tabel"),
    ("judul_gambar", r"(?:judul|keterangan) gambar"),
    ("daftar_pustaka", r"daftar (?:pustaka|rujukan|referensi)|penulisan (?:daftar )?(?:pustaka|rujukan)"),
    ("abstrak", r"^abstrak|\babstrak (?:ditulis|diketik)"),
    (
        "teks_isi",
        r"teks utama|isi naskah|isi artikel|badan naskah|bab selanjutnya|seluruh naskah|body text|"
        r"isi tulisan|naskah ditulis|tipe huruf",
    ),
]
_RX_ATRIBUT = re.compile(r"\bfont\b|\bpt\b|poin|spasi|justif|rata|times new roman|arial|calibri|ukuran huruf|tipe huruf")


def sasaran_kalimat(kalimat: str) -> list[str]:
    kl = kalimat.lower()
    if not _RX_ATRIBUT.search(kl):
        return []
    return [nama for nama, rx in SASARAN if re.search(rx, kl)]
