"""Kebersihan naskah: revisi terlacak, komentar lama, sorotan, warna teks, spasi ganda,
baris kosong beruntun, catatan kaki, dan bahasa naskah."""
from __future__ import annotations

import colorsys
import re
from collections import Counter

from . import katalog as KT
from . import teks as T
from .docmodel import DocModel, Para
from .profil import Profil
from .temuan import Temuan

K = "Naskah"
PERAN_ELEMEN = {
    "judul": "judul", "judul_inggris": "judul_inggris", "info_penulis": "info_penulis", "abstrak": "abstrak",
    "abstrak_inggris": "abstrak_inggris", "kata_kunci": "kata_kunci", "kata_kunci_inggris": "kata_kunci",
    "judul_bagian": "judul_bagian", "sub_judul": "sub_judul", "teks_isi": "teks_isi", "judul_tabel": "judul_tabel",
    "judul_gambar": "judul_gambar", "sumber": "sumber", "daftar_pustaka": "daftar_pustaka",
}
PERAN_SPASI = {"judul", "judul_inggris", "abstrak", "abstrak_inggris", "kata_kunci", "kata_kunci_inggris",
               "judul_bagian", "sub_judul", "teks_isi", "judul_tabel", "judul_gambar", "daftar_pustaka"}
NAMA_SOROT = {
    "yellow": "kuning", "green": "hijau", "cyan": "biru muda", "magenta": "merah muda", "blue": "biru", "red": "merah",
    "darkBlue": "biru tua", "darkCyan": "hijau kebiruan", "darkGreen": "hijau tua", "darkMagenta": "ungu",
    "darkRed": "merah tua", "darkYellow": "kuning tua", "darkGray": "abu-abu tua", "lightGray": "abu-abu muda",
    "black": "hitam", "white": "putih",
}
RX_SPASI_GANDA = re.compile(r"(\S+)[  ]{2,}(\S+)")
RX_URL = re.compile(r"https?://|www\.|doi\.org|@", re.I)
_XP_REVISI = (
    ".//*[local-name()='ins' or local-name()='del' or local-name()='moveFrom' or local-name()='moveTo'"
    " or local-name()='rPrChange' or local-name()='pPrChange' or local-name()='tblPrChange'"
    " or local-name()='trPrChange' or local-name()='tcPrChange' or local-name()='sectPrChange']"
)


def _rgb(hexa: str) -> tuple[int, int, int] | None:
    if not re.fullmatch(r"[0-9A-Fa-f]{6}", hexa or ""):
        return None
    return int(hexa[:2], 16), int(hexa[2:4], 16), int(hexa[4:], 16)


def hitam(warna: str | None) -> bool:
    """Hitam atau nyaris hitam (abu-abu sangat gelap juga dianggap hitam)."""
    if not warna or warna.lower() == "auto":
        return True
    if warna.startswith("tema:"):
        return warna[5:] in ("text1", "dark1", "tx1")
    rgb = _rgb(warna)
    return rgb is None or max(rgb) <= 0x40


def nama_warna(warna: str) -> str:
    if warna.startswith("tema:"):
        return f"warna tema {warna[5:]}"
    rgb = _rgb(warna)
    if rgb is None:
        return warna
    h, l, _ = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    if max(rgb) - min(rgb) < 30:
        nama = "putih" if l >= 0.9 else "abu-abu"
    else:
        derajat = h * 360
        nama = next(n for batas, n in ((15, "merah"), (45, "oranye"), (70, "kuning"), (170, "hijau"),
                                       (260, "biru"), (300, "ungu"), (345, "merah muda"), (361, "merah")) if derajat < batas)
    return f"{nama} (#{warna.upper()})"


def sorot_nyata(sorot: str) -> bool:
    """Sorotan yang terlihat. Latar putih atau nyaris putih dari teks salinan web tidak dihitung."""
    if sorot in ("none", "", "white"):
        return False
    rgb = _rgb(sorot.lstrip("#"))
    return rgb is None or min(rgb) < 0xE6


def _para_dari(dm: DocModel):
    indeks = {p.el: p for p in dm.paras}

    def cari(el) -> Para | None:
        for a in [el, *el.iterancestors()]:
            if a in indeks:
                return indeks[a]
        return None

    return cari


def _nama_elemen(prof: Profil, peran: str) -> str:
    return type(prof.format).model_fields[PERAN_ELEMEN[peran]].title


def cek_kebersihan(dm: DocModel, prof: Profil) -> list[Temuan]:
    an, out = prof.naskah, []
    tm = lambda kode, **kw: KT.temuan(prof, K, kode, **kw)  # noqa: E731
    body = dm.doc.element.body
    para_dari = _para_dari(dm)

    if an.naskah_bersih:
        revisi = body.xpath(_XP_REVISI)
        if revisi:
            p = next((x for x in map(para_dari, revisi) if x is not None), None)
            out.append(tm("naskah.track_changes", para=p.i if p else None, jumlah=len(revisi)))
        komentar = body.xpath(".//*[local-name()='commentReference']")
        if komentar:
            p = para_dari(komentar[0])
            out.append(tm("naskah.komentar_lama", para=p.i if p else None, jumlah=len(komentar)))
        for p in dm.paras:
            sorot = Counter(r.sorot for r in p.runs if r.teks.strip() and sorot_nyata(r.sorot))
            if sorot:
                warna = sorot.most_common(1)[0][0]
                label = NAMA_SOROT.get(warna) or nama_warna(warna.lstrip("#"))
                out.append(tm("naskah.sorotan", para=p.i, kelompok="naskah.sorotan", aktual=label))

    if an.teks_hitam:
        for p in dm.paras:
            if p.peran not in PERAN_ELEMEN or p.kosong:
                continue
            warna: Counter = Counter()
            for r in p.runs:
                n = len(r.teks.strip())
                if n and not r.tautan and not RX_URL.search(r.teks) and not hitam(r.warna[0]):
                    warna[r.warna[0]] += n
            if sum(warna.values()) >= 3:
                w = warna.most_common(1)[0][0]
                out.append(tm("naskah.teks_berwarna", para=p.i, kelompok=f"naskah.warna.{PERAN_ELEMEN[p.peran]}.{w}",
                              elemen=_nama_elemen(prof, p.peran), aktual=nama_warna(w)))

    if an.cek_spasi_ganda:
        for p in dm.paras:
            if p.peran not in PERAN_SPASI or p.kosong:
                continue
            temu = RX_SPASI_GANDA.findall(p.teks)
            if temu:
                out.append(tm("naskah.spasi_ganda", para=p.i, kelompok="naskah.spasi_ganda", jumlah=len(temu),
                              sebelum=temu[0][0][-30:], sesudah=temu[0][1][:30]))

    if an.cek_baris_kosong:
        kosong, terakhir = 0, None
        for b in dm.blok:
            baris_kosong = isinstance(b, Para) and b.kosong and not b.ada_gambar and not b.ada_persamaan and not b.el.xpath(
                ".//*[local-name()='br'][@*[local-name()='type']='page'] | ./*[local-name()='pPr']/*[local-name()='sectPr']")
            if baris_kosong:
                kosong += 1
                continue
            # baris kosong sebelum heading yang memang diminta template (mis. 2 antar heading) bukan kesalahan
            izin = prof.struktur.baris_kosong_heading_beda or 0
            sebelum_heading = isinstance(b, Para) and b.peran in ("judul_bagian", "sub_judul")
            if kosong >= 2 and terakhir is not None and not (sebelum_heading and kosong <= izin):
                out.append(tm("naskah.baris_kosong", para=terakhir.i, kelompok="naskah.baris_kosong", jumlah=kosong))
            kosong = 0
            terakhir = b if isinstance(b, Para) and not b.kosong else (b.paras[-1] if not isinstance(b, Para) and b.paras else terakhir)

    if an.catatan_kaki_dilarang:
        catatan = body.xpath(".//*[local-name()='footnoteReference' or local-name()='endnoteReference']")
        if catatan:
            p = para_dari(catatan[0])
            out.append(tm("naskah.catatan_kaki", para=p.i if p else None, jumlah=len(catatan)))

    if an.bahasa:
        kata = re.findall(r"[a-z]+", " ".join(p.bersih for p in dm.paras if p.peran == "teks_isi").lower()[:60000])
        en = sum(k in T._EN for k in kata)
        idn = sum(k in T._ID for k in kata)
        nyata = "inggris" if en > 2 * idn else ("indonesia" if idn > 2 * en else None)
        if en + idn >= 50 and nyata and nyata != an.bahasa:
            jangkar = next((p.i for p in dm.paras if p.peran == "teks_isi" and not p.kosong), None)
            out.append(tm("naskah.bahasa", para=jangkar, aktual=f"{nyata.title()}", harapan=an.bahasa.title()))
    return out
