"""Resizer: PDF, Word, Excel, gambar, dan API unggah/unduh/zip."""
from __future__ import annotations

import io
import zipfile

import pikepdf
import pytest
from PIL import Image

from app.engine.resizer import GalatResizer, proses


def _foto(lebar=1800, tinggi=1200, fmt="JPEG", **kw) -> bytes:
    img = Image.effect_noise((lebar, tinggi), 50).convert("RGB")
    b = io.BytesIO()
    img.save(b, fmt, **kw)
    return b.getvalue()


def _pdf_bergambar() -> bytes:
    b = io.BytesIO()
    Image.open(io.BytesIO(_foto(2000, 1400, "PNG"))).convert("RGB").save(b, "PDF", resolution=300)
    return b.getvalue()


def _xlsx_bergambar() -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="png" ContentType="image/png"/></Types>')
        z.writestr("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
        z.writestr("xl/media/image1.png", _foto(2600, 1700, "PNG"))
    return b.getvalue()


def test_gambar_level_dan_target():
    data = _foto(quality=97)
    ringan, _, lr = proses("gambar", "foto.jpg", data, "ringan")
    kuat, nama, lk = proses("gambar", "foto.jpg", data, "kuat")
    assert lk["akhir_kb"] < lr["akhir_kb"] < lr["awal_kb"] and nama == "foto_kecil.jpg"
    assert max(Image.open(io.BytesIO(kuat)).size) == 1600
    png = _foto(fmt="PNG")
    hasil, nama, lap = proses("gambar", "layar.png", png, "ringan", target_kb=150)
    assert lap["tercapai"] and lap["format_berubah"] and nama.endswith(".webp") and len(hasil) <= 150 * 1024


def test_gambar_transparan_ke_jpeg_diratakan_putih():
    img = Image.new("RGBA", (400, 300), (0, 0, 0, 0))
    b = io.BytesIO()
    img.save(b, "PNG")
    hasil, nama, _ = proses("gambar", "logo.png", b.getvalue(), "seimbang", format_keluar="jpeg")
    if nama.endswith(".jpg"):
        assert Image.open(io.BytesIO(hasil)).getpixel((5, 5)) == (255, 255, 255)


def test_pdf_dikompres_dan_tetap_terbaca():
    data = _pdf_bergambar()
    hasil, nama, lap = proses("pdf", "laporan.pdf", data, "seimbang")
    assert nama == "laporan_kecil.pdf" and lap["akhir_kb"] < lap["awal_kb"]
    with pikepdf.open(io.BytesIO(hasil)) as pdf:
        assert len(pdf.pages) == 1


def test_excel_gambar_dikompres():
    data = _xlsx_bergambar()
    hasil, nama, lap = proses("excel", "data.xlsx", data, "kuat")
    assert nama == "data_kecil.xlsx" and lap["hemat_persen"] > 30
    assert zipfile.ZipFile(io.BytesIO(hasil)).testzip() is None


def test_hasil_tidak_pernah_lebih_besar_dan_galat_jelas():
    kecil = _foto(64, 64, quality=30)
    hasil, _, lap = proses("gambar", "ikon.jpg", kecil, "ringan")
    assert len(hasil) <= len(kecil) and (lap["sudah_optimal"] or lap["akhir_kb"] <= lap["awal_kb"])
    with pytest.raises(GalatResizer, match="tidak didukung"):
        proses("pdf", "naskah.docx", b"x", "seimbang")
    with pytest.raises(GalatResizer, match="tidak bisa dibaca"):
        proses("pdf", "rusak.pdf", b"bukan pdf", "seimbang")


def test_api_resizer_unduh_zip_dan_hak_akses():
    from fastapi.testclient import TestClient

    from app.main import app
    from test_komentar import _admin

    with TestClient(app) as a, TestClient(app) as lain:
        _admin(a)
        r = a.post("/api/resizer/gambar", files={"berkas": ("foto.jpg", _foto(quality=97))}, data={"level": "kuat"})
        assert r.status_code == 200, r.text
        h = r.json()
        assert h["nama"] == "foto_kecil.jpg" and h["akhir_kb"] < h["awal_kb"]
        u = a.get(f"/api/resizer/unduh/{h['token']}")
        assert u.status_code == 200 and "foto_kecil.jpg" in u.headers["content-disposition"]
        r2 = a.post("/api/resizer/pdf", files={"berkas": ("x.pdf", _pdf_bergambar())}, data={"level": "seimbang", "target_kb": "500"}).json()
        z = a.get(f"/api/resizer/zip?t={h['token']}&t={r2['token']}")
        assert sorted(zipfile.ZipFile(io.BytesIO(z.content)).namelist()) == ["foto_kecil.jpg", "x_kecil.pdf"]
        assert a.post("/api/resizer/pdf", files={"berkas": ("a.docx", b"PK")}).status_code == 400
        assert a.post("/api/resizer/video", files={"berkas": ("a.mp4", b"x")}).status_code == 404
        # pengguna lain tidak bisa mengunduh hasil milik orang lain
        lain.post("/api/auth/daftar", json={"nama": "Tamu", "email": "tamu.resizer@gmail.com", "sandi": "rahasia123"})
        assert lain.get(f"/api/resizer/unduh/{h['token']}").status_code == 404
