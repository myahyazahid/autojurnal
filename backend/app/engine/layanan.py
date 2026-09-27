"""Titik masuk mesin: cek satu naskah terhadap profil, tulis salinan .docx berkomentar."""
from __future__ import annotations

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import IO, Callable

from .anotasi import tulis_komentar
from .docmodel import DocModel
from .periksa import periksa
from .profil import Profil
from .temuan import Temuan

PemeriksaTambahan = Callable[[DocModel, Profil], list[Temuan]]
PenilaiScope = Callable[[DocModel, Profil], dict]


def cek_naskah(
    sumber: str | Path | IO[bytes],
    prof: Profil,
    nama_jurnal: str,
    keluaran: str | Path,
    tambahan: PemeriksaTambahan | None = None,
    penulis: str | None = None,
    pemeriksa: str | None = None,
    penilai_scope: PenilaiScope | None = None,
) -> dict:
    dm = DocModel(sumber if not isinstance(sumber, Path) else str(sumber))
    temuan, stat = periksa(dm, prof)

    # AI (naratif & scope) berjalan paralel; kegagalan AI tidak boleh menggagalkan cek bot
    galat_ai, scope = None, None
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_naratif = ex.submit(tambahan, dm, prof) if tambahan else None
        f_scope = ex.submit(penilai_scope, dm, prof) if penilai_scope else None
        if f_naratif:
            try:
                temuan.extend(f_naratif.result())
            except Exception as e:
                galat_ai = str(e)
        if f_scope:
            try:
                scope = f_scope.result()
            except Exception as e:
                scope = {"galat": f"Penilaian scope gagal: {e}"}

    daftar = tulis_komentar(dm, temuan, prof, nama_jurnal, penulis=penulis, pemeriksa=pemeriksa, scope=scope)
    dm.doc.save(str(keluaran))
    # "masalah" = jenis masalah unik (kemunculan berulang dihitung satu), "kemunculan" = semua temuan
    unik: dict[str, Temuan] = {}
    for i, t in enumerate(temuan):
        unik.setdefault(t.kelompok or f"#{i}", t)
    masalah = list(unik.values())
    return {
        "ringkasan": {
            "masalah": len(masalah),
            "kemunculan": len(temuan),
            "di_word": sum(1 for d in daftar if d["ditulis"]),  # yang benar-benar ditulis sebagai komentar
            "wajib": sum(1 for t in masalah if t.tingkat == "wajib" and t.sumber == "bot"),
            "saran": sum(1 for t in masalah if t.tingkat == "saran" and t.sumber == "bot"),
            "ai": sum(1 for t in masalah if t.sumber == "ai"),
            "per_kategori": dict(Counter(t.kategori for t in masalah)),
        },
        "statistik": stat,
        "temuan": daftar,
        "galat_ai": galat_ai,
        "scope": scope,
    }
