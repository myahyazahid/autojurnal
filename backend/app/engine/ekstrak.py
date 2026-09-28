"""Template jurnal (.docx) -> Profil aturan, tanpa AI.

Tiga lapis sumber, yang belakangan menimpa yang duluan:
  1. format yang TERLIHAT pada contoh di template (style/format langsung),
  2. kalimat instruksi di badan template ("Teks utama ... Times New Roman 12 pt ..."),
  3. petunjuk dalam kurung yang menempel pada elemennya ("[Times New Roman 11 Bold Center]").
Setiap konflik antar lapis dicatat di `catatan_ekstraksi` untuk ditinjau manusia.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import IO, Any

from . import teks as T
from .docmodel import DocModel, Para
from .klasifikasi import PERAN_LABEL, klasifikasi
from .petunjuk import baca_format, sasaran_kalimat
from .profil import AturanNaratif, Bagian, FormatElemen, Profil

PERAN_FORMAT = {
    "judul": ["judul"],
    "judul_inggris": ["judul_inggris"],
    "info_penulis": ["info_penulis"],
    "abstrak": ["abstrak"],
    "abstrak_inggris": ["abstrak_inggris"],
    "kata_kunci": ["kata_kunci", "kata_kunci_inggris"],
    "judul_bagian": ["judul_bagian"],
    "sub_judul": ["sub_judul"],
    "teks_isi": ["teks_isi"],
    "judul_tabel": ["judul_tabel"],
    "isi_tabel": ["isi_tabel"],
    "judul_gambar": ["judul_gambar"],
    "sumber": ["sumber"],
    "daftar_pustaka": ["daftar_pustaka"],
}
PERAN_JUDUL = {"judul", "judul_inggris", "judul_bagian", "sub_judul"}
# indentasi daftar pustaka tidak diambil dari contoh: contoh referensi di template sering usang
PERAN_INDENTASI = {"teks_isi", "abstrak", "abstrak_inggris"}


def _dominan(nilai_bobot: list[tuple[Any, str, float]]) -> tuple[Any, str, float]:
    skor: dict[Any, float] = defaultdict(float)
    src: dict[Any, str] = {}
    for v, s, w in nilai_bobot:
        skor[v] += w
        if src.get(v) != "langsung":
            src[v] = s
    if not skor:
        return None, "default", 0.0
    total = sum(skor.values())
    v = max(skor, key=skor.get)
    return v, src[v], skor[v] / total


def _amati(paras: list[Para], peran: str) -> tuple[dict, dict]:
    """Format yang teramati pada contoh -> (nilai, sumber)."""
    nilai: dict[str, Any] = {}
    sumber: dict[str, str] = {}
    fonts, ukuran, perataan, spasi, indent = [], [], [], [], []
    tebal_n = miring_n = total = 0.0
    for p in paras:
        for r in p.runs:
            n = len(r.teks.strip())
            if not n:
                continue
            fonts.append((r.font[0], r.font[1], n))
            ukuran.append((r.ukuran[0], r.ukuran[1], n))
            tebal_n += n * r.tebal
            miring_n += n * r.miring
            total += n
        w = max(len(p.bersih), 1)
        a, s = p.pp.get("perataan", ("kiri", "default"))
        perataan.append((a, s, w))
        sp, s = p.pp.get("spasi", (("kali", 1.0), "default"))
        if sp[0] == "kali":
            spasi.append((sp[1], s, w))
        if not p.pp_nilai("bernomor"):
            ind, s = p.pp.get("indentasi", (0.0, "default"))
            indent.append((round(ind * 20) / 20, s, w))
    for kunci, data in (("font", fonts), ("ukuran_pt", ukuran)):
        v, s, porsi = _dominan(data)
        if v is not None and porsi >= 0.6:
            nilai[kunci], sumber[kunci] = v, s
    if total:
        if tebal_n / total >= 0.8:
            nilai["tebal"] = True
        elif tebal_n / total <= 0.2:
            nilai["tebal"] = False
        if miring_n / total >= 0.8:
            nilai["miring"] = True
        sumber["tebal"] = sumber["miring"] = "langsung"
    if peran == "isi_tabel":  # perataan/spasi sel tabel sangat bervariasi; cukup font & ukuran
        return nilai, sumber
    for kunci, data in (("perataan", perataan), ("spasi_baris", spasi)):
        v, s, porsi = _dominan(data)
        if v is not None and porsi >= 0.6:
            nilai[kunci], sumber[kunci] = v, s
    if peran in PERAN_INDENTASI:
        v, s, porsi = _dominan(indent)
        if v is not None and porsi >= 0.6:
            nilai["indentasi_pertama_cm"], sumber["indentasi_pertama_cm"] = (0.0 if abs(v) < 0.05 else v), s
    if peran in PERAN_JUDUL:
        if all(T.huruf_kapital_semua(T._NOMOR.sub("", p.bersih)) or (p.rasio("kapital") or 0) > 0.9 for p in paras):
            nilai["kapital"], sumber["kapital"] = True, "langsung"
    return nilai, sumber


def _kalimat(teks: str) -> list[str]:
    return [k for k in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(\[*])|\n", teks) if k.strip()]


_ANGKA_RENTANG = r"(\d{1,4})\s*(?:s\.?\s*d\.?|sampai(?:\s+dengan)?|hingga|[-–—]|to)\s*(\d{1,4})"


def _rentang_kata(teks: str) -> tuple[int | None, int | None]:
    tl = teks.lower()
    m = re.search(_ANGKA_RENTANG + r"\s*(?:kata|words)", tl)
    if m:
        return int(m.group(1)), int(m.group(2))
    mx = re.search(r"(?:maks(?:imal|imum)?\.?|max(?:imum)?\.?|tidak lebih dari|paling banyak|at most|no more than)\s*(\d{2,4})\s*(?:kata|words)", tl)
    mn = re.search(r"(?:min(?:imal|imum)?\.?|sekurang-kurangnya|paling sedikit|at least)\s*(\d{2,4})\s*(?:kata|words)", tl)
    return (int(mn.group(1)) if mn else None), (int(mx.group(1)) if mx else None)


class _Catat:
    def __init__(self):
        self.isi: list[str] = []

    def __call__(self, s: str):
        if s not in self.isi:
            self.isi.append(s)


def ekstrak_template(sumber: str | IO[bytes]) -> tuple[Profil, list[dict]]:
    dm = DocModel(sumber, mode="template")
    klasifikasi(dm)
    prof = Profil()
    catat = _Catat()
    per_peran: dict[str, list[Para]] = defaultdict(list)
    for p in dm.paras:
        if not p.kosong:
            per_peran[p.peran].append(p)

    # ---- 1. tata letak ------------------------------------------------------
    depan = per_peran.get("judul", [None])[0]
    isi_p = (per_peran.get("judul_bagian") or per_peran.get("teks_isi") or [None])[0]
    if dm.seksi:
        i_isi = isi_p.seksi if isi_p else 0
        s = dm.seksi[min(i_isi, len(dm.seksi) - 1)]
        tl = prof.tata_letak
        if s.page_width and s.page_height:
            tl.lebar_kertas_cm = round(s.page_width.cm, 1)
            tl.tinggi_kertas_cm = round(s.page_height.cm, 1)
            tl.orientasi = "lanskap" if s.page_width > s.page_height else "potret"
        for nama in ("top", "bottom", "left", "right"):
            v = getattr(s, f"{nama}_margin")
            if v is not None:
                setattr(tl, {"top": "margin_atas_cm", "bottom": "margin_bawah_cm", "left": "margin_kiri_cm",
                             "right": "margin_kanan_cm"}[nama], round(v.cm, 2))
        tl.kolom_isi = dm.kolom_seksi(i_isi)
        tl.kolom_bagian_depan = dm.kolom_seksi(depan.seksi) if depan else tl.kolom_isi
        catat(
            f"Tata letak dibaca dari pengaturan halaman template: {T.angka(tl.lebar_kertas_cm)} × "
            f"{T.angka(tl.tinggi_kertas_cm)} cm, margin atas/bawah/kiri/kanan "
            f"{T.angka(tl.margin_atas_cm)}/{T.angka(tl.margin_bawah_cm)}/{T.angka(tl.margin_kiri_cm)}/"
            f"{T.angka(tl.margin_kanan_cm)} cm, bagian depan {tl.kolom_bagian_depan} kolom, isi {tl.kolom_isi} kolom."
        )

    # ---- 2. format teramati -------------------------------------------------
    amatan: dict[str, tuple[dict, dict]] = {}
    for elemen, peran_list in PERAN_FORMAT.items():
        paras = [p for r in peran_list for p in per_peran.get(r, [])]
        if paras:
            amatan[elemen] = _amati(paras, elemen)
    isi_nilai = amatan.get("teks_isi", ({}, {}))[0]
    dibuang: list[tuple[str, str, Any]] = []
    for elemen, (nilai, sumber) in amatan.items():
        fe: FormatElemen = getattr(prof.format, elemen)
        for k, v in nilai.items():
            lemah = sumber.get(k) == "default" and elemen != "teks_isi"
            if lemah and k in ("font", "ukuran_pt") and isi_nilai.get(k) not in (None, v):
                dibuang.append((elemen, k, v))
                continue
            if sumber.get(k) == "default" and k in ("spasi_baris", "indentasi_pertama_cm", "perataan"):
                continue
            setattr(fe, k, v)

    # ---- 3. kalimat instruksi ----------------------------------------------
    for p in dm.paras:
        if p.kosong or p.peran not in ("teks_isi", "abstrak", "abstrak_inggris", "daftar_pustaka", "kata_kunci"):
            continue
        for k in _kalimat(p.teks):
            for elemen in sasaran_kalimat(k):
                atribut = {a: v for a, v in baca_format(k).items() if a != "maks_kata"}
                if elemen == "isi_tabel":
                    atribut.pop("perataan", None)
                _terapkan(prof, elemen, atribut, catat, f"kalimat petunjuk “{k.strip()[:90]}”")

    # ---- 4. petunjuk dalam kurung --------------------------------------------
    # Atribut hanya dipakai bila disebut oleh >= separuh paragraf berpetunjuk pada elemen itu dan
    # nilainya seragam (mis. "Bold" di baris nama penulis tidak berlaku untuk baris afiliasi).
    per_elemen: dict[str, list[dict]] = defaultdict(list)
    for p in dm.paras:
        if not p.petunjuk or p.peran in ("teks_isi", "kosong", "petunjuk", "depan_lain"):
            continue
        elemen = {"kata_kunci_inggris": "kata_kunci"}.get(p.peran, p.peran)
        gabung: dict = {}
        for h in p.petunjuk:
            gabung.update(baca_format(h))
        maks = gabung.pop("maks_kata", None)
        if maks and p.peran == "judul":
            prof.judul.maks_kata = maks
        elif maks and p.peran == "judul_inggris":
            prof.judul.maks_kata_inggris = maks
        if gabung and hasattr(prof.format, elemen):
            per_elemen[elemen].append(gabung)
    for elemen, daftar in per_elemen.items():
        atribut: dict = {}
        for k in {k for d in daftar for k in d}:
            nilai = [d[k] for d in daftar if k in d]
            if len(nilai) * 2 >= len(daftar) and len(set(nilai)) == 1:
                atribut[k] = nilai[0]
        _terapkan(prof, elemen, atribut, catat, "petunjuk di template")
    for elemen, k, v in dibuang:
        if getattr(getattr(prof.format, elemen), k) is None:
            catat(
                f"{type(prof.format).model_fields[elemen].title}: {'font' if k == 'font' else 'ukuran'} "
                f"{_tampil(v)} hanya bawaan Word (tidak diatur tegas di template) sehingga tidak dicek. "
                f"Isi manual bila perlu."
            )

    # ---- 5. aturan isi dari teks ---------------------------------------------
    semua = "\n".join(p.teks for p in dm.paras if p.teks.strip())
    kalimat_semua = _kalimat(semua)
    _aturan_judul(prof, per_peran, semua)
    _aturan_abstrak(prof, per_peran, kalimat_semua)
    _aturan_kata_kunci(prof, per_peran)
    _aturan_naskah(prof, kalimat_semua)
    _aturan_referensi(prof, semua, kalimat_semua, catat)
    _aturan_tabel_gambar(prof, per_peran, kalimat_semua)
    _aturan_lanjut(prof, dm, per_peran, kalimat_semua, catat)
    _struktur(prof, dm, semua, catat)
    _naratif(prof, dm)

    ringkas = []
    if prof.abstrak.min_kata or prof.abstrak.maks_kata:
        ringkas.append(f"abstrak {prof.abstrak.min_kata or '?'}–{prof.abstrak.maks_kata or '?'} kata")
    if prof.kata_kunci.min_jumlah or prof.kata_kunci.maks_jumlah:
        ringkas.append(f"kata kunci {prof.kata_kunci.min_jumlah or '?'}–{prof.kata_kunci.maks_jumlah or '?'}")
    if prof.referensi.min_jumlah:
        ringkas.append(f"minimal {prof.referensi.min_jumlah} referensi")
    if prof.referensi.gaya_sitasi != "otomatis":
        ringkas.append(f"sitasi {prof.referensi.gaya_sitasi.replace('_', '-')}")
    if ringkas:
        catat("Aturan isi yang terbaca dari teks template: " + ", ".join(ringkas) + ".")
    catat("Hasil ini dibaca otomatis tanpa AI. Mohon periksa setiap bagian sebelum disimpan.")
    prof.catatan_ekstraksi = catat.isi

    peta = [
        {
            "i": p.i,
            "peran": p.peran,
            "label": PERAN_LABEL.get(p.peran, p.peran),
            "level": p.level,
            "teks": p.cuplikan(110),
            "petunjuk": p.petunjuk,
        }
        for p in dm.paras
        if not p.kosong and p.peran not in ("isi_tabel", "kosong")
    ]
    return prof, peta


def _terapkan(prof: Profil, elemen: str, atribut: dict, catat, asal: str):
    fe: FormatElemen = getattr(prof.format, elemen)
    judul_el = type(prof.format).model_fields[elemen].title
    for k, v in atribut.items():
        if k not in FormatElemen.model_fields:
            continue
        lama = getattr(fe, k)
        if lama is not None and lama != v:
            catat(
                f"{judul_el}: contoh di template memakai {k.replace('_pt', '').replace('_', ' ')} "
                f"{_tampil(lama)}, tetapi {asal} menyebut {_tampil(v)}. Dipakai {_tampil(v)}, mohon dicek."
            )
        setattr(fe, k, v)


def _tampil(v) -> str:
    if isinstance(v, bool):
        return "ya" if v else "tidak"
    if isinstance(v, float):
        return T.angka(v)
    return str(v).replace("_", " ")


def _aturan_judul(prof: Profil, per_peran, semua: str):
    if per_peran.get("judul_inggris"):
        prof.judul.judul_inggris = "wajib"
    if prof.judul.maks_kata is None:
        m = re.search(
            r"judul[^.\n]{0,80}?(?:maks(?:imal|imum)?\.?|max\.?|tidak lebih dari|paling banyak)\s*(\d{1,3})\s*kata",
            semua, re.I)
        if m:
            prof.judul.maks_kata = int(m.group(1))


def _aturan_abstrak(prof: Profil, per_peran, kalimat: list[str]):
    ab = prof.abstrak
    teks_id = " ".join(p.teks for r in ("label_abstrak", "abstrak") for p in per_peran.get(r, []))
    teks_en = " ".join(p.teks for r in ("label_abstrak_inggris", "abstrak_inggris") for p in per_peran.get(r, []))
    ab.min_kata, ab.maks_kata = _rentang_kata(teks_id)
    if ab.min_kata is None and ab.maks_kata is None:
        for k in kalimat:
            if re.search(r"abstra", k, re.I) and not re.search(r"\babstract\b", k, re.I):
                mn, mx = _rentang_kata(k)
                if mn or mx:
                    ab.min_kata, ab.maks_kata = mn, mx
                    break
    if per_peran.get("abstrak_inggris") or per_peran.get("label_abstrak_inggris"):
        ab.abstrak_inggris = "wajib"
        ab.min_kata_inggris, ab.maks_kata_inggris = _rentang_kata(teks_en)
    semua_ab = teks_id + " " + teks_en + " " + " ".join(k for k in kalimat if re.search("abstra", k, re.I))
    if re.search(r"hanya ditulis dalam bahasa indonesia|hanya (?:dalam )?bahasa indonesia", semua_ab, re.I):
        ab.abstrak_inggris = "tidak_boleh"
    if re.search(r"(?:dalam|terdiri atas|terdiri dari)\s*satu paragraf|single paragraph|one paragraph", semua_ab, re.I):
        ab.satu_paragraf = True
    if re.search(r"tanpa indentasi|without indentation", semua_ab, re.I):
        for fe in (prof.format.abstrak, prof.format.abstrak_inggris):
            fe.indentasi_pertama_cm = 0.0


def _aturan_kata_kunci(prof: Profil, per_peran):
    kk = prof.kata_kunci
    teks = " ".join(p.teks for r in ("kata_kunci", "kata_kunci_inggris") for p in per_peran.get(r, [])).lower()
    if not teks:
        return
    m = re.search(r"(\d)\s*(?:s\.?\s*d\.?|sampai(?:\s+dengan)?|hingga|[-–—]|to)\s*(\d{1,2})\b", teks)
    if m:
        kk.min_jumlah, kk.maks_jumlah = int(m.group(1)), int(m.group(2))
    else:
        m = re.search(r"(?:maks(?:imal|imum)?\.?|max\.?|paling banyak)\s*(\d{1,2})", teks)
        if m:
            kk.maks_jumlah = int(m.group(1))
    if re.search(r"titik\s*koma|\(\s*;\s*\)|semicolon", teks):
        kk.pemisah = ";"
    elif re.search(r"\bkoma\b|comma|\(\s*,\s*\)", teks):
        kk.pemisah = ","
    if re.search(r"huruf kecil|lowercase|lower case", teks):
        kk.huruf_kecil = True


def _aturan_naskah(prof: Profil, kalimat: list[str]):
    n = prof.naskah
    par = prof.paragraf
    for k in kalimat:
        kl = k.lower()
        m = re.search(r"(\d{1,3})\s*(?:s\.?\s*d\.?|-|–|sampai|hingga)\s*(\d{1,3})\s*halaman", kl)
        if m:
            n.min_halaman, n.maks_halaman = int(m.group(1)), int(m.group(2))
        m = re.search(r"(?:tidak boleh melebihi|maksimal|maksimum|maks\.?|paling banyak|tidak lebih dari)\s*(\d{1,3})\s*halaman", kl)
        if m:
            n.maks_halaman = int(m.group(1))
        m = re.search(r"(?:minimal|minimum|sekurang-kurangnya|paling sedikit)\s*(\d{1,3})\s*halaman", kl)
        if m:
            n.min_halaman = int(m.group(1))
        if re.search(r"naskah|artikel|manuscript", kl) and not re.search("abstra", kl):
            m = re.search(r"(\d[\d.]{2,6})\s*(?:s\.?\s*d\.?|-|–|sampai|hingga)\s*(\d[\d.]{2,6})\s*kata", kl)
            if m:
                n.min_kata, n.maks_kata = int(m.group(1).replace(".", "")), int(m.group(2).replace(".", ""))
        if re.search(r"tidak boleh (?:hanya )?terdiri (?:atas|dari) (?:satu|1) kalimat", kl):
            par.min_kalimat = 2
        m = re.search(r"(?:minimal|sekurang-kurangnya|paling sedikit)\s*(\d)\s*kalimat", kl)
        if m:
            par.min_kalimat = int(m.group(1))
        m = re.search(r"(?:maksimal|maks\.?|paling banyak)\s*(\d{1,2})\s*kalimat", kl)
        if m:
            par.maks_kalimat = int(m.group(1))


def _aturan_referensi(prof: Profil, semua: str, kalimat: list[str], catat):
    ref = prof.referensi
    sl = semua.lower()
    for k in kalimat:
        kl = k.lower()
        m = re.search(r"(?:minimal|minimum|sekurang-kurangnya|paling sedikit)\s*(\d{1,3})\s*(?:buah\s*)?(?:referensi|rujukan|pustaka|sumber acuan|daftar)", kl) \
            or re.search(r"(?:jumlah\s*)?(?:referensi|rujukan|pustaka)\s*minimal\s*(?:adalah\s*|sebanyak\s*)?(\d{1,3})", kl)
        if m:
            ref.min_jumlah = int(m.group(1))
        m = re.search(r"(\d{1,2})\s*tahun terakhir", kl)
        if m and re.search(r"referensi|rujukan|pustaka|mutakhir|terbaru|terkini|sumber", kl):
            ref.rentang_tahun = int(m.group(1))
            p = re.search(r"(\d{1,3})\s*%[^%]{0,80}?(?:mutakhir|terbaru|terkini|\d+\s*tahun terakhir)", kl)
            if p:
                ref.persen_mutakhir = float(p.group(1))
    if re.search(r"\bieee\b|numerik|numerical|numbering system|\[\s*1\s*\]", sl):
        ref.gaya_sitasi = "numerik"
    elif re.search(r"\bapa\b|harvard|innote|in-note|body note|bodynote|\(nama[^)]*tahun|author[- ]year|nama belakang[^.]{0,30}tahun", sl):
        ref.gaya_sitasi = "penulis_tahun"
    if re.search(r"bukan berdasarkan abjad|urutan kemunculan|urutan pemunculan|order of appearance", sl):
        ref.urutan = "kemunculan"
    elif re.search(r"(?:diurutkan|urut(?:an)?|disusun)[^.]{0,40}(?:abjad|alfabet)", sl):
        ref.urutan = "abjad"
    if ref.urutan is None and ref.gaya_sitasi == "numerik":
        ref.urutan = "kemunculan"
        catat("Urutan daftar pustaka diasumsikan sesuai urutan kemunculan (lazim untuk sitasi numerik).")
    elif ref.urutan is None and ref.gaya_sitasi == "penulis_tahun":
        ref.urutan = "abjad"
        catat("Urutan daftar pustaka diasumsikan urut abjad (lazim untuk sitasi nama-tahun).")


def _aturan_tabel_gambar(prof: Profil, per_peran, kalimat: list[str]):
    tg = prof.tabel_gambar
    for peran, atr in (("judul_tabel", "posisi_judul_tabel"), ("judul_gambar", "posisi_judul_gambar")):
        pos = Counter(p.ext.get("posisi") for p in per_peran.get(peran, []) if p.ext.get("posisi") in ("atas", "bawah"))
        if pos:
            setattr(tg, atr, pos.most_common(1)[0][0])
    for k in kalimat:
        kl = k.lower()
        if re.search(r"(?:judul|nomor) tabel[^.]{0,60}(?:di\s*atas|diatas|bagian atas)", kl):
            tg.posisi_judul_tabel = "atas"
        if re.search(r"(?:judul|keterangan|nomor) gambar[^.]{0,70}(?:di\s*bawah|dibawah|bagian bawah)", kl):
            tg.posisi_judul_gambar = "bawah"


_RX_DILARANG = re.compile(
    r"tidak (?:boleh|diperkenankan|diizinkan|dianjurkan)|dilarang|\bbukan\b|hindari|jangan|"
    r"not (?:allowed|permitted|accepted)|\bavoid|prohibited"
)
SUMBER_TERLARANG = ("wikipedia", "blogspot", "wordpress", "blog", "brainly", "youtube", "media sosial")


def _aturan_lanjut(prof: Profil, dm: DocModel, per_peran, kalimat: list[str], catat):
    """Aturan objek, kebersihan, penulis, dan mutu referensi: dari contoh di template lalu kalimat petunjuk."""
    from .kebersihan import PERAN_ELEMEN, RX_URL, hitam
    from .objek import LABEL_POLA, garis_tabel, perataan_tabel, tabel_data

    tg, an, ref, pn = prof.tabel_gambar, prof.naskah, prof.referensi, prof.penulis
    terbaca: list[str] = []

    # ---- contoh objek di template ------------------------------------------------
    tabel = [t for t in dm.tabel if tabel_data(t)]
    if tabel:
        pola, n = Counter(garis_tabel(dm, t).pola for t in tabel).most_common(1)[0]
        # "tanpa garis" tidak disimpulkan dari contoh: tabel contoh yang dibuat generator sering polos
        if pola in ("horizontal", "grid") and n >= len(tabel) * 0.6:
            tg.garis_tabel = pola
            terbaca.append(f"pola garis tabel {LABEL_POLA[pola]} (dari contoh tabel)")
        if all(perataan_tabel(dm, t) == "tengah" for t in tabel):
            tg.perataan_tabel = "tengah"
            terbaca.append("tabel di tengah halaman (dari contoh tabel)")
    rata_gambar = Counter(p.pp_nilai("perataan", "kiri") for p in per_peran.get("gambar", []) if p.ada_gambar and not p.dalam_tabel)
    if rata_gambar and rata_gambar.most_common(1)[0][0] == "tengah":
        tg.perataan_gambar = "tengah"
        terbaca.append("gambar di tengah (dari contoh gambar)")
    total = hitam_n = 0
    for p in dm.paras:
        if p.peran in PERAN_ELEMEN:
            for r in p.runs:
                n = len(r.teks.strip())
                if n and not r.tautan and not RX_URL.search(r.teks):
                    total += n
                    hitam_n += n if hitam(r.warna[0]) else 0
    if total >= 200 and hitam_n / total >= 0.98:
        an.teks_hitam = True
    depan = " ".join(p.teks for r in ("info_penulis", "depan_lain") for p in per_peran.get(r, []))
    if re.search(r"@|e-?mail|surel", depan, re.I):
        pn.wajib_email = True
        terbaca.append("email penulis (dari bagian penulis)")
    if re.search(r"orcid", depan, re.I):
        pn.wajib_orcid = True
        terbaca.append("ORCID penulis (dari bagian penulis)")

    # ---- kalimat petunjuk -----------------------------------------------------
    for k in kalimat:
        kl = k.lower()
        tentang_tabel = re.search(r"tabel|table", kl)
        if tentang_tabel and re.search(
                r"(?:tanpa|tidak (?:menggunakan|memakai|ada|boleh ada)|hindari|jangan)\s+(?:menggunakan\s+)?garis\s+(?:tegak|vertikal)|"
                r"garis\s+(?:tegak|vertikal)[^.]{0,30}(?:tidak|dihapus|dihilangkan)|hanya\s+(?:menggunakan\s+|memakai\s+)?"
                r"garis\s+(?:mendatar|horizontal|horisontal)|garis\s+(?:mendatar|horizontal|horisontal)\s+saja|"
                r"no vertical (?:lines|borders)|horizontal (?:lines|borders) only|only horizontal", kl):
            tg.garis_tabel = "horizontal"
        elif tentang_tabel and re.search(r"(?:garis|border)[^.]{0,20}(?:penuh|lengkap|semua sisi)|all borders|table grid", kl):
            tg.garis_tabel = "grid"
        if re.search(r"(?:lebar|width)[^.]{0,20}(?:tabel|table)[^.]{0,40}(?:mengikuti|sesuai|selebar|sama dengan|menyesuaikan)"
                     r"[^.]{0,20}(?:halaman|kertas|margin|kolom)|auto\s*fit window|selebar halaman", kl):
            tg.tabel_selebar_halaman = True
        if re.search(r"in ?line with text|sebaris dengan teks", kl):
            tg.gambar_sebaris = True
        m = re.search(r"(\d{2,4})\s*dpi", kl)
        if m and re.search(r"gambar|figure|foto|image|resolusi|resolution", kl):
            tg.min_dpi_gambar = int(m.group(1))
        elif tg.min_dpi_gambar is None and re.search(
                r"(?:gambar|figure|foto|image)[^.]{0,60}(?:jelas|terbaca|tajam|tidak buram|resolusi (?:tinggi|baik)|"
                r"high[- ]resolution|clear|legible)", kl):
            tg.min_dpi_gambar = 96
            catat("Resolusi gambar minimal dianggap 96 dpi (resolusi layar) karena template meminta gambar jelas. "
                  "Gambar di bawahnya berarti diperbesar melewati ukuran aslinya. Ubah bila perlu.")
        if re.search(r"tabel|gambar|table|figure", kl) and re.search(
                r"(?:cantumkan|sertakan|tuliskan|diberi|disertai|dilengkapi|mencantumkan|wajib|harus)[^.]{0,40}"
                r"(?:keterangan\s+)?sumber(?:nya)?\b|(?:include|state|cite)[^.]{0,20}(?:the\s+)?source", kl):
            tg.wajib_sumber = True
        if re.search(r"equation editor|microsoft equation|mathtype|(?:persamaan|rumus)[^.]{0,60}equation", kl):
            tg.persamaan_editor = True
        if re.search(r"(?:tidak|tanpa|hindari|dilarang|jangan)[^.]{0,40}(?:catatan kaki|footnote)|"
                     r"(?:catatan kaki|footnote)[^.]{0,30}(?:tidak (?:boleh|diperkenankan|digunakan)|dilarang)|"
                     r"(?:do not|avoid)[^.]{0,20}footnotes?", kl):
            an.catatan_kaki_dilarang = True
        m = re.search(r"(?:naskah|artikel|manuscript|article|makalah)[^.]{0,60}(?:ditulis|written|disusun)[^.]{0,20}"
                      r"(?:dalam|in|menggunakan)\s+(?:bahasa\s+)?(indonesia|inggris|english|indonesian)\b", kl)
        if m and not re.search(r"(?:indonesia|inggris|english)\s+(?:atau|or|maupun|dan|and)\s+(?:bahasa\s+)?"
                               r"(?:indonesia|inggris|english)", kl):
            an.bahasa = "inggris" if m.group(1) in ("inggris", "english") else "indonesia"
        if re.search(r"judul[^.]{0,80}(?:tidak|tanpa|hindari|jangan)[^.]{0,30}(?:singkatan|akronim)|"
                     r"title[^.]{0,60}(?:avoid|without|no)\s+(?:abbreviations?|acronyms?)", kl):
            prof.judul.tanpa_singkatan = True
        if re.search(r"abstra[^.]{0,150}(?:tidak|tanpa|jangan)[^.]{0,40}(?:sitasi|kutipan|rujukan|referensi|citation|pustaka)|"
                     r"abstract[^.]{0,80}(?:without|no|avoid)[^.]{0,20}(?:citations?|references?)", kl):
            prof.abstrak.tanpa_sitasi = True
        if re.search(r"(?:e-?mail|surel)[^.]{0,40}(?:penulis|korespondensi|corresponding)", kl):
            pn.wajib_email = True
        if re.search(r"mendeley|zotero|endnote|manajemen referensi|reference manag", kl):
            wajib = re.search(r"wajib|harus|diwajibkan|must|required|mandatory", kl)
            saran = re.search(r"disarankan|dianjurkan|sebaiknya|recommended|encouraged|suggested", kl)
            ref.manajer_referensi = "disarankan" if saran and not wajib else "wajib"
        if re.search(r"\bdoi\b", kl) and re.search(
                r"wajib|harus|sertakan|cantumkan|mencantumkan|dilengkapi|disertai|include|must|should|required", kl):
            ref.wajib_doi = True
        m = re.search(r"(\d{1,3})\s*%[^.;%]{0,60}?(?:sumber primer|primer|jurnal|journal|prosiding|proceeding|artikel ilmiah)", kl)
        if m:
            ref.persen_sumber_primer = float(m.group(1))
        if _RX_DILARANG.search(kl) and re.search(r"referensi|rujukan|pustaka|sumber|kutip|cite|citation|reference", kl):
            for w in SUMBER_TERLARANG:
                if w in kl and w not in ref.sumber_terlarang:
                    ref.sumber_terlarang.append(w)

    for nama, nilai in (
        ("pola garis tabel", tg.garis_tabel), ("tabel selebar halaman", tg.tabel_selebar_halaman),
        ("gambar In Line with Text", tg.gambar_sebaris), ("resolusi gambar minimal", tg.min_dpi_gambar),
        ("keterangan sumber tabel/gambar", tg.wajib_sumber), ("persamaan dengan Equation Editor", tg.persamaan_editor),
        ("tanpa catatan kaki", an.catatan_kaki_dilarang), ("bahasa naskah", an.bahasa),
        ("judul tanpa singkatan", prof.judul.tanpa_singkatan), ("abstrak tanpa sitasi", prof.abstrak.tanpa_sitasi),
        ("aplikasi manajemen referensi", ref.manajer_referensi), ("DOI pada referensi", ref.wajib_doi),
        ("persentase sumber primer", ref.persen_sumber_primer), ("sumber terlarang", ", ".join(ref.sumber_terlarang)),
    ):
        if nilai and not any(t.startswith(nama) for t in terbaca):
            terbaca.append(nama if nilai is True else f"{nama}: {_tampil(nilai)}")
    if terbaca:
        catat("Aturan tambahan yang terbaca: " + "; ".join(terbaca) + ".")


def _struktur(prof: Profil, dm: DocModel, semua: str, catat):
    bagian: list[Bagian] = []
    paras = [p for p in dm.paras if not p.kosong and not p.dalam_tabel]
    for idx, p in enumerate(paras):
        if p.peran == "judul_bagian":
            judul = T._NOMOR.sub("", p.bersih).strip()
            kan = T.kanonik_bagian(T.normalisasi_judul(judul))
            alias = [a for a in T.alias_untuk(judul) if a != T.normalisasi_judul(judul)]
            bagian.append(Bagian(judul=judul, alias=alias, wajib=kan not in ("ucapan terima kasih", "lampiran")))
        elif p.peran == "sub_judul" and bagian:
            berikut = paras[idx + 1] if idx + 1 < len(paras) else None
            if (berikut is None or berikut.peran in ("sub_judul", "judul_bagian")) and "(" not in p.teks:
                bagian[-1].sub_bagian.append(T._NOMOR.sub("", p.bersih).strip())
    prof.struktur.bagian = bagian
    judul_semua = [p for p in dm.paras if p.peran in ("judul_bagian", "sub_judul") and not p.kosong]
    if judul_semua:
        bernomor = sum(1 for p in judul_semua if T.nomor_judul(p.bersih)[0] or p.pp_nilai("bernomor"))
        if bernomor / len(judul_semua) >= 0.6:
            prof.struktur.penomoran_judul = "wajib"
    if re.search(r"(?:subjudul|judul|heading)[^.]{0,40}(?:tidak perlu diberi nomor|tanpa nomor|tidak diberi nomor|tidak bernomor)", semua, re.I):
        prof.struktur.penomoran_judul = "dilarang"
    if bagian:
        catat("Struktur bagian: " + " → ".join(b.judul for b in bagian) + ".")


_RX_INSTRUKSI = re.compile(r"\b(berisi|memuat|harus|wajib|sebaiknya|mencakup|menjelaskan|diharapkan|perlu)\b", re.I)
_RX_FORMAT = re.compile(
    r"font|\bpt\b|spasi|margin|kertas|halaman|heading|tabel|gambar|times new roman|ukuran|sitasi|daftar rujukan|"
    r"daftar pustaka|referensi|kata kunci|\bkata\b.*\d|diketik|indentasi|poin|justify|kolom|mendeley|zotero",
    re.I,
)


def _naratif(prof: Profil, dm: DocModel):
    """Kandidat aturan naratif: kalimat instruksi isi (bukan format) per bagian."""
    aturan: dict[str, list[str]] = defaultdict(list)
    bagian_skrg = "Seluruh naskah"
    for p in dm.paras:
        if p.kosong:
            continue
        if p.peran == "judul_bagian":
            bagian_skrg = T._NOMOR.sub("", p.bersih).strip().title()
            continue
        if p.peran in ("abstrak", "abstrak_inggris"):
            target = "Abstrak"
        elif p.peran == "teks_isi":
            target = bagian_skrg
        else:
            continue
        if p.peran == "abstrak_inggris":
            continue
        teks = p.bersih
        if p.label_inline:
            teks = teks[len(p.label_inline):] if teks.startswith(p.label_inline) else teks
        for k in _kalimat(teks):
            k = k.strip()
            if 5 <= T.hitung_kata(k) <= 60 and _RX_INSTRUKSI.search(k) and not _RX_FORMAT.search(k):
                aturan[target].append(k)
    hasil = []
    for bagian, daftar in aturan.items():
        for k in daftar[:4]:
            hasil.append(AturanNaratif(bagian=bagian, aturan=k))
    prof.aturan_naratif = hasil[:15]
