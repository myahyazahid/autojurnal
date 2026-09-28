"""Jumlah halaman naskah.

Metadata <Pages> di docProps/app.xml sering basi (mis. tertulis 1), dan penanda lastRenderedPageBreak hanya ditulis
Word desktop. Urutan yang dipakai:
  1. ada penanda render -> nilai terbesar antara penanda dan metadata,
  2. tanpa penanda, metadata > 1 -> metadata,
  3. selain itu -> perkiraan dari tata letak (tinggi paragraf, gambar, dan tabel dibagi tinggi area tulis).
"""
from __future__ import annotations

import math

from .docmodel import DocModel, Para, Tabel, q

PT_PER_CM = 28.35
EMU_PER_PT = 12700


def halaman_render(dm: DocModel) -> int | None:
    """Halaman menurut penanda lastRenderedPageBreak, dihitung sekali per paragraf badan dan per baris tabel."""
    body = dm.doc.element.body
    n, ada = 0, False
    for el in body.iter(q("p"), q("tr")):
        if el.tag == q("p") and any(a.tag == q("tr") for a in el.iterancestors()):
            continue
        if el.find(f".//{q('lastRenderedPageBreak')}") is not None:
            n += 1
            ada = True
    return n + 1 if ada else None


def _area(dm: DocModel, idx: int) -> tuple[float, float, int]:
    """(lebar satu kolom, tinggi area tulis, jumlah kolom) dalam pt."""
    s = dm.seksi[min(idx, len(dm.seksi) - 1)]
    lebar = (s.page_width.pt if s.page_width else 595) - (s.left_margin.pt if s.left_margin else 72) - (s.right_margin.pt if s.right_margin else 72)
    tinggi = (s.page_height.pt if s.page_height else 842) - (s.top_margin.pt if s.top_margin else 72) - (s.bottom_margin.pt if s.bottom_margin else 72)
    kolom = dm.kolom_seksi(idx)
    return (lebar - 18 * (kolom - 1)) / kolom, tinggi, kolom


def _tinggi_para(p: Para, lebar_pt: float) -> float:
    ukuran = p.dominan("ukuran")[0] or 11.0
    spasi = p.pp_nilai("spasi", ("kali", 1.0)) or ("kali", 1.0)
    baris_pt = spasi[1] if spasi[0] != "kali" else ukuran * 1.1 * spasi[1]
    tinggi = (p.pp_nilai("sebelum", 0.0) or 0.0) + (p.pp_nilai("sesudah", 0.0) or 0.0)
    for d in p.el.xpath(".//*[local-name()='drawing']/*/*[local-name()='extent']"):
        try:
            tinggi += int(d.get("cy")) / EMU_PER_PT
        except (TypeError, ValueError):
            pass
    indent = abs(p.pp_nilai("indentasi_kiri", 0.0) or 0.0) * PT_PER_CM
    per_baris = max(10, (lebar_pt - indent) / (ukuran * 0.45))  # rata-rata lebar huruf, dikalibrasi pada naskah nyata
    baris = sum(max(1, math.ceil(len(potong) / per_baris)) for potong in (p.teks or " ").split("\n"))
    return tinggi + baris * baris_pt


def _tinggi_tabel(t: Tabel, lebar_pt: float) -> float:
    grid = t.el.find(q("tblGrid"))
    kolom = [float(g.get(q("w")) or 0) / 20 for g in grid.findall(q("gridCol"))] if grid is not None else []
    total = 0.0
    for tr in t.el.findall(q("tr")):
        tertinggi = 0.0
        for i, tc in enumerate(tr.findall(q("tc"))):
            lebar = kolom[i] if i < len(kolom) and kolom[i] > 0 else lebar_pt / max(1, len(tr.findall(q("tc"))))
            isi = [p for p in t.paras if p.el.getparent() is tc]
            tertinggi = max(tertinggi, sum(_tinggi_para(p, max(20.0, lebar - 10)) for p in isi) + 4)
        total += tertinggi
    return total


def halaman_perkiraan(dm: DocModel) -> int:
    halaman, terisi = 1, 0.0
    for b in dm.blok:
        idx = b.seksi
        lebar, tinggi, kolom = _area(dm, idx)
        kapasitas = tinggi * kolom
        if isinstance(b, Tabel):
            h = _tinggi_tabel(b, lebar)
        else:
            if b.el.xpath(".//*[local-name()='br'][@*[local-name()='type']='page']") and terisi > 0:
                halaman, terisi = halaman + 1, 0.0
            h = _tinggi_para(b, lebar)
        terisi += h
        while terisi > kapasitas:
            halaman += 1
            terisi -= kapasitas
    return halaman


def jumlah_halaman(dm: DocModel) -> tuple[int | None, str]:
    """(jumlah halaman, sumber) dengan sumber 'render' | 'metadata' | 'perkiraan'."""
    render, meta = halaman_render(dm), dm.halaman
    if render:
        return max(render, meta or 0), "render"
    if meta and meta > 1:
        return meta, "metadata"
    if not dm.paras:
        return meta, "metadata"
    return halaman_perkiraan(dm), "perkiraan"
