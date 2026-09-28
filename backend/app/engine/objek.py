"""Tabel, gambar, dan persamaan sebagai objek: pola garis, lebar, perataan, posisi melayang,
resolusi, keterangan sumber, dan persamaan yang disisipkan sebagai gambar."""
from __future__ import annotations

import re
from dataclasses import dataclass

from docx.image.image import Image as InfoGambar
from lxml import etree

from . import katalog as KT
from .docmodel import DocModel, Para, Tabel, _ada_figur, _GAMBAR, q
from .klasifikasi import CAP_GAMBAR, CAP_TABEL, SUMBER
from .profil import Profil
from .temuan import Temuan

K = "Tabel & Gambar"
TWIP_PER_CM = 567.0
EMU_PER_CM = 360000.0
SISI = ("top", "left", "bottom", "right", "insideH", "insideV")
_ALIAS_SISI = {"start": "left", "end": "right"}
_JC = {"center": "tengah", "left": "kiri", "start": "kiri", "right": "kanan", "end": "kanan", "both": "kiri"}
LABEL_POLA = {
    "grid": "grid penuh (garis horizontal dan vertikal)",
    "vertikal": "garis vertikal",
    "horizontal": "garis horizontal saja",
    "tanpa_garis": "format tanpa garis",
}
HARAPAN_POLA = {
    "horizontal": "garis horizontal saja, tanpa garis vertikal",
    "grid": "grid penuh (semua garis)",
    "tanpa_garis": "format tanpa garis",
}
LABEL_PERATAAN = {"tengah": "di tengah (center)", "kiri": "rata kiri", "kanan": "rata kanan"}
LABEL_BUNGKUS = {
    "wrapSquare": "Square", "wrapTight": "Tight", "wrapThrough": "Through", "wrapTopAndBottom": "Top and Bottom",
}
RX_SITASI_KETERANGAN = re.compile(r"\[\s*\d{1,3}(?:\s*[-–,;]\s*\d{1,3})*\s*\]|\([^()]*\b(?:19|20)\d{2}[a-z]?\)")
RX_NOMOR_PERSAMAAN = re.compile(r"\((\d{1,3})\)\s*$")
# keterangan tabel yang tegas: "Tabel 3." / "Tabel 3:" lalu satu kalimat judul
RX_KETERANGAN_TABEL = re.compile(r"^\s*(?:tabel|table)\s+\d+\s*[.:]\s*(?P<judul>.*)$", re.I)


def _angka(s: str | None) -> float | None:
    try:
        return float(s) if s is not None else None
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# lebar area teks


def lebar_teks_cm(dm: DocModel, idx: int) -> float | None:
    """Lebar area tulis (satu kolom) pada seksi ke-idx."""
    if not dm.seksi:
        return None
    s = dm.seksi[min(idx, len(dm.seksi) - 1)]
    if not s.page_width or s.left_margin is None or s.right_margin is None:
        return None
    lebar = s.page_width.cm - s.left_margin.cm - s.right_margin.cm
    cols = s._sectPr.find(q("cols"))
    n = dm.kolom_seksi(idx)
    if cols is not None and n > 1:
        kolom = [_angka(c.get(q("w"))) for c in cols.findall(q("col"))]
        if any(kolom):
            return max(k for k in kolom if k) / TWIP_PER_CM
        jarak = (_angka(cols.get(q("space"))) or 720) / TWIP_PER_CM
        lebar = (lebar - jarak * (n - 1)) / n
    return lebar


# ---------------------------------------------------------------------------
# tabel


def tabel_tata_letak(t: Tabel) -> bool:
    """Tabel yang dipakai untuk menata rumus/kotak, bukan tabel data."""
    baris = t.el.findall(q("tr"))
    kolom = max((len(r.findall(q("tc"))) for r in baris), default=0)
    if len(baris) < 2 or kolom < 2:
        return True
    sel = [p for p in t.paras if not p.kosong]
    if any(p.bersih.strip() == "=" for p in sel):
        return True
    rumus = sum(1 for p in sel if "=" in p.bersih or p.ada_persamaan)
    return bool(sel) and rumus / len(sel) >= 0.5


def tabel_data(t: Tabel) -> bool:
    """Tabel berisi data di badan naskah (bukan bagian depan, bukan wadah gambar/rumus)."""
    if t.ada_gambar or tabel_tata_letak(t):
        return False
    peran = {p.peran for p in t.paras if not p.kosong}
    return bool(peran) and not peran & {"depan_lain", "daftar_pustaka"}


def _border(el) -> dict[str, bool]:
    out: dict[str, bool] = {}
    if el is None:
        return out
    for c in el:
        sisi = etree.QName(c).localname
        sisi = _ALIAS_SISI.get(sisi, sisi)
        if sisi in SISI:
            val = (c.get(q("val")) or "none").lower()
            putih = (c.get(q("color")) or "").upper() == "FFFFFF"
            out[sisi] = val not in ("none", "nil") and not putih
    return out


def _tblpr_style(dm: DocModel, t: Tabel) -> tuple[list, object]:
    """(rantai style tabel dari yang paling dasar, tblPr langsung)."""
    tblpr = t.el.find(q("tblPr"))
    st = tblpr.find(q("tblStyle")) if tblpr is not None else None
    sid = st.get(q("val")) if st is not None else None
    sid = sid if sid in dm.res.style else dm.res.default_tabel
    return dm.res.rantai(sid), tblpr


@dataclass
class Garis:
    vertikal_luar: bool
    vertikal_dalam: bool
    horizontal: int  # batas horizontal yang bergaris, termasuk tepi atas dan bawah
    batas: int  # jumlah batas horizontal = jumlah baris + 1

    @property
    def pola(self) -> str:
        vertikal = self.vertikal_luar or self.vertikal_dalam
        if not vertikal:
            return "horizontal" if self.horizontal else "tanpa_garis"
        if self.vertikal_dalam and self.horizontal >= self.batas - 1:
            return "grid"
        return "vertikal"


def garis_tabel(dm: DocModel, t: Tabel) -> Garis:
    """Garis efektif tabel: style (berantai) -> tblBorders langsung -> per baris -> per sel."""
    rantai, tblpr = _tblpr_style(dm, t)
    dasar: dict[str, bool] = {}
    for st in rantai:
        dasar.update(_border(st.find(f"{q('tblPr')}/{q('tblBorders')}")))
    if tblpr is not None:
        dasar.update(_border(tblpr.find(q("tblBorders"))))
    baris = t.el.findall(q("tr"))
    batas = [False] * (len(baris) + 1)
    v_luar = v_dalam = False
    for ri, tr in enumerate(baris):
        tb = dict(dasar)
        ex = tr.find(q("tblPrEx"))
        if ex is not None:
            tb.update(_border(ex.find(q("tblBorders"))))
        sel = tr.findall(q("tc"))
        for ci, tc in enumerate(sel):
            tcpr = tc.find(q("tcPr"))
            cb = _border(tcpr.find(q("tcBorders"))) if tcpr is not None else {}
            akhir = ci == len(sel) - 1
            atas = cb.get("top", tb.get("top" if ri == 0 else "insideH", False))
            bawah = cb.get("bottom", tb.get("bottom" if ri == len(baris) - 1 else "insideH", False))
            kiri = cb.get("left", tb.get("left" if ci == 0 else "insideV", False))
            kanan = cb.get("right", tb.get("right" if akhir else "insideV", False))
            batas[ri] = batas[ri] or atas
            batas[ri + 1] = batas[ri + 1] or bawah
            v_luar = v_luar or (ci == 0 and kiri) or (akhir and kanan)
            v_dalam = v_dalam or (ci > 0 and kiri) or (not akhir and kanan)
    return Garis(v_luar, v_dalam, sum(batas), len(batas))


def perataan_tabel(dm: DocModel, t: Tabel) -> str:
    rantai, tblpr = _tblpr_style(dm, t)
    nilai = None
    for st in rantai:
        jc = st.find(f"{q('tblPr')}/{q('jc')}")
        nilai = jc.get(q("val")) if jc is not None else nilai
    jc = tblpr.find(q("jc")) if tblpr is not None else None
    nilai = jc.get(q("val")) if jc is not None else nilai
    return _JC.get(nilai or "left", "kiri")


def lebar_tabel_cm(t: Tabel, teks_cm: float | None) -> tuple[float | None, bool]:
    """(lebar dalam cm, memakai AutoFit Window / persen halaman?)."""
    tblpr = t.el.find(q("tblPr"))
    tw = tblpr.find(q("tblW")) if tblpr is not None else None
    jenis = tw.get(q("type")) if tw is not None else None
    w = tw.get(q("w")) if tw is not None else None
    if jenis == "pct" and w and teks_cm:
        persen = _angka(w.rstrip("%")) if w.endswith("%") else (_angka(w) or 0) / 50
        if persen:
            return teks_cm * persen / 100, True
    grid = t.el.find(q("tblGrid"))
    kolom = [_angka(g.get(q("w"))) or 0 for g in grid.findall(q("gridCol"))] if grid is not None else []
    if sum(kolom) > 0:
        return sum(kolom) / TWIP_PER_CM, False
    if jenis == "dxa" and _angka(w):
        return _angka(w) / TWIP_PER_CM, False
    return None, False


# ---------------------------------------------------------------------------
# gambar


@dataclass
class Figur:
    para: Para
    lebar_cm: float
    tinggi_cm: float
    melayang: str | None  # None = In Line with Text; selain itu label pembungkusan
    rid: str | None
    sisa_potong: float  # porsi lebar gambar asli yang tampil setelah dipotong (crop)


def _di_fallback(el) -> bool:
    return any(etree.QName(a).localname == "Fallback" for a in el.iterancestors())


def figur(dm: DocModel) -> list[Figur]:
    """Gambar berukuran figur (bukan ikon/rumus kecil) beserta posisinya."""
    hasil: list[Figur] = []
    for p in dm.paras:
        for d in p.el.xpath(".//*[local-name()='drawing']/*[local-name()='inline' or local-name()='anchor']"):
            if _di_fallback(d):
                continue
            ext = d.find("{*}extent")
            cx, cy = (_angka(ext.get("cx")), _angka(ext.get("cy"))) if ext is not None else (None, None)
            if not cx or not cy or cy / EMU_PER_CM < 1.5:
                continue
            if not d.xpath(".//*[local-name()='pic' or local-name()='chart' or local-name()='wgp' or local-name()='wpc'"
                           " or local-name()='relIds']"):
                continue  # kotak teks atau bentuk saja
            melayang = None
            if etree.QName(d).localname == "anchor":
                bungkus = next((etree.QName(c).localname for c in d if etree.QName(c).localname.startswith("wrap")), "wrapNone")
                melayang = LABEL_BUNGKUS.get(bungkus) or ("Behind Text" if d.get("behindDoc") in ("1", "true") else "In Front of Text")
            rid = next(iter(d.xpath(".//*[local-name()='blip']/@*[local-name()='embed']")), None)
            potong = 1.0
            src = next(iter(d.xpath(".//*[local-name()='srcRect']")), None)
            if src is not None:
                potong = max(0.05, 1 - ((_angka(src.get("l")) or 0) + (_angka(src.get("r")) or 0)) / 100000)
            hasil.append(Figur(p, cx / EMU_PER_CM, cy / EMU_PER_CM, melayang, rid, potong))
        for sh in p.el.xpath(".//*[local-name()='pict']//*[local-name()='shape'][.//*[local-name()='imagedata']]"):
            if _di_fallback(sh):
                continue
            gaya = sh.get("style") or ""
            ukuran = {k: float(v) for k, v in re.findall(r"(width|height):\s*([\d.]+)pt", gaya)}
            if ukuran.get("height", 0) / 28.35 < 1.5:
                continue
            rid = next(iter(sh.xpath(".//*[local-name()='imagedata']/@*[local-name()='id']")), None)
            melayang = "melayang" if "position:absolute" in gaya.replace(" ", "") else None
            hasil.append(Figur(p, ukuran.get("width", 0) / 28.35, ukuran.get("height", 0) / 28.35, melayang, rid, 1.0))
    return hasil


def dpi_figur(dm: DocModel, f: Figur) -> float | None:
    """Resolusi efektif = piksel gambar yang tampil / lebar cetak (inci). None bila tidak terbaca (mis. EMF)."""
    if not f.rid or f.lebar_cm <= 0:
        return None
    try:
        info = InfoGambar.from_blob(dm.doc.part.related_parts[f.rid].blob)
    except Exception:
        return None
    return info.px_width * f.sisa_potong / (f.lebar_cm / 2.54)


# ---------------------------------------------------------------------------
# keterangan (judul) objek


def _nama_keterangan(p: Para | None, bawaan: str) -> str:
    if p is None:
        return bawaan
    m = CAP_TABEL.match(p.bersih) or CAP_GAMBAR.match(p.bersih)
    return f"{m.group(1).title()} {m.group(2)}" if m else bawaan


def keterangan_tabel(dm: DocModel, t: Tabel) -> Para | None:
    di_dalam = next((p for p in t.paras if p.peran == "judul_tabel"), None)
    if di_dalam:
        return di_dalam
    for arah in (-1, 1):
        i, n = t.blok + arah, 0
        while 0 <= i < len(dm.blok) and n < 3:
            b = dm.blok[i]
            if isinstance(b, Tabel):
                break
            if b.peran == "judul_tabel":
                return b
            if not b.kosong:
                n += 1
            i += arah
    return None


def _keterangan_tegas(p: Para) -> bool:
    """Benar-benar baris judul tabel, bukan kalimat isi yang kebetulan diawali "Tabel 7 ..."."""
    m = RX_KETERANGAN_TABEL.match(p.bersih)
    return bool(m) and not re.search(r"[.!?]\s+[A-Z]", m.group("judul")) and p.kata <= 30


def _objek_di_dekat(dm: DocModel, p: Para) -> str | None:
    """Jenis objek terdekat di sekitar keterangan: 'tabel', 'gambar', atau None."""
    for arah in (1, -1):
        i, n = p.blok + arah, 0
        while 0 <= i < len(dm.blok) and n < 2:
            b = dm.blok[i]
            if isinstance(b, Tabel):
                teks = [x for x in b.paras if not x.kosong]
                return "gambar" if b.ada_gambar and len(teks) <= 2 else "tabel"
            if b.ada_gambar:
                return "gambar"
            if not b.kosong:
                if CAP_TABEL.match(b.bersih) or CAP_GAMBAR.match(b.bersih):
                    break
                n += 1
            i += arah
    return None


def _baris_teks(dm: DocModel, mulai: int, arah: int) -> Para | None:
    """Paragraf teks pertama dari blok `mulai` ke arah tertentu, melewati objek dan baris kosong."""
    i = mulai
    while 0 <= i < len(dm.blok):
        b = dm.blok[i]
        if isinstance(b, Tabel):
            if any(SUMBER.match(x.bersih) for x in b.paras):
                return next(x for x in b.paras if SUMBER.match(x.bersih))
        elif not b.kosong and not b.ada_gambar:
            return b
        i += arah
    return None


def _ada_sumber(dm: DocModel, cap: Para) -> bool:
    if RX_SITASI_KETERANGAN.search(cap.bersih):
        return True
    sesudah = _baris_teks(dm, cap.blok + 1, 1)
    sebelum = _baris_teks(dm, cap.blok - 1, -1)
    return any(x is not None and SUMBER.match(x.bersih) for x in (sesudah, sebelum))


# ---------------------------------------------------------------------------


def cek_objek(dm: DocModel, prof: Profil) -> list[Temuan]:
    tg, out = prof.tabel_gambar, []
    tm = lambda kode, **kw: KT.temuan(prof, K, kode, **kw)  # noqa: E731

    for t in dm.tabel:
        if not tabel_data(t):
            continue
        jangkar = next((p.i for p in t.paras if p.runs and not p.kosong), None)
        keterangan = keterangan_tabel(dm, t)
        nama = _nama_keterangan(keterangan, "Tabel ini")
        if tg.garis_tabel:
            pola = garis_tabel(dm, t).pola
            # tabel tanpa garis dan tanpa judul hampir selalu tabel penata letak (rumus, daftar kode)
            if pola != tg.garis_tabel and not (pola == "tanpa_garis" and keterangan is None):
                out.append(tm("tabel_gambar.garis", para=jangkar, kelompok=f"tg.garis.{pola}", tabel=nama,
                              aktual=LABEL_POLA[pola], harapan=HARAPAN_POLA[tg.garis_tabel]))
        teks_cm = lebar_teks_cm(dm, t.seksi)
        lebar, persen = lebar_tabel_cm(t, teks_cm)
        if teks_cm and lebar:
            if tg.cek_lebar_objek and lebar > teks_cm + 0.4:
                out.append(tm("tabel_gambar.melebihi_margin", para=jangkar, kelompok="tg.lebar.tabel", objek=nama,
                              aktual=KT.cm(lebar), harapan=KT.cm(teks_cm)))
            elif tg.tabel_selebar_halaman and not persen and lebar < teks_cm * 0.9:
                out.append(tm("tabel_gambar.lebar_tabel", para=jangkar, kelompok="tg.lebar_kurang", tabel=nama,
                              aktual=KT.cm(lebar), harapan=KT.cm(teks_cm)))
            # tabel yang dilebarkan otomatis ikut rata; perataan hanya dicek bila lebarnya memang boleh sempit
            elif tg.perataan_tabel and lebar < teks_cm * 0.95:
                rata = perataan_tabel(dm, t)
                if rata != tg.perataan_tabel:
                    out.append(tm("tabel_gambar.perataan_tabel", para=jangkar, kelompok=f"tg.rata_tabel.{rata}", tabel=nama,
                                  aktual=LABEL_PERATAAN[rata], harapan=LABEL_PERATAAN[tg.perataan_tabel]))

    for f in figur(dm):
        p = f.para
        if f.melayang and tg.gambar_sebaris:
            out.append(tm("tabel_gambar.gambar_melayang", para=p.i, kelompok="tg.melayang", aktual=f.melayang))
        if not p.dalam_tabel and not f.melayang:
            teks_cm = lebar_teks_cm(dm, p.seksi)
            if tg.cek_lebar_objek and teks_cm and f.lebar_cm > teks_cm + 0.4:
                out.append(tm("tabel_gambar.melebihi_margin", para=p.i, kelompok="tg.lebar.gambar", objek="Gambar ini",
                              aktual=KT.cm(f.lebar_cm), harapan=KT.cm(teks_cm)))
            if tg.perataan_gambar and p.peran == "gambar":
                rata = p.pp_nilai("perataan", "kiri") or "kiri"
                rata = rata if rata in LABEL_PERATAAN else "kiri"
                if rata != tg.perataan_gambar:
                    out.append(tm("tabel_gambar.perataan_gambar", para=p.i, kelompok=f"tg.rata_gambar.{rata}",
                                  aktual=LABEL_PERATAAN[rata], harapan=LABEL_PERATAAN[tg.perataan_gambar]))
        if tg.min_dpi_gambar:
            dpi = dpi_figur(dm, f)
            if dpi is not None and dpi < tg.min_dpi_gambar:
                out.append(tm("tabel_gambar.resolusi_rendah", para=p.i, kelompok="tg.dpi", aktual=round(dpi),
                              harapan=tg.min_dpi_gambar))

    for p in dm.paras:
        if p.dalam_tabel or p.kosong:
            continue
        if p.peran == "judul_tabel" and tg.tabel_bukan_gambar and _keterangan_tegas(p) and _objek_di_dekat(dm, p) == "gambar":
            out.append(tm("tabel_gambar.tabel_berupa_gambar", para=p.i, kelompok="tg.tabel_gambar",
                          tabel=_nama_keterangan(p, "Tabel ini")))
        if tg.wajib_sumber and p.peran in ("judul_tabel", "judul_gambar") and p.ext.get("posisi") in ("atas", "bawah"):
            if not _ada_sumber(dm, p):
                jenis = "Tabel" if p.peran == "judul_tabel" else "Gambar"
                out.append(tm("tabel_gambar.tanpa_sumber", para=p.i, kelompok=f"tg.sumber.{jenis}",
                              objek=_nama_keterangan(p, f"{jenis} ini")))

    nomor_harap = 1
    for p in dm.paras:
        if not p.ada_persamaan or p.dalam_tabel:
            continue
        if tg.persamaan_editor and p.kata <= 12 and p.el.xpath(_GAMBAR) and not _ada_figur(p.el) \
                and not p.el.xpath(".//*[local-name()='oMath' or local-name()='object']"):
            out.append(tm("tabel_gambar.persamaan_gambar", para=p.i, kelompok="tg.persamaan_gambar"))
        m = RX_NOMOR_PERSAMAAN.search(p.bersih)
        if m and tg.penomoran_berurutan:
            n = int(m.group(1))
            if n != nomor_harap:
                out.append(tm("tabel_gambar.nomor_persamaan", para=p.i, kelompok="tg.nomor.persamaan",
                              aktual=n, harapan=nomor_harap))
            nomor_harap = n + 1
    return out
