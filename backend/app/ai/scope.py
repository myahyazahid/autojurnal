"""AI menilai KESESUAIAN naskah dengan Focus & Scope jurnal -> putusan terima/tolak + alasan singkat."""
from __future__ import annotations

import re

from ..engine import teks as T
from ..engine.docmodel import DocModel, Para
from ..engine.profil import Profil
from .klien import GalatAI, KlienAI, ambil_json

SISTEM = (
    "Kamu editor jurnal ilmiah yang melakukan desk review kesesuaian naskah dengan Focus & Scope jurnal. "
    "Nilai secara MENYELURUH: masalah penelitian, objek, metode, dan terutama KONTRIBUSI UTAMA naskah — "
    "bukan sekadar kecocokan kata kunci. Daftar scope sering bersifat 'meliputi tetapi tidak terbatas pada', "
    "jadi pertimbangkan semangat bidang jurnal. Putuskan 'terima' bila kontribusi utama naskah berada dalam bidang "
    "jurnal; 'tolak' bila kontribusi utamanya di luar bidang (mis. teknologi hanya dipakai sebagai alat bantu tanpa "
    "kontribusi pada bidang jurnal). Balas HANYA dengan satu objek JSON."
)
MAKS_KARAKTER = 14000


def _tanpa_label(p: Para) -> str:
    t = p.bersih
    if p.label_inline and t.startswith(p.label_inline):
        t = t[len(p.label_inline):]
    return t.strip()


def ringkas_naskah(dm: DocModel) -> str:
    """Judul, abstrak, kata kunci, struktur, dan cuplikan awal setiap bagian utama."""
    isi = [p for p in dm.paras if not p.kosong]
    ambil = lambda *peran: " ".join(_tanpa_label(p) for p in isi if p.peran in peran)  # noqa: E731
    bagian = [
        f"JUDUL: {ambil('judul')}",
        f"JUDUL (EN): {ambil('judul_inggris')}" if ambil("judul_inggris") else "",
        f"ABSTRAK: {ambil('abstrak')}",
        f"ABSTRACT (EN): {ambil('abstrak_inggris')}" if ambil("abstrak_inggris") else "",
        f"KATA KUNCI: {ambil('kata_kunci', 'kata_kunci_inggris')}",
        "STRUKTUR: " + " | ".join(T._NOMOR.sub("", p.bersih).strip() for p in isi if p.peran in ("judul_bagian", "sub_judul")),
    ]
    teks = "\n".join(b for b in bagian if b)
    heads = [p for p in isi if p.peran == "judul_bagian" and not T.adalah_daftar_pustaka(T.normalisasi_judul(p.bersih))]
    sisa = MAKS_KARAKTER - len(teks)
    jatah = max(600, sisa // max(len(heads), 1))
    for k, h in enumerate(heads):
        akhir = heads[k + 1].i if k + 1 < len(heads) else len(dm.paras)
        badan = " ".join(p.bersih for p in dm.paras[h.i + 1: akhir] if p.peran == "teks_isi" and not p.kosong)
        if badan:
            teks += f"\n\n[{T._NOMOR.sub('', h.bersih).strip()}]\n{re.sub(r'\s+', ' ', badan)[:jatah]}"
    return teks[: MAKS_KARAKTER + 2000]


def nilai_scope(klien: KlienAI, dm: DocModel, prof: Profil) -> dict:
    scope = prof.scope.fokus_dan_ruang_lingkup.strip()
    pesan = (
        f"FOCUS & SCOPE JURNAL:\n{scope[:6000]}\n\n"
        f"NASKAH (ringkasan menyeluruh):\n{ringkas_naskah(dm)}\n\n"
        'Balas JSON: {"keputusan": "terima" atau "tolak", "skor": 0-100 (tingkat kesesuaian), '
        '"bidang_cocok": [maks. 3 bidang dari daftar scope yang paling sesuai, kosong bila tidak ada], '
        '"alasan": "maks. 2 kalimat, bahasa Indonesia, sebutkan kontribusi utama naskah dan kaitannya dengan scope"}'
    )
    data = ambil_json(klien.chat([{"role": "system", "content": SISTEM}, {"role": "user", "content": pesan}], suhu=0.1))
    keputusan = str(data.get("keputusan", "")).strip().lower()
    if keputusan not in ("terima", "tolak"):
        raise GalatAI(f"Putusan scope dari AI tidak dikenali: {keputusan or 'kosong'}")
    try:
        skor = max(0, min(100, int(float(data.get("skor", 0)))))
    except (TypeError, ValueError):
        skor = None
    bidang = [str(b).strip() for b in (data.get("bidang_cocok") or []) if str(b).strip()][:3]
    return {"keputusan": keputusan, "skor": skor, "bidang_cocok": bidang,
            "alasan": str(data.get("alasan", "")).strip()[:600], "model": klien.model}
