"""Resizer: mengecilkan PDF, Word, Excel, dan gambar.

Level: ringan = tanpa menurunkan kualitas yang terlihat, seimbang = kompres gambar secukupnya, kuat = sekecil mungkin.
Dengan target (KB), level dinaikkan bertahap sampai ukuran di bawah target. Hasil tidak pernah lebih besar dari asli.
"""
from __future__ import annotations

import io
from pathlib import Path

import pikepdf
from PIL import Image, ImageOps

from .kecilkan import kecilkan as kecilkan_office

Image.MAX_IMAGE_PIXELS = 60_000_000  # tolak gambar raksasa yang bisa menghabiskan memori server

JENIS: dict[str, tuple[str, ...]] = {
    "pdf": (".pdf",),
    "word": (".docx", ".docm", ".dotx"),
    "excel": (".xlsx", ".xlsm"),
    "gambar": (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"),
}
LEVEL = ("ringan", "seimbang", "kuat")


class GalatResizer(ValueError):
    """Pesan yang aman ditampilkan ke pengguna."""


# ---------------------------------------------------------------------------
# gambar

MUTU = {"ringan": 90, "seimbang": 80, "kuat": 62}
SISI = {"ringan": None, "seimbang": 2560, "kuat": 1600}
FORMAT = {"jpeg": ("JPEG", ".jpg"), "webp": ("WEBP", ".webp"), "png": ("PNG", ".png")}


def _buka_gambar(data: bytes, sisi: int | None) -> tuple[Image.Image, str]:
    try:
        img = Image.open(io.BytesIO(data))
        asal = img.format or "PNG"
        if getattr(img, "n_frames", 1) > 1 and asal in ("GIF", "WEBP", "PNG"):
            raise GalatResizer("Gambar animasi belum didukung.")
        if asal == "JPEG" and sisi:
            img.draft("RGB", (sisi, sisi))  # dekode di resolusi kecil agar hemat memori
        img.load()
    except GalatResizer:
        raise
    except Image.DecompressionBombError:
        raise GalatResizer("Gambar terlalu besar (lebih dari 60 megapiksel).")
    except Exception:
        raise GalatResizer("Berkas gambar tidak bisa dibaca.")
    img = ImageOps.exif_transpose(img)  # terapkan rotasi kamera, lalu metadata EXIF tidak ikut disimpan
    return img, asal


def _simpan_gambar(img: Image.Image, fmt: str, mutu: int, palet: int | None) -> bytes:
    b = io.BytesIO()
    transparan = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if fmt == "JPEG":
        if transparan:  # JPEG tidak punya transparansi: ratakan di atas putih
            dasar = Image.new("RGB", img.size, "white")
            dasar.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[-1])
            img = dasar
        img.convert("RGB").save(b, "JPEG", quality=mutu, optimize=True, progressive=True)
    elif fmt == "WEBP":
        img.save(b, "WEBP", quality=mutu, method=6)
    else:
        if palet and img.mode in ("RGB", "RGBA"):
            img = img.quantize(palet, method=Image.Quantize.FASTOCTREE)
        img.save(b, "PNG", optimize=True)
    return b.getvalue()


def kecilkan_gambar(data: bytes, level: str, format_keluar: str = "sama", maks_sisi: int | None = None,
                    mutu: int | None = None) -> tuple[bytes, str]:
    sisi = maks_sisi or SISI[level]
    img, asal = _buka_gambar(data, sisi)
    if sisi and max(img.size) > sisi:
        img.thumbnail((sisi, sisi), Image.LANCZOS)
    if format_keluar in FORMAT:
        fmt, ekst = FORMAT[format_keluar]
    elif asal == "JPEG":
        fmt, ekst = "JPEG", ".jpg"
    elif asal == "WEBP":
        fmt, ekst = "WEBP", ".webp"
    else:  # PNG, BMP, TIFF: tetap PNG agar transparansi & ketajaman terjaga
        fmt, ekst = "PNG", ".png"
    palet = {"ringan": None, "seimbang": 256, "kuat": 128}[level]
    return _simpan_gambar(img, fmt, mutu or MUTU[level], palet), ekst


# ---------------------------------------------------------------------------
# PDF

MUTU_PDF = {"seimbang": (1800, 75), "kuat": (1200, 55), "maksimal": (900, 45)}


def _kompres_gambar_pdf(pdf: pikepdf.Pdf, sisi: int, mutu: int) -> None:
    """Kompres ulang gambar raster di PDF menjadi JPEG. Gambar yang berisiko rusak dilewati."""
    for obj in list(pdf.objects):
        if not isinstance(obj, pikepdf.Stream) or obj.get("/Subtype") != "/Image":
            continue
        try:
            filt = obj.get("/Filter")
            nama_filter = [str(f) for f in filt] if isinstance(filt, pikepdf.Array) else [str(filt)] if filt else []
            smask = obj.get("/SMask")
            if obj.get("/ImageMask") or obj.get("/Decode") is not None or (smask is not None and "/Matte" in smask) or \
                    any(f in ("/JBIG2Decode", "/CCITTFaxDecode", "/JPXDecode") for f in nama_filter):
                continue
            pim = pikepdf.PdfImage(obj)
            if pim.width * pim.height < 150 * 150 or pim.bits_per_component not in (1, 8):
                continue
            img = pim.as_pil_image()
            img = img.convert("L") if img.mode in ("1", "L", "LA") else img.convert("RGB")
            if max(img.size) > sisi:
                img.thumbnail((sisi, sisi), Image.LANCZOS)
            b = io.BytesIO()
            img.save(b, "JPEG", quality=mutu, optimize=True)
            baru = b.getvalue()
            if len(baru) >= len(obj.read_raw_bytes()) * 0.9:
                continue
            obj.write(baru, filter=pikepdf.Name.DCTDecode)
            obj.Width, obj.Height = img.size
            obj.ColorSpace = pikepdf.Name.DeviceGray if img.mode == "L" else pikepdf.Name.DeviceRGB
            obj.BitsPerComponent = 8
            if "/DecodeParms" in obj:
                del obj["/DecodeParms"]
        except Exception:
            continue


def kecilkan_pdf(data: bytes, level: str) -> bytes:
    try:
        pdf = pikepdf.open(io.BytesIO(data))
    except pikepdf.PasswordError:
        raise GalatResizer("PDF terkunci kata sandi. Buka kuncinya dulu lalu unggah ulang.")
    except Exception:
        raise GalatResizer("Berkas PDF tidak bisa dibaca.")
    with pdf:
        if level != "ringan":
            _kompres_gambar_pdf(pdf, *MUTU_PDF[level])
        pdf.remove_unreferenced_resources()
        out = io.BytesIO()
        pdf.save(out, compress_streams=True, recompress_flate=True,
                 object_stream_mode=pikepdf.ObjectStreamMode.generate)
    return out.getvalue()


# ---------------------------------------------------------------------------


def _satu(jenis: str, data: bytes, level: str, opsi: dict) -> tuple[bytes, str | None]:
    if jenis == "pdf":
        return kecilkan_pdf(data, level), None
    if jenis in ("word", "excel"):
        try:
            return kecilkan_office(data, target_kb=None, level=level)[0], None
        except Exception:
            raise GalatResizer("Berkas tidak bisa dibaca. Pastikan formatnya .docx/.xlsx asli, bukan .doc/.xls lama.")
    return kecilkan_gambar(data, level, opsi.get("format_keluar", "sama"), opsi.get("maks_sisi"))


def proses(jenis: str, nama: str, data: bytes, level: str = "seimbang", target_kb: int | None = None,
           **opsi) -> tuple[bytes, str, dict]:
    """(berkas hasil, nama unduhan, laporan)."""
    if jenis not in JENIS:
        raise GalatResizer("Jenis berkas tidak dikenal.")
    stem, ekst = Path(nama).stem, Path(nama).suffix.lower()
    if ekst not in JENIS[jenis]:
        raise GalatResizer(f"Format {ekst or 'tanpa ekstensi'} tidak didukung di sini. Pilih {', '.join(JENIS[jenis])}.")
    if level not in LEVEL:
        level = "seimbang"
    # dengan target: naikkan level bertahap (dan untuk PDF satu tingkat ekstra) sampai di bawah target
    urutan = [level] if not target_kb else list(LEVEL) + (["maksimal"] if jenis == "pdf" else [])
    hasil, ekst_baru, dipakai = data, None, None
    for lv in urutan:
        baru, e = _satu(jenis, data, lv, opsi)
        if len(baru) < len(hasil):
            hasil, ekst_baru, dipakai = baru, e, lv
        if target_kb and len(hasil) <= target_kb * 1024:
            break
    if jenis == "gambar" and target_kb and len(hasil) > target_kb * 1024:
        # masih di atas target: turunkan mutu dan dimensi; PNG dicoba sebagai WebP (tetap mendukung transparansi)
        pilihan = opsi.get("format_keluar")
        format_coba = pilihan if pilihan in FORMAT else "webp" if ekst in (".png", ".bmp", ".tif", ".tiff") else "sama"
        for mutu, sisi in ((55, 1600), (45, 1280), (38, 1024), (30, 800)):
            baru, e = kecilkan_gambar(data, "kuat", format_coba, sisi, mutu)
            if len(baru) < len(hasil):
                hasil, ekst_baru, dipakai = baru, e, "kuat"
            if len(hasil) <= target_kb * 1024:
                break
    asli = hasil is data
    awal, akhir = len(data), len(hasil)
    laporan = {
        "awal_kb": round(awal / 1024, 1), "akhir_kb": round(akhir / 1024, 1),
        "hemat_persen": round((awal - akhir) * 100 / awal) if awal else 0,
        "level": dipakai or level, "target_kb": target_kb,
        "tercapai": (akhir <= target_kb * 1024) if target_kb else None,
        "sudah_optimal": asli,
        "format_berubah": bool(ekst_baru) and ekst_baru.replace(".jpeg", ".jpg") != ekst.replace(".jpeg", ".jpg"),
    }
    ekst_akhir = ekst if asli or not ekst_baru else ekst_baru
    return hasil, f"{stem}_kecil{ekst_akhir}", laporan
