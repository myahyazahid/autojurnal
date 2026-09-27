from __future__ import annotations

from dataclasses import asdict, dataclass

TINGKAT = ("wajib", "saran")


@dataclass
class Temuan:
    kategori: str
    pesan: str
    tingkat: str = "wajib"  # wajib = melanggar aturan template | saran = perlu dicek manusia
    para: int | None = None  # indeks paragraf jangkar komentar; None = tingkat dokumen
    kelompok: str | None = None  # masalah sejenis dikelompokkan agar komentar tidak membanjir
    sumber: str = "bot"  # bot | ai
    kode: str | None = None  # kunci di katalog komentar (engine/katalog.py)

    def ke_dict(self) -> dict:
        return asdict(self)
