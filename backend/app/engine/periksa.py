"""Memeriksa naskah terhadap Profil aturan -> daftar Temuan."""
from __future__ import annotations

import re
from collections import defaultdict
from difflib import SequenceMatcher

from . import teks as T
from .docmodel import DocModel, Para, q
from .klasifikasi import CAP_GAMBAR, CAP_TABEL, klasifikasi
from .profil import FormatElemen, Profil
from .referensi import cek_referensi, entri_pustaka, sitasi_numerik, sitasi_penulis_tahun
from .temuan import Temuan

PERAN_KE_ELEMEN = {
    "judul": "judul", "judul_inggris": "judul_inggris", "info_penulis": "info_penulis", "abstrak": "abstrak",
    "abstrak_inggris": "abstrak_inggris", "kata_kunci": "kata_kunci", "kata_kunci_inggris": "kata_kunci",
    "judul_bagian": "judul_bagian", "sub_judul": "sub_judul", "teks_isi": "teks_isi", "judul_tabel": "judul_tabel",
    "judul_gambar": "judul_gambar", "sumber": "sumber", "daftar_pustaka": "daftar_pustaka",
}
PERAN_INDENTASI = {"teks_isi", "abstrak", "abstrak_inggris", "daftar_pustaka"}
FONT_SIMBOL = {"symbol", "wingdings", "cambria math", "mt extra", "webdings", "segoe ui symbol", "math", ""}
LABEL_PERATAAN = {"kiri": "rata kiri", "tengah": "rata tengah", "kanan": "rata kanan", "rata_kanan_kiri": "rata kanan-kiri (justify)"}
KERTAS = [("A4", 21.0, 29.7), ("Letter", 21.59, 27.94), ("Legal", 21.59, 35.56), ("F4", 21.5, 33.0), ("A5", 14.8, 21.0), ("B5", 17.6, 25.0)]
RX_DAFTAR = re.compile(r"^\s*([•\-–·▪●○◦➢✓]|\d{1,2}[.)]|[a-zA-Z][.)]|\(\w{1,3}\))\s")


def _kertas(w: float, h: float) -> str:
    for n, a, b in KERTAS:
        if abs(w - a) < 0.3 and abs(h - b) < 0.3:
            return n
    return ""


def _tanpa_label(p: Para) -> str:
    t = p.bersih
    if p.label_inline and t.startswith(p.label_inline):
        t = t[len(p.label_inline):]
    return t.strip()


def _rentang(n: int, mn: int | None, mx: int | None, satuan: str) -> str | None:
    if mn and mx and not (mn <= n <= mx):
        return f"seharusnya {mn}–{mx} {satuan}"
    if mx and not mn and n > mx:
        return f"maksimal {mx} {satuan}"
    if mn and not mx and n < mn:
        return f"minimal {mn} {satuan}"
    return None


def _label_indentasi(v: float) -> str:
    if abs(v) < 0.05:
        return "tanpa indentasi"
    return f"gantung {T.angka(round(-v, 2))} cm" if v < 0 else f"{T.angka(round(v, 2))} cm"


# ---------------------------------------------------------------------------


def cek_tata_letak(dm: DocModel, prof: Profil) -> list[Temuan]:
    tl, out, K = prof.tata_letak, [], "Tata Letak"
    tol = tl.toleransi_cm or 0.1
    sudah: set = set()
    for idx, s in enumerate(dm.seksi):
        ket = f" (bagian dokumen ke-{idx + 1})" if len(dm.seksi) > 1 else ""
        if s.page_width and s.page_height:
            w, h = s.page_width.cm, s.page_height.cm
            lanskap = w > h
            if tl.orientasi and (tl.orientasi == "lanskap") != lanskap:
                out.append(Temuan(K, f"Orientasi halaman {'lanskap' if lanskap else 'potret'}{ket}, seharusnya {tl.orientasi}.", tingkat="saran"))
            ww, hh = (h, w) if lanskap else (w, h)
            if tl.lebar_kertas_cm and tl.tinggi_kertas_cm and (
                abs(ww - tl.lebar_kertas_cm) > max(tol, 0.2) or abs(hh - tl.tinggi_kertas_cm) > max(tol, 0.2)
            ):
                kunci = ("kertas", round(ww, 1), round(hh, 1))
                if kunci not in sudah:
                    sudah.add(kunci)
                    a, b = _kertas(ww, hh), _kertas(tl.lebar_kertas_cm, tl.tinggi_kertas_cm)
                    out.append(Temuan(
                        K, f"Ukuran kertas {a + ' ' if a else ''}({T.angka(round(ww, 2))} × {T.angka(round(hh, 2))} cm), "
                           f"seharusnya {b + ' ' if b else ''}({T.angka(tl.lebar_kertas_cm)} × {T.angka(tl.tinggi_kertas_cm)} cm)."))
        for attr, nama in (("top", "atas"), ("bottom", "bawah"), ("left", "kiri"), ("right", "kanan")):
            v, harap = getattr(s, f"{attr}_margin"), getattr(tl, f"margin_{nama}_cm")
            if v is not None and harap is not None and abs(v.cm - harap) > tol:
                kunci = ("margin", nama, round(v.cm, 2))
                if kunci not in sudah:
                    sudah.add(kunci)
                    out.append(Temuan(K, f"Margin {nama} {T.angka(round(v.cm, 2))} cm, seharusnya {T.angka(harap)} cm."))
    judul = next((p for p in dm.paras if p.peran == "judul"), None)
    isi = next((p for p in dm.paras if p.peran in ("judul_bagian", "teks_isi")), None)
    if tl.kolom_isi and isi and dm.seksi:
        k = dm.kolom_seksi(isi.seksi)
        if k != tl.kolom_isi:
            out.append(Temuan(K, f"Isi naskah ditulis {k} kolom, seharusnya {tl.kolom_isi} kolom.", para=isi.i))
    if tl.kolom_bagian_depan and judul and dm.seksi:
        k = dm.kolom_seksi(judul.seksi)
        if k != tl.kolom_bagian_depan:
            out.append(Temuan(K, f"Bagian judul–abstrak ditulis {k} kolom, seharusnya {tl.kolom_bagian_depan} kolom.", para=judul.i))
    return out


def _banding(p: Para, fe: FormatElemen, el: str, hanya_huruf: bool = False) -> list[tuple[str, object, str]]:
    hasil: list[tuple[str, object, str]] = []
    runs = [(r, len(r.teks.strip())) for r in p.runs if r.teks.strip()]
    total = sum(n for _, n in runs)
    if not total:
        return hasil
    if fe.font:
        salah: dict[str, int] = defaultdict(int)
        for r, n in runs:
            f = (r.font[0] or "").strip()
            if f.lower() != fe.font.lower() and f.lower() not in FONT_SIMBOL:
                salah[f] += n
        if salah and sum(salah.values()) >= max(3, 0.2 * total):
            f = max(salah, key=salah.get)
            hasil.append(("font", f, f"font {f}, seharusnya {fe.font}."))
    if fe.ukuran_pt:
        salah_u: dict[float, int] = defaultdict(int)
        for r, n in runs:
            if abs(r.ukuran[0] - fe.ukuran_pt) > 0.26:
                salah_u[r.ukuran[0]] += n
        if salah_u and sum(salah_u.values()) >= max(3, 0.3 * total):
            u = max(salah_u, key=salah_u.get)
            hasil.append(("ukuran", u, f"ukuran font {T.angka(u)} pt, seharusnya {T.angka(fe.ukuran_pt)} pt."))
    if hanya_huruf:
        return hasil
    rb, rm = p.rasio("tebal"), p.rasio("miring")
    if fe.tebal is True and rb is not None and rb < 0.6:
        hasil.append(("tebal", "tidak", "belum dicetak tebal (bold)."))
    elif fe.tebal is False and rb is not None and rb > 0.6:
        hasil.append(("tebal", "ya", "seharusnya tidak dicetak tebal."))
    if fe.miring is True and rm is not None and rm < 0.6:
        hasil.append(("miring", "tidak", "belum dicetak miring (italic)."))
    elif fe.miring is False and rm is not None and rm > 0.6:
        hasil.append(("miring", "ya", "seharusnya tidak dicetak miring."))
    inti = T.pisah_petunjuk(T._NOMOR.sub("", p.bersih))[0]  # sisa petunjuk template dilaporkan terpisah
    kapital = T.huruf_kapital_semua(inti) or (p.rasio("kapital") or 0) > 0.9
    if fe.kapital is True and not kapital:
        hasil.append(("kapital", "tidak", "harus ditulis dengan huruf kapital semua."))
    elif fe.kapital is False and el == "sub_judul" and kapital:
        hasil.append(("kapital", "ya", "tidak perlu kapital semua (gunakan huruf besar-kecil)."))
    if fe.perataan:
        a = p.pp_nilai("perataan", "kiri") or "kiri"
        pendek = p.kata < 12
        setara = {a, fe.perataan} == {"kiri", "rata_kanan_kiri"} and pendek
        lewati = el in PERAN_INDENTASI and (pendek or p.pp_nilai("bernomor"))
        if a != fe.perataan and not setara and not lewati:
            hasil.append(("perataan", a, f"perataan {LABEL_PERATAAN[a]}, seharusnya {LABEL_PERATAAN[fe.perataan]}."))
    if fe.spasi_baris:
        sp = p.pp_nilai("spasi", ("kali", 1.0)) or ("kali", 1.0)
        if sp[0] == "kali" and abs(sp[1] - fe.spasi_baris) > 0.06:
            hasil.append(("spasi", sp[1], f"spasi baris {T.angka(sp[1])}, seharusnya {T.angka(fe.spasi_baris)}."))
        elif sp[0] == "exact":
            uk = p.dominan("ukuran")[0] or 12
            kira = sp[1] / (uk * 1.15)
            if abs(kira - fe.spasi_baris) > 0.25:
                hasil.append(("spasi", f"tepat {sp[1]}", f"spasi baris “tepat {T.angka(sp[1])} pt” (±{T.angka(round(kira, 1))}), seharusnya {T.angka(fe.spasi_baris)}."))
    if fe.indentasi_pertama_cm is not None and el in PERAN_INDENTASI:
        daftar = p.pp_nilai("bernomor") or RX_DAFTAR.match(p.bersih) or (p.pp_nilai("indentasi_kiri", 0) or 0) > 0.6
        if not daftar:
            ind = p.pp_nilai("indentasi", 0.0) or 0.0
            if abs(ind - fe.indentasi_pertama_cm) > 0.15:
                hasil.append(("indentasi", round(ind, 2),
                              f"indentasi baris pertama {_label_indentasi(ind)}, seharusnya {_label_indentasi(fe.indentasi_pertama_cm)}."))
    for k in ("sebelum", "sesudah"):
        harap = getattr(fe, f"spasi_{k}_pt")
        if harap is not None:
            v = p.pp_nilai(k, 0.0) or 0.0
            if abs(v - harap) > 1.0:
                hasil.append((f"spasi_{k}", v, f"jarak {k} paragraf {T.angka(v)} pt, seharusnya {T.angka(harap)} pt."))
    return hasil


def cek_format(dm: DocModel, prof: Profil) -> list[Temuan]:
    out: list[Temuan] = []
    for p in dm.paras:
        el = PERAN_KE_ELEMEN.get(p.peran)
        if not el or p.kosong:
            continue
        fe = getattr(prof.format, el)
        nama = type(prof.format).model_fields[el].title
        pendek = el == "teks_isi" and p.kata < 4  # mis. "Maka:", "TP = 15" — cukup cek huruf
        for kode, aktual, pesan in _banding(p, fe, el, hanya_huruf=pendek):
            out.append(Temuan("Format", f"{nama}: {pesan}", para=p.i, kelompok=f"format.{el}.{kode}={aktual}"))
    fe = prof.format.isi_tabel
    for t in dm.tabel:
        paras = [p for p in t.paras if p.peran == "isi_tabel" and not p.kosong]
        if not paras or t.ada_gambar:
            continue
        gabung = Para(i=paras[0].i, el=None, teks="", bersih="x", petunjuk=[], style_id=None, style_nama="", pp={},
                      runs=[r for p in paras for r in p.runs])
        for kode, aktual, pesan in _banding(gabung, fe, "isi_tabel", hanya_huruf=True):
            out.append(Temuan("Format", f"Isi tabel: {pesan}", para=paras[0].i, kelompok=f"format.isi_tabel.{kode}={aktual}"))
    return out


def cek_struktur(dm: DocModel, prof: Profil) -> list[Temuan]:
    st, out, K = prof.struktur, [], "Struktur"
    heads = [p for p in dm.paras if p.peran == "judul_bagian" and not p.kosong]
    if not heads:
        out.append(Temuan(K, "Tidak ada judul bagian yang terdeteksi (mis. PENDAHULUAN, METODE). Tulis judul bagian "
                             "di baris tersendiri, cetak tebal atau pakai style Heading."))
    if st.bagian and heads:
        def skor(b, p) -> float:
            n, t = T.normalisasi_judul(p.bersih), T.normalisasi_judul(b.judul)
            if n == t:
                return 1.0
            if n in {T.normalisasi_judul(a) for a in b.alias}:
                return 0.9
            r = SequenceMatcher(None, n, t).ratio()
            return r if r >= 0.8 else 0.0

        pasangan = sorted(((skor(b, p), bi, hi) for bi, b in enumerate(st.bagian) for hi, p in enumerate(heads)), reverse=True)
        cocok_b: dict[int, tuple[int, float]] = {}
        cocok_h: dict[int, int] = {}
        for s, bi, hi in pasangan:
            if s <= 0:
                break
            if bi in cocok_b or hi in cocok_h:
                continue
            cocok_b[bi], cocok_h[hi] = (hi, s), bi
        for bi, b in enumerate(st.bagian):
            if bi not in cocok_b:
                if b.wajib:
                    nxt = next((cocok_b[j][0] for j in range(bi + 1, len(st.bagian)) if j in cocok_b), None)
                    para = heads[nxt].i if nxt is not None else heads[-1].i
                    posisi = " (seharusnya sebelum bagian ini)" if nxt is not None else ""
                    out.append(Temuan(K, f"Bagian “{b.judul}” tidak ditemukan{posisi}.", para=para))
                continue
            hi, s = cocok_b[bi]
            inti = T._NOMOR.sub("", heads[hi].bersih).strip()
            if s < 1.0 and st.nama_harus_sama:
                out.append(Temuan(K, f"Judul bagian “{inti}” sebaiknya ditulis “{b.judul}” sesuai template.", tingkat="saran", para=heads[hi].i))
            if b.sub_bagian:
                awal = heads[hi].i
                akhir = heads[hi + 1].i if hi + 1 < len(heads) else len(dm.paras)
                subs = [T.normalisasi_judul(p.bersih) for p in dm.paras[awal + 1: akhir]
                        if p.peran == "sub_judul" or (not p.kosong and p.kata <= 6 and (p.rasio("tebal") or 0) > 0.9)]
                for sb in b.sub_bagian:
                    ns = T.normalisasi_judul(sb)
                    if not any(ns == x or ns in x or SequenceMatcher(None, ns, x).ratio() > 0.8 for x in subs):
                        out.append(Temuan(K, f"Subbagian “{sb}” pada bagian “{b.judul}” tidak ditemukan.", para=heads[hi].i))
        if st.cek_urutan:
            maks = -1
            for hi in range(len(heads)):
                if hi not in cocok_h:
                    continue
                bi = cocok_h[hi]
                if bi < maks:
                    inti = T._NOMOR.sub("", heads[hi].bersih).strip()
                    out.append(Temuan(K, f"Urutan bagian tidak sesuai template: “{inti}” seharusnya muncul sebelum “{st.bagian[maks].judul}”.", para=heads[hi].i))
                maks = max(maks, bi)
    if st.penomoran_judul:
        for p in dm.paras:
            if p.peran not in ("judul_bagian", "sub_judul") or p.kosong:
                continue
            bernomor = bool(T.nomor_judul(p.bersih)[0]) or bool(p.pp_nilai("bernomor"))
            if st.penomoran_judul == "wajib" and not bernomor:
                out.append(Temuan(K, "Judul bagian/subjudul belum diberi nomor (mis. 1., 2.1).", para=p.i, kelompok="struktur.nomor"))
            elif st.penomoran_judul == "dilarang" and bernomor:
                out.append(Temuan(K, "Judul bagian/subjudul tidak perlu diberi nomor.", para=p.i, kelompok="struktur.nomor"))
    return out


def cek_judul(dm: DocModel, prof: Profil) -> list[Temuan]:
    aj, out, K = prof.judul, [], "Judul"
    jp = [p for p in dm.paras if p.peran == "judul" and not p.kosong]
    if not jp:
        return [Temuan(K, "Judul artikel tidak terdeteksi.")]
    n = sum(p.kata for p in jp)
    salah = _rentang(n, aj.min_kata, aj.maks_kata, "kata")
    if salah:
        out.append(Temuan(K, f"Judul terdiri atas {n} kata; {salah}.", para=jp[0].i))
    je = [p for p in dm.paras if p.peran == "judul_inggris" and not p.kosong]
    if aj.judul_inggris == "wajib" and not je:
        out.append(Temuan(K, "Judul bahasa Inggris belum ada.", para=jp[-1].i))
    elif aj.judul_inggris == "tidak_boleh" and je:
        out.append(Temuan(K, "Template tidak meminta judul bahasa Inggris.", tingkat="saran", para=je[0].i))
    if je and aj.maks_kata_inggris:
        ne = sum(p.kata for p in je)
        if ne > aj.maks_kata_inggris:
            out.append(Temuan(K, f"Judul bahasa Inggris {ne} kata; maksimal {aj.maks_kata_inggris} kata.", para=je[0].i))
    return out


def cek_abstrak(dm: DocModel, prof: Profil) -> list[Temuan]:
    ab, out, K = prof.abstrak, [], "Abstrak"
    judul = next((p.i for p in dm.paras if p.peran == "judul"), None)
    for peran, nama, mn, mx, aturan in (
        ("abstrak", "Abstrak", ab.min_kata, ab.maks_kata, "wajib" if ab.wajib else "opsional"),
        ("abstrak_inggris", "Abstract (bahasa Inggris)", ab.min_kata_inggris, ab.maks_kata_inggris, ab.abstrak_inggris),
    ):
        ps = [p for p in dm.paras if p.peran == peran and not p.kosong]
        if not ps:
            if aturan == "wajib":
                jangkar = next((p.i for p in dm.paras if p.peran in ("abstrak", "kata_kunci", "label_abstrak")), judul)
                out.append(Temuan(K, f"{nama} tidak ditemukan.", para=jangkar))
            continue
        if aturan == "tidak_boleh":
            out.append(Temuan(K, f"{nama} tidak diminta oleh template (abstrak hanya dalam bahasa Indonesia).", para=ps[0].i))
            continue
        n = sum(T.hitung_kata(_tanpa_label(p)) for p in ps)
        salah = _rentang(n, mn, mx, "kata")
        if salah:
            out.append(Temuan(K, f"{nama} terdiri atas {n} kata; {salah}.", para=ps[0].i))
        if ab.satu_paragraf and len(ps) > 1:
            out.append(Temuan(K, f"{nama} terdiri atas {len(ps)} paragraf; seharusnya satu paragraf.", para=ps[1].i))
    return out


def cek_kata_kunci(dm: DocModel, prof: Profil) -> list[Temuan]:
    kk, out, K = prof.kata_kunci, [], "Kata Kunci"
    for peran, nama, perlu in (
        ("kata_kunci", "Kata kunci", kk.wajib),
        ("kata_kunci_inggris", "Keywords", prof.abstrak.abstrak_inggris == "wajib"),
    ):
        ps = [p for p in dm.paras if p.peran == peran and not p.kosong]
        if not ps:
            if perlu:
                jangkar = next((p.i for p in reversed(dm.paras) if p.peran in (("abstrak",) if peran == "kata_kunci" else ("abstrak_inggris",))), None)
                out.append(Temuan(K, f"{nama} tidak ditemukan.", para=jangkar))
            continue
        p = ps[0]
        t = _tanpa_label(p).strip().rstrip(".").strip()
        pem = ";" if ";" in t else ("," if "," in t else None)
        item = [x.strip().strip(".") for x in (t.split(pem) if pem else [t]) if x.strip().strip(".")]
        if kk.pemisah and pem and pem != kk.pemisah and len(item) > 1:
            out.append(Temuan(K, f"{nama} dipisahkan tanda “{pem}”, seharusnya “{kk.pemisah}”.", para=p.i))
        salah = _rentang(len(item), kk.min_jumlah, kk.maks_jumlah, "kata kunci")
        if salah:
            out.append(Temuan(K, f"Jumlah {nama.lower()} {len(item)}; {salah}.", para=p.i))
        if kk.huruf_kecil:
            besar = [x for x in item if x[:1].isupper() and not x.isupper()]
            if besar:
                out.append(Temuan(K, f"{nama} sebaiknya huruf kecil (kecuali singkatan): {', '.join(besar[:4])}.", tingkat="saran", para=p.i))
    return out


def cek_paragraf(dm: DocModel, prof: Profil) -> list[Temuan]:
    ap, out = prof.paragraf, []
    if not (ap.min_kalimat or ap.maks_kalimat):
        return out
    for p in dm.paras:
        if p.peran != "teks_isi" or p.kosong or p.kata < 6:
            continue
        if p.pp_nilai("bernomor") or RX_DAFTAR.match(p.bersih) or p.bersih.rstrip().endswith(":"):
            continue
        if (p.pp_nilai("indentasi_kiri", 0) or 0) > 0.6:
            continue
        n = len(T.pecah_kalimat(p.bersih))
        if ap.min_kalimat and n < ap.min_kalimat:
            out.append(Temuan("Paragraf", f"Paragraf hanya {n} kalimat; minimal {ap.min_kalimat} kalimat (kalimat utama + penjelas).",
                              tingkat="saran", para=p.i, kelompok="paragraf.min"))
        elif ap.maks_kalimat and n > ap.maks_kalimat:
            out.append(Temuan("Paragraf", f"Paragraf terdiri atas {n} kalimat; maksimal {ap.maks_kalimat} kalimat.",
                              tingkat="saran", para=p.i, kelompok="paragraf.maks"))
    return out


def _tetangga(dm: DocModel, blok: int, cocok, jarak: int = 3) -> bool:
    for arah in (1, -1):
        i, n = blok + arah, 0
        while 0 <= i < len(dm.blok) and n < jarak:
            b = dm.blok[i]
            if isinstance(b, Para):
                if cocok(b):
                    return True
                if not b.kosong:
                    n += 1
            else:
                if any(cocok(p) for p in b.paras):
                    return True
                n += 1
            i += arah
    return False


def _tabel_tata_letak(t) -> bool:
    """Tabel yang dipakai untuk menata rumus/kotak, bukan tabel data."""
    baris = t.el.findall(q("tr"))
    kolom = max((len(r.findall(q("tc"))) for r in baris), default=0)
    if len(baris) < 2 or kolom < 2:
        return True
    sel = [p for p in t.paras if not p.kosong]
    rumus = sum(1 for p in sel if "=" in p.bersih or p.ada_persamaan)
    return bool(sel) and rumus / len(sel) >= 0.5


def cek_tabel_gambar(dm: DocModel, prof: Profil) -> list[Temuan]:
    tg, out, K = prof.tabel_gambar, [], "Tabel & Gambar"
    rujukan = " ".join(p.bersih for p in dm.paras if p.peran in ("teks_isi", "sub_judul", "judul_bagian", "sumber"))
    for jenis, peran, label, rx, pos_harap, alias in (
        ("tabel", "judul_tabel", "Tabel", CAP_TABEL, tg.posisi_judul_tabel, r"tabel|table|tab\."),
        ("gambar", "judul_gambar", "Gambar", CAP_GAMBAR, tg.posisi_judul_gambar, r"gambar|figure|fig\.|grafik"),
    ):
        caps = [p for p in dm.paras if p.peran == peran and not p.kosong]
        harap = 1
        for p in caps:
            m = rx.match(p.bersih)
            n = int(m.group(2)) if m else None
            if n is None:
                continue
            if tg.penomoran_berurutan and n != harap:
                out.append(Temuan(K, f"Penomoran {label.lower()} tidak berurutan: “{label} {n}”, seharusnya “{label} {harap}”.",
                                  para=p.i, kelompok=f"tg.nomor.{jenis}"))
            harap = n + 1
            pos = p.ext.get("posisi")
            if pos_harap and pos in ("atas", "bawah") and pos != pos_harap:
                out.append(Temuan(K, f"Judul {label.lower()} diletakkan di {pos} {label.lower()}; seharusnya di {pos_harap}.",
                                  para=p.i, kelompok=f"tg.posisi.{jenis}"))
            if tg.wajib_dirujuk and not re.search(rf"\b(?:{alias})\s*{n}\b", rujukan, re.I):
                out.append(Temuan(K, f"{label} {n} belum dirujuk di dalam teks (mis. “... seperti pada {label} {n}”).",
                                  para=p.i, kelompok=f"tg.rujuk.{jenis}"))
    if tg.wajib_judul:
        for t in dm.tabel:
            if any(p.peran == "depan_lain" for p in t.paras) or _tabel_tata_letak(t):
                continue
            if t.ada_gambar:
                punya = any(p.peran == "judul_gambar" for p in t.paras) or _tetangga(dm, t.blok, lambda p: p.peran == "judul_gambar")
                label = "Gambar"
            else:
                punya = any(p.peran == "judul_tabel" for p in t.paras) or _tetangga(dm, t.blok, lambda p: p.peran == "judul_tabel")
                label = "Tabel"
            if not punya:
                jangkar = next((p.i for p in t.paras if p.runs), None)
                out.append(Temuan(K, f"{label} ini tampaknya belum memiliki judul (mis. “{label} 1. ...”).", tingkat="saran",
                                  para=jangkar, kelompok=f"tg.tanpa_judul.{label}"))
        for p in dm.paras:
            if p.peran == "gambar" and not p.dalam_tabel and p.ada_gambar:
                if not _tetangga(dm, p.blok, lambda q: q.peran == "judul_gambar"):
                    out.append(Temuan(K, "Gambar ini belum memiliki judul (mis. “Gambar 1. ...”).", para=p.i, kelompok="tg.tanpa_judul.Gambar"))
    return out


def jumlah_kata_naskah(dm: DocModel) -> int:
    lewat = {"daftar_pustaka", "isi_tabel", "isi_tabel_gambar", "kosong", "petunjuk"}
    return sum(p.kata for p in dm.paras if p.peran not in lewat)


def cek_naskah(dm: DocModel, prof: Profil) -> list[Temuan]:
    an, out, K = prof.naskah, [], "Naskah"
    n = jumlah_kata_naskah(dm)
    salah = _rentang(n, an.min_kata, an.maks_kata, "kata")
    if salah:
        out.append(Temuan(K, f"Panjang naskah ±{n} kata (tanpa daftar pustaka & isi tabel); {salah}."))
    if dm.halaman and (an.min_halaman or an.maks_halaman):
        salah = _rentang(dm.halaman, an.min_halaman, an.maks_halaman, "halaman")
        if salah:
            out.append(Temuan(K, f"Naskah {dm.halaman} halaman (menurut metadata Word); {salah}."))
    if an.kata_terlarang:
        pola = re.compile(r"\b(" + "|".join(re.escape(k) for k in an.kata_terlarang if k.strip()) + r")\b", re.I)
        for p in dm.paras:
            if p.peran in ("teks_isi", "abstrak", "abstrak_inggris") and not p.kosong:
                ketemu = sorted({m.group(1).lower() for m in pola.finditer(p.bersih)})
                if ketemu:
                    out.append(Temuan(K, f"Menggunakan kata yang tidak dianjurkan: {', '.join(ketemu)}.", para=p.i, kelompok="naskah.kata_terlarang"))
    if an.cek_sisa_petunjuk:
        for p in dm.paras:
            if p.kosong:
                continue
            seg = T.sisa_petunjuk(p.teks)
            if seg:
                out.append(Temuan(K, f"Tampaknya masih ada petunjuk template yang belum dihapus: {seg[0][:80]}", tingkat="saran",
                                  para=p.i, kelompok="naskah.petunjuk"))
    return out


# ---------------------------------------------------------------------------


def dikenal_dari(prof: Profil) -> set[str]:
    hasil: set[str] = set()
    for b in prof.struktur.bagian:
        hasil.add(T.normalisasi_judul(b.judul))
        hasil.update(T.normalisasi_judul(a) for a in b.alias)
    return hasil


def periksa(dm: DocModel, prof: Profil) -> tuple[list[Temuan], dict]:
    klasifikasi(dm, dikenal_dari(prof))
    temuan: list[Temuan] = []
    for fungsi in (cek_tata_letak, cek_struktur, cek_judul, cek_abstrak, cek_kata_kunci, cek_format,
                   cek_paragraf, cek_tabel_gambar, cek_referensi, cek_naskah):
        temuan.extend(fungsi(dm, prof))
    return temuan, statistik(dm, prof)


def statistik(dm: DocModel, prof: Profil) -> dict:
    num, ay = sitasi_numerik(dm), sitasi_penulis_tahun(dm)
    gaya = prof.referensi.gaya_sitasi
    if gaya == "otomatis":
        gaya = "numerik" if len(num) > len(ay) else "penulis_tahun"
    entri = entri_pustaka(dm, gaya == "numerik")
    ab = [p for p in dm.paras if p.peran == "abstrak"]
    return {
        "kata_naskah": jumlah_kata_naskah(dm),
        "halaman": dm.halaman,
        "kata_abstrak": sum(T.hitung_kata(_tanpa_label(p)) for p in ab) if ab else None,
        "judul_bagian": [T._NOMOR.sub("", p.bersih).strip() for p in dm.paras if p.peran == "judul_bagian"],
        "jumlah_referensi": len(entri),
        "jumlah_tabel": sum(1 for t in dm.tabel if not t.ada_gambar and not any(p.peran == "depan_lain" for p in t.paras)),
        "jumlah_gambar": sum(1 for p in dm.paras if p.peran == "gambar" and p.ada_gambar),
        "gaya_sitasi_terdeteksi": ("numerik" if len(num) > len(ay) else "penulis_tahun") if (num or ay) else None,
    }
