"""Menulis temuan sebagai KOMENTAR ASLI Word pada salinan naskah."""
from __future__ import annotations

import re
from collections import defaultdict

from docx.text.paragraph import Paragraph
from docx.text.run import Run

from .docmodel import DocModel, Para, q
from .katalog import aktif, teks
from .profil import Profil
from .temuan import Temuan


def _awalan(kustom: dict, t: Temuan) -> str:
    kode = "label.ai" if t.sumber == "ai" else ("label.wajib" if t.tingkat == "wajib" else "label.saran")
    return teks(kustom, kode, kategori=t.kategori)


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
                   penulis: str | None = None, pemeriksa: str | None = None, scope: dict | None = None) -> list[dict]:
    """Tulis komentar ke dm.doc (belum disimpan). Kembalikan temuan + status tampil/diringkas.

    `penulis` = nama yang tampil sebagai pembuat komentar di Word (akun yang login);
    `pemeriksa` = identitas lengkap (nama <email>) yang dicantumkan di komentar ringkasan.
    """
    doc = dm.doc
    ko = prof.komentar
    kustom = prof.teks_komentar
    batas = max(1, ko.maks_komentar_per_masalah)
    penulis = (penulis or ko.nama_pemeriksa or "AutoJurnal").strip()
    inisial = _inisial(penulis)

    # yang masuk ke Word: pelanggaran wajib + hasil AI (bila dipakai); saran hanya bila diaktifkan di profil
    masuk = [t for t in temuan if t.tingkat == "wajib" or t.sumber == "ai" or ko.tulis_saran]
    id_masuk = {id(t) for t in masuk}

    per_kelompok: dict[str, list[Temuan]] = defaultdict(list)
    for t in masuk:
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
    for t in masuk:
        if id(t) in diringkas:
            continue
        (dokumen if t.para is None else per_para[t.para]).append(t)

    def baris(t: Temuan) -> str:
        label = "label.ai" if t.sumber == "ai" else ("label.wajib" if t.tingkat == "wajib" else "label.saran")
        s = f"{_awalan(kustom, t)} {t.pesan}" if ko.label_kategori and aktif(prof, label) else t.pesan
        if id(t) in tambahan and aktif(prof, "ringkasan.masalah_sama"):
            s += " " + teks(kustom, "ringkasan.masalah_sama", jumlah=tambahan[id(t)])
        return s

    for pi in sorted(per_para):
        daftar = per_para[pi]
        p = dm.paras[pi]
        try:
            runs = _runs_jangkar(dm, p)
        except Exception:
            dokumen.extend(daftar)
            continue
        for t in daftar:  # satu komentar per kesalahan
            doc.add_comment(runs, text=baris(t), author=penulis, initials=inisial)

    # --- komentar ringkasan di judul ------------------------------------------
    jangkar = next((p for p in dm.paras if p.peran == "judul" and not p.kosong), None) or next(
        (p for p in dm.paras if not p.kosong), None)
    if jangkar is not None:
        unik: dict[str, Temuan] = {}
        for i, t in enumerate(masuk):
            unik.setdefault(t.kelompok or f"#{i}", t)
        def tambah(kode: str, **data):
            if aktif(prof, kode):
                isi.append(teks(kustom, kode, **data).strip())

        isi: list[str] = []
        tambah("ringkasan.judul", jurnal=nama_jurnal)
        if scope and scope.get("keputusan"):
            kode = "ringkasan.scope_sesuai" if scope["keputusan"] == "terima" else "ringkasan.scope_tidak_sesuai"
            skor = f"{scope['skor']}/100" if scope.get("skor") is not None else "tanpa skor"
            tambah(kode, skor=skor, alasan=scope.get("alasan") or "")
        if unik:
            tambah("ringkasan.jumlah", jumlah=len(unik), tempat=len(masuk))
        else:
            tambah("ringkasan.nihil")
        if pemeriksa:
            tambah("ringkasan.pemeriksa", pemeriksa=pemeriksa)
        if dokumen:
            isi.append("")
            isi.extend(f"• {baris(t)}" for t in dokumen)
        if ko.label_kategori and aktif(prof, "label.keterangan"):
            isi.append("")
            isi.append(teks(kustom, "label.keterangan"))
        while isi and not isi[0]:
            isi.pop(0)
        if isi:
            doc.add_comment(_runs_jangkar(dm, jangkar), text="\n".join(isi), author=penulis, initials=inisial)

    hasil = []
    for t in temuan:
        d = t.ke_dict()
        d["diringkas"] = id(t) in diringkas
        d["ditulis"] = id(t) in id_masuk and id(t) not in diringkas
        d["cuplikan"] = dm.paras[t.para].cuplikan(90) if t.para is not None else None
        hasil.append(d)
    return hasil
