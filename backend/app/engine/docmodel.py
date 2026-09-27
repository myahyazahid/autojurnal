"""Membaca .docx menjadi daftar paragraf beserta format EFEKTIF-nya.

Format efektif = hasil akhir setelah menggabungkan: default dokumen -> style paragraf (berantai
basedOn) -> style karakter -> format langsung. Setiap nilai menyimpan sumbernya
('default' | 'style' | 'langsung') supaya ekstraktor tahu mana yang sengaja diatur penulis template.
"""
from __future__ import annotations

import re
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from typing import IO, Any

import docx
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from lxml import etree

from . import teks as T

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}
CM_PER_TWIP = 1 / 567.0


def q(tag: str) -> str:
    return f"{{{W_NS}}}{tag}"


def _val(el, attr="val"):
    return None if el is None else el.get(q(attr))


# ---------------------------------------------------------------------------
# Properti mentah dari satu elemen rPr / pPr


def _props_rpr(rpr) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if rpr is None:
        return out
    f = rpr.find(q("rFonts"))
    if f is not None:
        tema = f.get(q("asciiTheme")) or f.get(q("hAnsiTheme"))
        nama = f.get(q("ascii")) or f.get(q("hAnsi"))
        if tema:
            out["font"] = "tema:" + tema
        elif nama:
            out["font"] = nama
    sz = rpr.find(q("sz"))
    if sz is not None and _val(sz):
        try:
            out["ukuran"] = int(_val(sz)) / 2
        except ValueError:
            pass
    for tag, kunci in (("b", "tebal"), ("i", "miring"), ("caps", "kapital")):
        el = rpr.find(q(tag))
        if el is not None:
            out[kunci] = _val(el) not in ("0", "false", "off")
    return out


_JC = {
    "both": "rata_kanan_kiri", "distribute": "rata_kanan_kiri", "center": "tengah",
    "left": "kiri", "start": "kiri", "right": "kanan", "end": "kanan",
}


def _props_ppr(ppr) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if ppr is None:
        return out
    jc = ppr.find(q("jc"))
    if jc is not None and _val(jc) in _JC:
        out["perataan"] = _JC[_val(jc)]
    sp = ppr.find(q("spacing"))
    if sp is not None:
        line, rule = sp.get(q("line")), sp.get(q("lineRule")) or "auto"
        if line:
            try:
                n = int(line)
                out["spasi"] = ("kali", round(n / 240, 2)) if rule == "auto" else (rule, n / 20)
            except ValueError:
                pass
        for a, k in (("before", "sebelum"), ("after", "sesudah")):
            if sp.get(q(a)) is not None and sp.get(q(a + "Autospacing")) not in ("1", "true"):
                try:
                    out[k] = int(sp.get(q(a))) / 20
                except ValueError:
                    pass
    ind = ppr.find(q("ind"))
    if ind is not None:
        fl, hg = ind.get(q("firstLine")), ind.get(q("hanging"))
        try:
            if hg is not None:
                out["indentasi"] = -int(hg) * CM_PER_TWIP
            elif fl is not None:
                out["indentasi"] = int(fl) * CM_PER_TWIP
        except ValueError:
            pass
        kiri = ind.get(q("left")) or ind.get(q("start"))
        if kiri is not None:
            try:
                out["indentasi_kiri"] = int(kiri) * CM_PER_TWIP
            except ValueError:
                pass
    num = ppr.find(q("numPr"))
    if num is not None:
        nid = num.find(q("numId"))
        out["bernomor"] = nid is not None and _val(nid) not in (None, "0")
    ol = ppr.find(q("outlineLvl"))
    if ol is not None and _val(ol) and _val(ol).isdigit() and int(_val(ol)) < 9:
        out["outline"] = int(_val(ol)) + 1
    return out


# ---------------------------------------------------------------------------
# Resolver style


class ResolverStyle:
    def __init__(self, doc: docx.document.Document):
        el = doc.styles.element
        self.style: dict[str, Any] = {}
        self.nama: dict[str, str] = {}
        self.default_para: str | None = None
        for s in el.findall(q("style")):
            sid = s.get(q("styleId"))
            self.style[sid] = s
            n = s.find(q("name"))
            self.nama[sid] = _val(n) or sid
            if s.get(q("type")) == "paragraph" and s.get(q("default")) in ("1", "true"):
                self.default_para = sid
        dd = el.find(q("docDefaults"))
        self.dd_rpr = _props_rpr(dd.find(f"{q('rPrDefault')}/{q('rPr')}")) if dd is not None else {}
        self.dd_ppr = _props_ppr(dd.find(f"{q('pPrDefault')}/{q('pPr')}")) if dd is not None else {}
        self.tema = self._font_tema(doc)
        self._cache: dict[tuple[str, str], tuple[dict, dict]] = {}

    @staticmethod
    def _font_tema(doc) -> dict[str, str]:
        hasil = {"minor": "Calibri", "major": "Calibri Light"}
        try:
            part = doc.part.part_related_by(RT.THEME)
            root = etree.fromstring(part.blob)
            a = "http://schemas.openxmlformats.org/drawingml/2006/main"
            for jenis in ("minor", "major"):
                lat = root.find(f".//{{{a}}}{jenis}Font/{{{a}}}latin")
                if lat is not None and lat.get("typeface"):
                    hasil[jenis] = lat.get("typeface")
        except Exception:
            pass
        return hasil

    def nama_font(self, f: str | None) -> str | None:
        if f and f.startswith("tema:"):
            return self.tema["major" if "major" in f else "minor"]
        return f

    def rantai(self, sid: str | None) -> list[Any]:
        """Style dari paling dasar ke paling turunan."""
        hasil, dilihat = [], set()
        while sid and sid in self.style and sid not in dilihat and len(hasil) < 25:
            dilihat.add(sid)
            s = self.style[sid]
            hasil.append(s)
            sid = _val(s.find(q("basedOn")))
        return list(reversed(hasil))

    def props_style(self, sid: str | None) -> tuple[dict, dict]:
        """(rPr, pPr) gabungan satu rantai style."""
        kunci = (sid or "", "")
        if kunci not in self._cache:
            r: dict = {}
            p: dict = {}
            for s in self.rantai(sid):
                r.update(_props_rpr(s.find(q("rPr"))))
                p.update(_props_ppr(s.find(q("pPr"))))
            self._cache[kunci] = (r, p)
        return self._cache[kunci]


def _lapis(*lapisan: tuple[dict, str]) -> dict[str, tuple[Any, str]]:
    out: dict[str, tuple[Any, str]] = {}
    for props, sumber in lapisan:
        for k, v in props.items():
            out[k] = (v, sumber)
    return out


# ---------------------------------------------------------------------------
# Model


@dataclass
class RunInfo:
    el: Any
    teks: str
    font: tuple[str, str]
    ukuran: tuple[float, str]
    tebal: bool
    miring: bool
    kapital: bool


@dataclass
class Para:
    i: int
    el: Any
    teks: str
    bersih: str
    petunjuk: list[str]
    style_id: str | None
    style_nama: str
    pp: dict[str, tuple[Any, str]]
    runs: list[RunInfo]
    dalam_tabel: bool = False
    tabel: int | None = None
    blok: int = 0
    seksi: int = 0
    ada_gambar: bool = False
    ada_persamaan: bool = False
    peran: str = "teks_isi"
    level: int | None = None
    label_inline: str | None = None  # mis. "ABSTRAK:" di awal paragraf
    ext: dict[str, Any] = field(default_factory=dict)

    @property
    def kata(self) -> int:
        return T.hitung_kata(self.bersih)

    @property
    def kosong(self) -> bool:
        return not self.bersih.strip()

    def pp_nilai(self, kunci: str, default=None):
        return self.pp.get(kunci, (default, "default"))[0]

    def _bobot(self):
        for r in self.runs:
            n = len(r.teks.strip())
            if n:
                yield r, n

    def dominan(self, attr: str) -> tuple[Any, str, float]:
        """Nilai dominan (berbobot jumlah karakter) -> (nilai, sumber, porsi)."""
        skor: dict[Any, float] = defaultdict(float)
        sumber: dict[Any, str] = {}
        total = 0.0
        for r, n in self._bobot():
            v = getattr(r, attr)
            nilai, src = v if isinstance(v, tuple) else (v, "langsung")
            skor[nilai] += n
            total += n
            if sumber.get(nilai) != "langsung":
                sumber[nilai] = src
        if not total:
            return None, "default", 0.0
        nilai = max(skor, key=skor.get)
        return nilai, sumber[nilai], skor[nilai] / total

    def rasio(self, attr: str) -> float | None:
        tot = ya = 0
        for r, n in self._bobot():
            tot += n
            ya += n if getattr(r, attr) else 0
        return ya / tot if tot else None

    def cuplikan(self, n: int = 70) -> str:
        t = re.sub(r"\s+", " ", self.teks).strip()
        return t if len(t) <= n else t[: n - 1] + "…"


@dataclass
class Tabel:
    i: int
    el: Any
    blok: int
    seksi: int
    paras: list[Para] = field(default_factory=list)
    ada_gambar: bool = False


_XP_RUN = (
    "./w:r | ./w:hyperlink/w:r | ./w:ins/w:r | ./w:smartTag/w:r | ./w:fldSimple/w:r"
    " | ./w:sdt/w:sdtContent/w:r | ./w:customXml/w:r | ./w:hyperlink/w:ins/w:r"
)
_GAMBAR = (
    ".//*[local-name()='drawing' or local-name()='pict']"
    "//*[local-name()='pic' or local-name()='chart' or local-name()='relIds' or local-name()='imagedata'"
    " or local-name()='wgp' or local-name()='wpc']"
)


_TINGGI_MIN_GAMBAR_CM = 1.5  # di bawah ini dianggap gambar rumus/ikon, bukan figur


def _ada_figur(el) -> bool:
    if not el.xpath(_GAMBAR):
        return False
    tinggi = []
    for e in el.xpath(".//*[local-name()='drawing']//*[local-name()='extent']"):
        try:
            tinggi.append(int(e.get("cy")) / 360000)
        except (TypeError, ValueError):
            pass
    for s in el.xpath(".//*[local-name()='shape']/@style"):
        m = re.search(r"height:\s*([\d.]+)pt", s)
        if m:
            tinggi.append(float(m.group(1)) / 28.35)
    return not tinggi or max(tinggi) >= _TINGGI_MIN_GAMBAR_CM


def _teks_run(r) -> str:
    out = []
    for c in r.iterchildren():
        tag = etree.QName(c).localname
        if tag == "t":
            out.append(c.text or "")
        elif tag in ("tab", "ptab"):
            out.append("\t")
        elif tag in ("br", "cr"):
            out.append("\n")
        elif tag == "noBreakHyphen":
            out.append("-")
        elif tag == "sym":
            out.append("?")
    return "".join(out)


class DocModel:
    def __init__(self, sumber: str | IO[bytes], mode: str = "naskah"):
        self.mode = mode
        self.doc = docx.Document(sumber)
        self.res = ResolverStyle(self.doc)
        self.paras: list[Para] = []
        self.tabel: list[Tabel] = []
        self.blok: list[Para | Tabel] = []
        self.seksi = list(self.doc.sections)
        self.halaman = self._baca_halaman(sumber)
        self._linearisasi()

    # -- metadata --------------------------------------------------------
    @staticmethod
    def _baca_halaman(sumber) -> int | None:
        try:
            if hasattr(sumber, "seek"):
                sumber.seek(0)
            with zipfile.ZipFile(sumber) as z:
                xml = z.read("docProps/app.xml").decode("utf8", "ignore")
            m = re.search(r"<Pages>(\d+)</Pages>", xml)
            return int(m.group(1)) if m else None
        except Exception:
            return None
        finally:
            if hasattr(sumber, "seek"):
                sumber.seek(0)

    # -- pembacaan -------------------------------------------------------
    def _linearisasi(self):
        seksi = 0
        body = self.doc.element.body

        def jelajah(parent):
            nonlocal seksi
            for el in parent.iterchildren():
                tag = etree.QName(el).localname
                if tag == "p":
                    p = self._para(el, seksi)
                    p.blok = len(self.blok)
                    self.blok.append(p)
                    if el.find(f"{q('pPr')}/{q('sectPr')}") is not None:
                        seksi += 1
                elif tag == "tbl":
                    self._tabel(el, seksi)
                elif tag == "sdt":
                    isi = el.find(q("sdtContent"))
                    if isi is not None:
                        jelajah(isi)

        jelajah(body)

    def _tabel(self, el, seksi: int):
        t = Tabel(i=len(self.tabel), el=el, blok=len(self.blok), seksi=seksi)
        self.tabel.append(t)
        self.blok.append(t)
        for p_el in el.iter(q("p")):
            # lewati paragraf di dalam kotak teks
            if any(etree.QName(a).localname == "txbxContent" for a in p_el.iterancestors()):
                continue
            p = self._para(p_el, seksi, tabel=t.i)
            p.blok = t.blok
            t.paras.append(p)
            t.ada_gambar = t.ada_gambar or p.ada_gambar

    def _para(self, el, seksi: int, tabel: int | None = None) -> Para:
        ppr = el.find(q("pPr"))
        sid = _val(ppr.find(q("pStyle"))) if ppr is not None else None
        sid = sid if sid in self.res.style else self.res.default_para
        st_r, st_p = self.res.props_style(sid)
        pp = _lapis((self.res.dd_ppr, "default"), (st_p, "style"), (_props_ppr(ppr), "langsung"))
        runs: list[RunInfo] = []
        for r in el.xpath(_XP_RUN):
            teks = _teks_run(r)
            rpr = r.find(q("rPr"))
            rs = _val(rpr.find(q("rStyle"))) if rpr is not None else None
            cs_r = self.res.props_style(rs)[0] if rs else {}
            p = _lapis((self.res.dd_rpr, "default"), (st_r, "style"), (cs_r, "style"), (_props_rpr(rpr), "langsung"))
            font, fsrc = p.get("font", ("Times New Roman", "default"))
            runs.append(
                RunInfo(
                    el=r,
                    teks=teks,
                    font=(self.res.nama_font(font), fsrc),
                    ukuran=p.get("ukuran", (10.0, "default")),
                    tebal=bool(p.get("tebal", (False,))[0]),
                    miring=bool(p.get("miring", (False,))[0]),
                    kapital=bool(p.get("kapital", (False,))[0]),
                )
            )
        teks = "".join(r.teks for r in runs)
        if self.mode == "template":
            bersih, petunjuk = T.pisah_petunjuk(teks)
        else:
            bersih, petunjuk = teks.strip(), []
        para = Para(
            i=len(self.paras),
            el=el,
            teks=teks,
            bersih=bersih,
            petunjuk=petunjuk,
            style_id=sid,
            style_nama=self.res.nama.get(sid or "", sid or ""),
            pp=pp,
            runs=runs,
            dalam_tabel=tabel is not None,
            tabel=tabel,
            seksi=seksi,
            ada_gambar=_ada_figur(el),
            ada_persamaan=bool(el.xpath(".//*[local-name()='oMath' or local-name()='object']")) or (
                bool(el.xpath(_GAMBAR)) and not _ada_figur(el)),
        )
        self.paras.append(para)
        return para

    # -- bantuan ----------------------------------------------------------
    def seksi_dari(self, p: Para):
        return self.seksi[min(p.seksi, len(self.seksi) - 1)] if self.seksi else None

    def kolom_seksi(self, idx: int) -> int:
        s = self.seksi[min(idx, len(self.seksi) - 1)]
        cols = s._sectPr.find(q("cols"))
        n = cols.get(q("num")) if cols is not None else None
        return int(n) if n and n.isdigit() else 1

    def paragraf_isi(self, *peran: str) -> list[Para]:
        return [p for p in self.paras if p.peran in peran and not p.kosong]
