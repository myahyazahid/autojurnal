"""AI membaca teks petunjuk template/panduan -> memperbaiki & melengkapi profil hasil bot."""
from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ValidationError

from ..engine.profil import AturanNaratif, Profil
from .klien import KlienAI, ambil_json

SISTEM = (
    "Kamu asisten redaksi jurnal ilmiah Indonesia. Tugasmu membaca template/panduan penulisan jurnal lalu "
    "memperbaiki dan melengkapi PROFIL ATURAN berbentuk JSON. Isi hanya nilai yang benar-benar disebut atau "
    "dicontohkan di template; jangan mengarang. Balas HANYA dengan satu objek JSON tanpa penjelasan lain."
)


def _peta_teks(peta: list[dict], batas: int = 45000) -> str:
    baris = []
    for p in peta:
        s = f"[{p['label']}] {p['teks']}"
        if p.get("petunjuk"):
            s += "  {petunjuk: " + " | ".join(p["petunjuk"]) + "}"
        baris.append(s)
    teks = "\n".join(baris)
    return teks[:batas]


def _gabung(dasar: dict, tambahan: dict) -> dict:
    for k, v in tambahan.items():
        if k not in dasar:
            continue
        if isinstance(v, dict) and isinstance(dasar[k], dict):
            _gabung(dasar[k], v)
        else:
            dasar[k] = v
    return dasar


def _ratakan(model: BaseModel, awalan: tuple[str, ...] = ()) -> dict[tuple[str, ...], tuple[str, Any]]:
    """{jalur: (judul yang mudah dibaca, nilai)} untuk semua nilai skalar."""
    hasil: dict = {}
    for nama, info in type(model).model_fields.items():
        if nama in ("catatan_ekstraksi", "aturan_naratif", "teks_komentar"):
            continue
        v = getattr(model, nama)
        judul = awalan + ((info.title or nama),)
        if isinstance(v, BaseModel):
            for jalur, isi in _ratakan(v, judul).items():
                hasil[(nama,) + jalur] = isi
        elif not isinstance(v, list):
            hasil[(nama,)] = (" › ".join(judul), v)
    return hasil


def _tampil(v: Any) -> str:
    if v is None:
        return "tidak dicek"
    if isinstance(v, bool):
        return "ya" if v else "tidak"
    return str(v).replace("_", " ")


def perbaiki_dengan_ai(klien: KlienAI, prof: Profil, peta: list[dict], panduan: str = "") -> tuple[Profil, list[str]]:
    judul_bagian = [b.judul for b in prof.struktur.bagian]
    dasar = prof.model_dump(exclude={"catatan_ekstraksi", "aturan_naratif", "scope", "teks_komentar"})  # diisi manual
    dasar_tanpa_bagian = json.loads(json.dumps(dasar))
    dasar_tanpa_bagian["struktur"].pop("bagian", None)
    pesan_user = (
        "ISI TEMPLATE (tiap baris: [peran terdeteksi] teks; petunjuk dalam kurung ditulis sebagai {petunjuk: ...}):\n"
        f"{_peta_teks(peta)}\n\n"
        + (f"PANDUAN PENULIS TAMBAHAN:\n{panduan[:20000]}\n\n" if panduan.strip() else "")
        + "PROFIL HASIL BACAAN OTOMATIS (perbaiki/lengkapi):\n"
        f"{json.dumps(dasar_tanpa_bagian, ensure_ascii=False)}\n\n"
        "ATURAN PENGISIAN:\n"
        '- Balas objek JSON dengan kunci "profil", "aturan_naratif", "catatan".\n'
        '- "profil": struktur sama persis dengan profil di atas; ubah hanya nilai yang perlu diperbaiki/dilengkapi.\n'
        "- null = tidak dicek. Ukuran font dalam pt, margin/kertas dalam cm, spasi_baris dalam kelipatan (1 = tunggal).\n"
        "- perataan: kiri | tengah | kanan | rata_kanan_kiri. gaya_sitasi: penulis_tahun | numerik | otomatis. "
        "urutan: abjad | kemunculan. abstrak_inggris & judul_inggris: wajib | opsional | tidak_boleh.\n"
        "- garis_tabel: horizontal (tanpa garis vertikal) | grid | tanpa_garis. perataan_tabel & perataan_gambar: tengah | kiri. "
        "bahasa: indonesia | inggris. manajer_referensi: wajib | disarankan. min_dpi_gambar dalam dpi. "
        "sumber_terlarang: daftar kata seperti wikipedia, blog. Isi aturan ini hanya bila template menyebutnya.\n"
        '- "aturan_naratif": daftar {"bagian": ..., "aturan": ...} berisi aturan ISI/SUBSTANSI yang butuh pemahaman '
        "(mis. 'Pendahuluan memuat kesenjangan penelitian dan tujuan di akhir'). Tulis ringkas, spesifik, bisa dicek; "
        "jangan masukkan aturan format (font, spasi, margin). Maksimal 12.\n"
        f'- "bagian" harus salah satu dari: "Abstrak", "Seluruh naskah", {", ".join(json.dumps(j) for j in judul_bagian)}.\n'
        '- "catatan": daftar kalimat singkat tentang hal yang ambigu atau bertentangan di template.'
    )
    jawab = klien.chat([{"role": "system", "content": SISTEM}, {"role": "user", "content": pesan_user}], maks_token=16000)
    data = ambil_json(jawab)

    baru = json.loads(json.dumps(dasar))
    usulan = data.get("profil")
    if isinstance(usulan, dict):
        if isinstance(usulan.get("struktur"), dict):
            usulan["struktur"].pop("bagian", None)  # struktur bagian tetap dari bot (dibaca dari heading template)
        _gabung(baru, usulan)
    catatan = [c for c in prof.catatan_ekstraksi if "tanpa AI" not in c]
    # validasi per bagian profil: bagian yang usulannya tidak valid tetap memakai hasil bot
    diterima = json.loads(json.dumps(dasar))
    ditolak = []
    for kunci in dasar:
        try:
            Profil.model_validate({**diterima, kunci: baru[kunci]})
            diterima[kunci] = baru[kunci]
        except ValidationError:
            ditolak.append(kunci)
    if ditolak:
        catatan.append(f"Usulan AI untuk bagian {', '.join(ditolak)} tidak valid sehingga diabaikan.")
    hasil = Profil.model_validate(diterima)

    naratif = []
    for item in data.get("aturan_naratif") or []:
        try:
            a = AturanNaratif.model_validate(item)
            if a.aturan.strip():
                naratif.append(a)
        except ValidationError:
            continue
    hasil.aturan_naratif = naratif[:12] or prof.aturan_naratif
    hasil.scope = prof.scope
    hasil.teks_komentar = prof.teks_komentar

    lama, kini = _ratakan(prof), _ratakan(hasil)
    ubah = [f"AI mengubah {kini[j][0]}: {_tampil(lama[j][1])} → {_tampil(kini[j][1])}." for j in kini if j in lama and lama[j][1] != kini[j][1]]
    catatan.extend(ubah[:25])
    catatan.extend(f"Catatan AI: {c}" for c in (data.get("catatan") or []) if isinstance(c, str))
    catatan.append("Profil dibaca bot lalu diperiksa AI. Tetap periksa setiap bagian sebelum disimpan.")
    hasil.catatan_ekstraksi = catatan
    return hasil, ubah
