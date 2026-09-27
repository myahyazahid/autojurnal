"""Menulis temuan sebagai KOMENTAR ASLI Word pada salinan naskah."""
from __future__ import annotations

import re
from collections import Counter, defaultdict

from docx.text.paragraph import Paragraph
from docx.text.run import Run

from .docmodel import DocModel, Para, q
from .profil import Profil
from .temuan import Temuan


def _awalan(t: Temuan) -> str:
    if t.sumber == "ai":
        return f"[SARAN AI · {t.kategori}]"
    return f"[{'WAJIB' if t.tingkat == 'wajib' else 'SARAN'} · {t.kategori}]"


def _runs_jangkar(dm: DocModel, p: Para) -> list[Run]:
    parent = Paragraph(p.el, dm.doc._body)
    kandidat = [r.el for r in p.runs if r.teks.strip() or r.el.find(f".//{q('drawing')}") is not None]
    langsung = [r for r in kandidat if r.getparent() is p.el]
    pakai = langsung or kandidat
    if not pakai:
        pakai = [p.el.add_r()]
    return [Run(pakai[0], parent), Run(pakai[-1], parent)]


def _inisial(nama: str) -> str:
    kata = [w for w in re.split(r"[\s(]+", nama.split("@")[0]) if w and w[0].isalnum()]
    return "".join(w[0] for w in kata)[:3].upper() or "AJ"


def tulis_komentar(dm: DocModel, temuan: list[Temuan], prof: Profil, nama_jurnal: str,
                   penulis: str | None = None, pemeriksa: str | None = None) -> list[dict]:
    """Tulis komentar ke dm.doc (belum disimpan). Kembalikan temuan + status tampil/diringkas.

    `penulis` = nama yang tampil sebagai pembuat komentar di Word (akun yang login);
    `pemeriksa` = identitas lengkap (nama <email>) yang dicantumkan di komentar ringkasan.
    """
    doc = dm.doc
    batas = max(1, prof.komentar.maks_komentar_per_masalah)
    penulis = (penulis or prof.komentar.nama_pemeriksa or "AutoJurnal").strip()
    inisial = _inisial(penulis)

    per_kelompok: dict[str, list[Temuan]] = defaultdict(list)
    for t in temuan:
        if t.kelompok and t.para is not None:
            per_kelompok[t.kelompok].append(t)
    diringkas: set[int] = set()
    tambahan: dict[int, int] = {}
    for daftar in per_kelompok.values():
        if len(daftar) > batas:
            diringkas.update(id(t) for t in daftar[batas:])
            tambahan[id(daftar[batas - 1])] = len(daftar) - batas

    per_para: dict[int, list[Temuan]] = defaultdict(list)
    dokumen: list[Temuan] = []
    for t in temuan:
        if id(t) in diringkas:
            continue
        (dokumen if t.para is None else per_para[t.para]).append(t)

    def baris(t: Temuan) -> str:
        s = f"{_awalan(t)} {t.pesan}"
        if id(t) in tambahan:
            s += f" (Masalah yang sama juga ada di {tambahan[id(t)]} tempat lain.)"
        return s

    for pi in sorted(per_para):
        daftar = per_para[pi]
        p = dm.paras[pi]
        try:
            runs = _runs_jangkar(dm, p)
        except Exception:
            dokumen.extend(daftar)
            continue
        doc.add_comment(runs, text="\n".join(baris(t) for t in daftar), author=penulis, initials=inisial)

    # --- komentar ringkasan di judul ------------------------------------------
    jangkar = next((p for p in dm.paras if p.peran == "judul" and not p.kosong), None) or next(
        (p for p in dm.paras if not p.kosong), None)
    if jangkar is not None:
        unik: dict[str, Temuan] = {}
        for i, t in enumerate(temuan):
            unik.setdefault(t.kelompok or f"#{i}", t)
        hit = Counter("ai" if t.sumber == "ai" else t.tingkat for t in unik.values())
        bagian = [f"{hit['wajib']} wajib", f"{hit['saran']} saran"] + ([f"{hit['ai']} saran AI"] if hit["ai"] else [])
        isi = [
            f"HASIL CEK OTOMATIS — {nama_jurnal}",
            f"{len(unik)} jenis masalah ({', '.join(bagian)}), muncul di {len(temuan)} tempat.",
        ]
        if pemeriksa:
            isi.append(f"Diperiksa oleh: {pemeriksa} · AutoJurnal")
        if dokumen:
            isi.append("")
            isi.append("Masalah tingkat dokumen:")
            isi.extend(f"• {baris(t)}" for t in dokumen)
        isi.append("")
        isi.append("WAJIB = tidak sesuai aturan template. SARAN = perlu dicek manual. Rincian ada di komentar masing-masing bagian.")
        doc.add_comment(_runs_jangkar(dm, jangkar), text="\n".join(isi), author=penulis, initials=inisial)

    hasil = []
    for t in temuan:
        d = t.ke_dict()
        d["diringkas"] = id(t) in diringkas
        d["cuplikan"] = dm.paras[t.para].cuplikan(90) if t.para is not None else None
        hasil.append(d)
    return hasil
