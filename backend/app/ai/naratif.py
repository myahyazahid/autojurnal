"""AI mengecek ATURAN NARATIF (substansi) per bagian naskah -> Temuan bersumber 'ai'."""
from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher

from ..engine import katalog as KT
from ..engine import teks as T
from ..engine.docmodel import DocModel, Para
from ..engine.profil import AturanNaratif, Profil
from ..engine.temuan import Temuan
from .klien import KlienAI, ambil_json

SISTEM = (
    "Kamu reviewer jurnal ilmiah yang teliti dan adil. Nilai apakah bagian naskah memenuhi setiap aturan. "
    "Anggap sesuai bila aturan terpenuhi secara wajar; tandai tidak sesuai hanya bila jelas kurang. "
    "Tulis penjelasan singkat, konkret, dan sopan dalam bahasa Indonesia. Balas HANYA JSON."
)
MAKS_KARAKTER = 24000


def _paras_bagian(dm: DocModel, bagian: str) -> tuple[list[Para], Para | None]:
    isi = [p for p in dm.paras if not p.kosong]
    nb = T.normalisasi_judul(bagian)
    if nb == "abstrak":
        ps = [p for p in isi if p.peran in ("abstrak", "abstrak_inggris")]
        return ps, (ps[0] if ps else None)
    if nb == "seluruh naskah":
        ps = [p for p in isi if p.peran in ("abstrak", "judul_bagian", "sub_judul", "teks_isi")]
        return ps, next((p for p in isi if p.peran == "judul"), None)
    heads = [p for p in isi if p.peran == "judul_bagian"]
    kan = T.kanonik_bagian(nb)

    def skor(h: Para) -> float:
        nh = T.normalisasi_judul(h.bersih)
        if nh == nb or (kan and T.kanonik_bagian(nh) == kan):
            return 1.0
        return SequenceMatcher(None, nh, nb).ratio()

    if not heads:
        return [], None
    h = max(heads, key=skor)
    if skor(h) < 0.6:
        return [], None
    idx = heads.index(h)
    akhir = heads[idx + 1].i if idx + 1 < len(heads) else len(dm.paras)
    ps = [p for p in dm.paras[h.i + 1: akhir] if not p.kosong and p.peran in ("teks_isi", "sub_judul", "judul_tabel", "judul_gambar")]
    return ps, h


def _cek_satu(klien: KlienAI, prof: Profil, bagian: str, aturan: list[AturanNaratif], ps: list[Para], jangkar: Para) -> list[Temuan]:
    teks, n = [], 0
    for p in ps:
        baris = f"[P{p.i}] {p.bersih}"
        if n + len(baris) > MAKS_KARAKTER:
            break
        teks.append(baris)
        n += len(baris)
    daftar = "\n".join(f"{k + 1}. {a.aturan}" for k, a in enumerate(aturan))
    pesan = (
        f"BAGIAN NASKAH: {bagian}\n"
        "Setiap paragraf diawali penanda [P<nomor>].\n\n"
        + "\n".join(teks)
        + f"\n\nATURAN YANG HARUS DINILAI:\n{daftar}\n\n"
        'Balas JSON: {"hasil": [{"no": <nomor aturan>, "sesuai": true/false, "penjelasan": "...", '
        '"paragraf": <nomor P paling relevan atau null>}]}'
    )
    data = ambil_json(klien.chat([{"role": "system", "content": SISTEM}, {"role": "user", "content": pesan}], maks_token=8000))
    sah = {p.i for p in ps}
    hasil = []
    for item in data.get("hasil") or []:
        try:
            no = int(item.get("no")) - 1
        except (TypeError, ValueError):
            continue
        if not (0 <= no < len(aturan)) or item.get("sesuai") is not False:
            continue
        para = item.get("paragraf")
        try:
            para = int(str(para).lstrip("Pp"))
        except (TypeError, ValueError):
            para = None
        hasil.append(KT.temuan(
            prof, f"Naratif · {bagian}", "naratif.tidak_sesuai", para=para if para in sah else jangkar.i, sumber="ai",
            aturan=aturan[no].aturan.rstrip("."), penjelasan=str(item.get("penjelasan") or "").strip(), bagian=bagian,
        ))
    return hasil


def cek_naratif(klien: KlienAI, dm: DocModel, prof: Profil) -> list[Temuan]:
    per_bagian: dict[str, list[AturanNaratif]] = defaultdict(list)
    for a in prof.aturan_naratif:
        if a.aktif and a.aturan.strip():
            per_bagian[a.bagian or "Seluruh naskah"].append(a)
    tugas, hasil = [], []
    for bagian, aturan in per_bagian.items():
        ps, jangkar = _paras_bagian(dm, bagian)
        if not ps or jangkar is None:
            hasil.append(KT.temuan(prof, f"Naratif · {bagian}", "naratif.bagian_tidak_ada", sumber="ai", bagian=bagian))
            continue
        tugas.append((bagian, aturan, ps, jangkar))
    galat = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(_cek_satu, klien, prof, *t) for t in tugas]
        for f, t in zip(futures, tugas):
            try:
                hasil.extend(f.result())
            except Exception as e:
                galat.append((t[0], str(e)))
    if tugas and len(galat) == len(tugas):
        raise RuntimeError("Pengecekan AI gagal: " + "; ".join(f"{b}: {g}" for b, g in galat)[:400])
    for b, g in galat:
        hasil.append(KT.temuan(prof, "Naratif", "naratif.gagal", sumber="ai", bagian=b, galat=g[:200]))
    return hasil
