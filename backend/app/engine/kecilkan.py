"""Pengecil ukuran .docx.

Tahap tanpa kehilangan kualitas selalu dijalankan: buang font yang disematkan (penyebab utama berkas besar)
dan gambar pratinjau (thumbnail). Bila masih di atas target, gambar dikompres bertahap mengikuti ukuran
tampilnya di halaman. Teks, format, dan komentar tidak disentuh.
"""
from __future__ import annotations

import io
import posixpath
import re
import zipfile
from pathlib import Path

from lxml import etree
from PIL import Image

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
EMU_PER_INCI = 914400
MEDIA = re.compile(r"^word/media/[^/]+\.(png|jpe?g|bmp|gif|tiff?)$", re.I)
PART_ISI = re.compile(r"^word/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$")


def rincian(data: bytes) -> dict:
    """Asal ukuran berkas (KB, terkompresi): font sematan, gambar, dan sisanya."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        font = sum(i.compress_size for i in z.infolist() if i.filename.lower().startswith("word/fonts/"))
        gambar = sum(i.compress_size for i in z.infolist() if i.filename.startswith("word/media/"))
    total = len(data)
    return {"total_kb": round(total / 1024), "font_kb": round(font / 1024), "gambar_kb": round(gambar / 1024),
            "lain_kb": round((total - font - gambar) / 1024)}


class Paket:
    def __init__(self, data: bytes):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            self.urutan = [i.filename for i in z.infolist()]
            self.isi = {n: z.read(n) for n in self.urutan}

    def simpan(self) -> bytes:
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for n in self.urutan:
                if n in self.isi:
                    z.writestr(n, self.isi[n])
        return out.getvalue()

    def xml(self, nama: str):
        return etree.fromstring(self.isi[nama]) if nama in self.isi else None

    def tulis_xml(self, nama: str, root) -> None:
        self.isi[nama] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)

    def hapus(self, nama: str) -> None:
        self.isi.pop(nama, None)
        ct = self.xml("[Content_Types].xml")
        for o in ct.findall(f"{{{CT}}}Override"):
            if o.get("PartName") == "/" + nama:
                ct.remove(o)
        self.tulis_xml("[Content_Types].xml", ct)

    def rels_dari(self, part: str) -> str:
        d, f = posixpath.split(part)
        return posixpath.join(d, "_rels", f + ".rels")

    def target(self, part: str) -> dict[str, str]:
        """{rId: nama part tujuan} untuk satu part."""
        rels = self.xml(self.rels_dari(part))
        if rels is None:
            return {}
        dasar = posixpath.dirname(part)
        return {r.get("Id"): posixpath.normpath(posixpath.join(dasar, r.get("Target")))
                for r in rels.findall(f"{{{REL}}}Relationship") if r.get("TargetMode") != "External"}


def _buang_font(p: Paket) -> None:
    font = [n for n in p.isi if n.lower().startswith("word/fonts/")]
    tabel = p.xml("word/fontTable.xml")
    if tabel is not None:
        for e in tabel.xpath(".//w:embedRegular|.//w:embedBold|.//w:embedItalic|.//w:embedBoldItalic", namespaces={"w": W}):
            e.getparent().remove(e)
        p.tulis_xml("word/fontTable.xml", tabel)
    rels = p.xml("word/_rels/fontTable.xml.rels")
    if rels is not None:
        for r in list(rels):
            if "fonts/" in (r.get("Target") or ""):
                rels.remove(r)
        p.tulis_xml("word/_rels/fontTable.xml.rels", rels)
    setelan = p.xml("word/settings.xml")
    if setelan is not None:  # agar Word tidak menyematkan font lagi saat disimpan ulang
        for e in setelan.xpath("w:embedTrueTypeFonts|w:embedSystemFonts|w:saveSubsetFonts", namespaces={"w": W}):
            setelan.remove(e)
        p.tulis_xml("word/settings.xml", setelan)
    for n in font:
        p.hapus(n)


def _buang_thumbnail(p: Paket) -> None:
    rels = p.xml("_rels/.rels")
    for r in list(rels):
        if "thumbnail" in (r.get("Type") or "") or "thumbnail" in (r.get("Target") or ""):
            p.hapus(r.get("Target").lstrip("/"))
            rels.remove(r)
    p.tulis_xml("_rels/.rels", rels)


def _lebar_tampil(p: Paket) -> dict[str, float]:
    """{part gambar: lebar tampil terbesar (inci)} dari semua pemakaiannya di dokumen."""
    hasil: dict[str, float] = {}
    for part in [n for n in p.isi if PART_ISI.match(n)]:
        root, tujuan = p.xml(part), p.target(part)
        for d in root.xpath(".//*[local-name()='inline' or local-name()='anchor']"):
            ext = d.find("{*}extent")
            try:
                inci = int(ext.get("cx")) / EMU_PER_INCI
            except (TypeError, ValueError, AttributeError):
                continue
            for rid in d.xpath(".//*[local-name()='blip']/@*[local-name()='embed']"):
                if rid in tujuan:
                    hasil[tujuan[rid]] = max(hasil.get(tujuan[rid], 0), inci)
        for sh in root.xpath(".//*[local-name()='shape'][.//*[local-name()='imagedata']]"):
            m = re.search(r"width:\s*([\d.]+)pt", sh.get("style") or "")
            for rid in sh.xpath(".//*[local-name()='imagedata']/@*[local-name()='id']"):
                if m and rid in tujuan:
                    hasil[tujuan[rid]] = max(hasil.get(tujuan[rid], 0), float(m.group(1)) / 72)
    return hasil


def _ganti_nama(p: Paket, lama: str, baru: str, mime: str) -> None:
    p.isi[baru] = p.isi.pop(lama)
    p.urutan.append(baru)
    nama_lama, nama_baru = posixpath.basename(lama), posixpath.basename(baru)
    for r in [n for n in p.isi if n.endswith(".rels")]:
        teks = p.isi[r].decode("utf-8")
        if nama_lama in teks:
            p.isi[r] = teks.replace(f"media/{nama_lama}\"", f"media/{nama_baru}\"").encode("utf-8")
    ct = p.xml("[Content_Types].xml")
    ekst = baru.rsplit(".", 1)[-1]
    if not any(d.get("Extension", "").lower() == ekst for d in ct.findall(f"{{{CT}}}Default")):
        etree.SubElement(ct, f"{{{CT}}}Default", Extension=ekst, ContentType=mime)
    p.tulis_xml("[Content_Types].xml", ct)


def _kompres(p: Paket, dpi: int, kualitas: int, palet: bool, ke_jpeg: bool) -> None:
    tampil = _lebar_tampil(p)
    for nama in [n for n in list(p.isi) if MEDIA.match(n)]:
        asli = p.isi[nama]
        try:
            img = Image.open(io.BytesIO(asli))
            img.load()
        except Exception:
            continue
        format_asli = img.format
        lebar_in = tampil.get(nama)
        if lebar_in:
            target = max(64, int(lebar_in * dpi))
            if img.width > target * 1.05:
                img = img.resize((target, max(1, round(img.height * target / img.width))), Image.LANCZOS)
        transparan = img.mode in ("RGBA", "LA", "P") and "transparency" in img.info or img.mode in ("RGBA", "LA")
        kandidat: list[tuple[bytes, str]] = []
        if format_asli == "JPEG":
            b = io.BytesIO()
            img.convert("RGB").save(b, "JPEG", quality=kualitas, optimize=True, progressive=True)
            kandidat.append((b.getvalue(), nama))
        else:
            b = io.BytesIO()
            png = img.quantize(256, method=Image.Quantize.FASTOCTREE) if palet and img.mode in ("RGB", "RGBA") else img
            png.save(b, "PNG", optimize=True)
            kandidat.append((b.getvalue(), nama.rsplit(".", 1)[0] + ".png"))
            if ke_jpeg and not transparan:
                b = io.BytesIO()
                img.convert("RGB").save(b, "JPEG", quality=kualitas, optimize=True, progressive=True)
                kandidat.append((b.getvalue(), nama.rsplit(".", 1)[0] + ".jpeg"))
        data, nama_baru = min(kandidat, key=lambda k: len(k[0]))
        if len(data) >= len(asli):
            continue
        if nama_baru != nama:
            _ganti_nama(p, nama, nama_baru, "image/jpeg" if nama_baru.endswith(".jpeg") else "image/png")
        p.isi[nama_baru] = data


TAHAP_GAMBAR = [
    ("Mengompres gambar (220 dpi)", dict(dpi=220, kualitas=85, palet=False, ke_jpeg=False)),
    ("Mengompres gambar (150 dpi)", dict(dpi=150, kualitas=78, palet=True, ke_jpeg=False)),
    ("Mengubah gambar besar menjadi JPEG", dict(dpi=150, kualitas=75, palet=True, ke_jpeg=True)),
    ("Mengompres gambar lebih kuat (110 dpi)", dict(dpi=110, kualitas=65, palet=True, ke_jpeg=True)),
]


def kecilkan(sumber: bytes, target_kb: int = 1900) -> tuple[bytes, dict]:
    """Kembalikan (berkas baru, laporan). Tahap gambar hanya dijalankan selama ukuran masih di atas target."""
    p = Paket(sumber)
    awal = len(sumber)
    langkah: list[dict] = []

    def catat(nama: str):
        data = p.simpan()
        langkah.append({"langkah": nama, "ukuran_kb": round(len(data) / 1024)})
        return data

    _buang_font(p)
    _buang_thumbnail(p)
    data = catat("Menghapus font yang disematkan dan gambar pratinjau")
    for nama, opsi in TAHAP_GAMBAR:
        if len(data) <= target_kb * 1024:
            break
        _kompres(p, **opsi)
        data = catat(nama)
    return data, {"awal_kb": round(awal / 1024), "akhir_kb": round(len(data) / 1024), "target_kb": target_kb,
                  "tercapai": len(data) <= target_kb * 1024, "langkah": langkah}


def kecilkan_berkas(sumber: Path, tujuan: Path, target_kb: int = 1900) -> dict:
    data, laporan = kecilkan(sumber.read_bytes(), target_kb)
    tujuan.write_bytes(data)
    return laporan
