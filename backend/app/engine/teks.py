"""Utilitas teks: hitung kata, kalimat, deteksi bahasa, petunjuk template, normalisasi judul bagian."""
from __future__ import annotations

import re
import unicodedata

# ---------------------------------------------------------------------------
# Kata & huruf


def hitung_kata(teks: str) -> int:
    return sum(1 for t in teks.split() if re.search(r"\w", t))


def huruf_kapital_semua(teks: str) -> bool:
    huruf = [c for c in teks if c.isalpha()]
    if len(huruf) < 3:
        return False
    return sum(c.isupper() for c in huruf) / len(huruf) >= 0.9


def tanpa_aksen(teks: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", teks) if not unicodedata.combining(c))


def angka(v: float | int | None, satuan: str = "") -> str:
    """Format angka gaya Indonesia: 1.5 -> '1,5'."""
    if v is None:
        return "-"
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = f"{v:.2f}".rstrip("0").rstrip(".") if isinstance(v, float) else str(v)
    s = s.replace(".", ",")
    return f"{s} {satuan}".strip()


# ---------------------------------------------------------------------------
# Kalimat

_SINGKATAN = {
    "dkk", "al", "dll", "dsb", "dst", "mis", "no", "nos", "hlm", "vol", "pp", "p", "dr", "drs", "prof",
    "ir", "st", "sp", "spd", "mpd", "msi", "mt", "skom", "mkom", "e.g", "i.e", "eg", "ie", "fig", "eq",
    "jl", "kab", "kec", "kel", "ed", "eds", "etc", "vs", "cf", "tbk", "ltd", "inc", "co", "tsb", "yth",
    "sdr", "bpk", "ny", "h", "hj", "rp", "no", "ps", "kep", "permen", "uu", "pasal",
}


def pecah_kalimat(teks: str) -> list[str]:
    t = re.sub(r"\s+", " ", teks).strip()
    if not t:
        return []
    t = re.sub(r"(\d)\.(\d)", "\\1\u2024\\2", t)  # lindungi angka desimal / penomoran 2.1
    bagian = re.split(r"(?<=[.!?])[\"”’)\]]?\s+(?=[\"“(\[]?[A-Z0-9])", t)
    hasil: list[str] = []
    for b in bagian:
        if hasil:
            akhir = re.search(r"([\w.]+)\.$", hasil[-1])
            token = akhir.group(1).lower() if akhir else ""
            if token and (token in _SINGKATAN or len(token.split(".")[-1]) == 1):
                hasil[-1] += " " + b
                continue
        hasil.append(b)
    return [h.replace("\u2024", ".") for h in hasil if re.search(r"\w", h)]


# ---------------------------------------------------------------------------
# Bahasa

_EN = set(
    "the of and in for on with to a an is are using based by from this that as at its into toward towards "
    "between among study analysis effect effects system decision support approach model evaluation "
    "implementation development design application impact role case".split()
)
_ID = set(
    "dan di yang untuk dengan pada dalam terhadap dari ini itu sebagai oleh berbasis analisis sistem "
    "penerapan pengaruh studi kasus menggunakan metode antara ke atau adalah tidak serta melalui "
    "pengembangan perancangan implementasi evaluasi peran dampak kabupaten kota".split()
)


def deteksi_bahasa(teks: str) -> str | None:
    kata = re.findall(r"[a-z]+", teks.lower())
    en = sum(k in _EN for k in kata)
    idn = sum(k in _ID for k in kata)
    if en == idn:
        return None
    return "en" if en > idn else "id"


# ---------------------------------------------------------------------------
# Petunjuk template, mis. "(font Times New Roman, 12 pt, Bold)" atau "[Center, Max 14 Kata]"

_KATA_PETUNJUK = (
    r"font|\bpt\b|poin|point|times|arial|calibri|cambria|bold|italic|tebal|miring|center|justif|kapital|"
    r"huruf|spasi|spacing|heading|\bmax\b|maks|\bkata\b|normal|margin|indent|diisi|dihapus|ditulis|"
    r"disesuaikan|korespondensi|subjudul|sub-judul|contoh|level|rata|editor|wajib|opsional"
)
_SEGMEN = re.compile(r"\[[^\[\]]{2,500}\]|\((?:[^()]|\([^()]*\)){2,500}\)")

# petunjuk yang pasti sisa template (lebih ketat, dipakai pada naskah)
_PETUNJUK_KUAT = re.compile(
    r"(times new roman|arial|calibri|cambria)\s*,?\s*\d|\d+\s*pt\b|\bfont\b|mohon dihapus|"
    r"heading level|\b(bold|italic)\b.*\b(center|justify)\b|\bmax(?:imal)?\.?\s*\d+\s*kata",
    re.I,
)


def pisah_petunjuk(teks: str) -> tuple[str, list[str]]:
    """Kembalikan (teks tanpa petunjuk, daftar petunjuk)."""
    petunjuk: list[str] = []

    def ganti(m: re.Match) -> str:
        seg = m.group(0)
        if re.search(_KATA_PETUNJUK, seg, re.I) and not re.fullmatch(r"[\[(]\s*\d+(\s*[-–,]\s*\d+)*\s*[\])]", seg):
            petunjuk.append(seg[1:-1].strip())
            return " "
        return seg

    bersih = _SEGMEN.sub(ganti, teks)
    bersih = re.sub(r"[ \t]+", " ", bersih)
    bersih = re.sub(r"\s*\n\s*", "\n", bersih).strip()
    return bersih, petunjuk


def sisa_petunjuk(teks: str) -> list[str]:
    return [m.group(0) for m in _SEGMEN.finditer(teks) if _PETUNJUK_KUAT.search(m.group(0))]


# ---------------------------------------------------------------------------
# Judul bagian

_NOMOR = re.compile(r"^\s*(?:(\d+(?:\.\d+)*)\.?|([IVXLC]+)[.)]|([A-Za-z])[.)]|\((\w{1,3})\))[\s\t]+")


def nomor_judul(teks: str) -> tuple[str | None, int | None]:
    """Kembalikan (nomor, level) bila judul diawali penomoran."""
    m = _NOMOR.match(teks)
    if not m:
        return None, None
    if m.group(1):
        return m.group(1), m.group(1).count(".") + 1
    if m.group(2):
        return m.group(2), 1
    return (m.group(3) or m.group(4)), 2


def normalisasi_judul(teks: str) -> str:
    t = _NOMOR.sub("", teks.strip())
    t = tanpa_aksen(t).lower()
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


ALIAS_BAGIAN: dict[str, list[str]] = {
    "pendahuluan": ["pendahuluan", "introduction", "latar belakang", "pengantar"],
    "tinjauan pustaka": [
        "tinjauan pustaka", "kajian pustaka", "kajian teori", "landasan teori", "literature review",
        "tinjauan literatur", "kerangka teori", "kajian literatur", "tinjauan teori",
    ],
    "metode": [
        "metode", "metode penelitian", "metodologi", "metodologi penelitian", "metode dan bahan",
        "bahan dan metode", "methods", "method", "methodology", "research method", "research methods",
        "materials and methods", "metode pelaksanaan", "metode pengabdian",
    ],
    "hasil dan pembahasan": [
        "hasil dan pembahasan", "hasil penelitian dan pembahasan", "results and discussion",
        "result and discussion", "hasil", "pembahasan", "results", "discussion",
    ],
    "kesimpulan": [
        "kesimpulan", "simpulan", "penutup", "kesimpulan dan saran", "simpulan dan saran", "conclusion",
        "conclusions", "conclusion and suggestion", "conclusions and recommendations",
    ],
    "ucapan terima kasih": [
        "ucapan terima kasih", "terima kasih", "acknowledgement", "acknowledgment", "acknowledgements",
    ],
    "daftar pustaka": [
        "daftar pustaka", "daftar rujukan", "referensi", "references", "reference", "rujukan",
        "bibliography", "pustaka", "daftar referensi", "kepustakaan", "daftar acuan",
    ],
    "lampiran": ["lampiran", "appendix", "appendices"],
}


def kanonik_bagian(teks_norm: str) -> str | None:
    for kunci, alias in ALIAS_BAGIAN.items():
        if teks_norm in alias:
            return kunci
    return None


def alias_untuk(judul: str) -> list[str]:
    k = kanonik_bagian(normalisasi_judul(judul))
    return list(ALIAS_BAGIAN[k]) if k else []


def adalah_daftar_pustaka(teks_norm: str) -> bool:
    return teks_norm in ALIAS_BAGIAN["daftar pustaka"]
