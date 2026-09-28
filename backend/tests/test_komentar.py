"""Katalog kalimat komentar: konsistensi, kalimat kustom per jurnal, dan API menu Komentar."""
from __future__ import annotations

import ast
import re
from pathlib import Path

import docx

from app.engine import katalog as K
from app.engine.ekstrak import ekstrak_template
from app.engine.layanan import cek_naskah

RX_VAR = re.compile(r"\$(?:\{([_a-zA-Z]\w*)\}|([_a-zA-Z]\w*))", re.ASCII)
SUMBER = ["app/engine/periksa.py", "app/engine/referensi.py", "app/engine/objek.py", "app/engine/kebersihan.py",
          "app/ai/naratif.py", "app/engine/anotasi.py"]
AKAR = Path(__file__).resolve().parents[1]


def test_katalog_konsisten():
    assert len(K.INDEKS) == len(K.KATALOG)
    for e in K.KATALOG:
        dipakai = {a or b for a, b in RX_VAR.findall(e.bawaan)}
        assert dipakai <= {v.nama for v in e.variabel}, e.kode
        assert K.validasi(e.kode, e.bawaan) is None, e.kode
        assert "—" not in e.bawaan and e.grup in K.GRUP and e.tingkat in ("wajib", "saran")
        # nama variabel tidak boleh bentrok dengan parameter katalog.temuan()
        assert not {v.nama for v in e.variabel} & {"para", "kelompok", "sumber", "tingkat", "prof", "kode"}, e.kode


def test_setiap_pemanggilan_mengisi_variabel_entri():
    """Cek statis: pemanggilan katalog di kode mengisi tepat variabel yang dideklarasikan entrinya."""
    batas = {"jumlah", "ketentuan", "minimal", "maksimal"}
    kode_dipakai, dicek = set(), 0
    for f in SUMBER:
        teks = (AKAR / f).read_text(encoding="utf-8")
        kode_dipakai |= {k for k in K.INDEKS if f'"{k}"' in teks}
        for n in ast.walk(ast.parse(teks)):
            if not isinstance(n, ast.Call):
                continue
            nama = n.func.attr if isinstance(n.func, ast.Attribute) else getattr(n.func, "id", "")
            pos = {"tm": 0, "temuan": 2, "teks": 1}.get(nama)
            if pos is None or len(n.args) <= pos or not isinstance(n.args[pos], ast.Constant):
                continue
            kode = n.args[pos].value
            assert kode in K.INDEKS, f"{f}:{n.lineno} {kode}"
            sebar = {getattr(k.value, "id", "") for k in n.keywords if k.arg is None}
            if "data" in sebar:
                continue  # format: variabel berasal dari _banding
            isi = {k.arg for k in n.keywords if k.arg} | (batas if "batas" in sebar else set())
            isi -= {"para", "kelompok", "sumber", "tingkat"}
            assert isi == {v.nama for v in K.INDEKS[kode].variabel}, f"{f}:{n.lineno} {kode}"
            dicek += 1
    assert dicek > 40
    # entri format.jarak_* dipanggil lewat f-string; semua entri lain harus benar-benar dipakai kode
    assert set(K.INDEKS) - kode_dipakai <= {"format.jarak_sebelum", "format.jarak_sesudah"}


def test_validasi_kalimat_kustom():
    assert K.validasi("judul.jumlah_kata", "Judul $jumlah kata, ketentuan $ketentuan.") is None
    galat = K.validasi("judul.jumlah_kata", "Jumlah kata pada judul = $nword, template = $nwordtemplate")
    assert "$nword" in galat and "$nwordtemplate" in galat and "$jumlah" in galat
    assert K.validasi("judul.jumlah_kata", "   ") == "Kalimat tidak boleh kosong."
    assert K.validasi("tidak.ada", "x") is not None
    assert K.validasi("judul.tidak_ada", "Biaya $$5 tidak berlaku.") is None  # $$ = tanda $ biasa
    sah, galat = K.bersihkan({"judul.tidak_ada": K.INDEKS["judul.tidak_ada"].bawaan, "judul.inggris_wajib": "",
                              "ringkasan.judul": "Catatan redaksi $jurnal", "ringkasan.nihil": "$x"})
    assert sah == {"ringkasan.judul": "Catatan redaksi $jurnal"} and len(galat) == 1
    assert K.ketentuan(150, 250, "kata") == "150 sampai 250 kata"
    assert K.ketentuan(None, 15, "kata") == "maksimal 15 kata" and K.ketentuan(3, None, "kata kunci") == "minimal 3 kata kunci"


def test_kalimat_kustom_dipakai_di_temuan_dan_word(template_docx, naskah_docx, tmp_path):
    prof, _ = ekstrak_template(str(template_docx))
    prof.teks_komentar = {
        "judul.jumlah_kata": "Jumlah kata pada judul = $jumlah, tidak sesuai ketentuan template ($ketentuan).",
        "ringkasan.judul": "Catatan redaksi $jurnal",
        "format.font": "Font $elemen: $aktual. Wajib $harapan.",
    }
    keluar = tmp_path / "kustom.docx"
    hasil = cek_naskah(str(naskah_docx), prof, "Jurnal Uji", keluar)
    pesan = " | ".join(t["pesan"] for t in hasil["temuan"])
    assert "Jumlah kata pada judul = 18, tidak sesuai ketentuan template (maksimal 15 kata)." in pesan
    assert "Font Teks isi" in pesan and ": Calibri. Wajib Times New Roman." in pesan
    assert "$" not in pesan
    assert all(t["kode"] in K.INDEKS for t in hasil["temuan"])
    semua = " | ".join(k.text for k in docx.Document(str(keluar)).comments)
    assert "Catatan redaksi Jurnal Uji" in semua and "Jumlah kata pada judul = 18" in semua
    assert "Hasil cek otomatis" not in semua


def _admin(klien):
    data = {"nama": "Yahya Zahid", "email": "yahya@gmail.com", "sandi": "rahasia123"}
    r = klien.post("/api/auth/daftar", json=data)
    if r.status_code == 409:
        r = klien.post("/api/auth/masuk", json={"email": data["email"], "sandi": data["sandi"]})
    assert r.json()["peran"] == "admin"


def test_api_menu_komentar(template_docx):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as admin, TestClient(app) as penulis:
        _admin(admin)
        with open(template_docx, "rb") as f:
            e = admin.post("/api/jurnal/ekstrak", files={"template": ("t.docx", f)}).json()
        j = admin.post("/api/jurnal", json={"nama": "Uji Komentar", "profil": e["profil"]}).json()

        kat = admin.get("/api/komentar/katalog").json()
        assert len(kat["entri"]) == len(K.KATALOG) and kat["grup"] == K.GRUP
        assert admin.get(f"/api/jurnal/{j['id']}/komentar").json()["teks"] == {}

        teks = {"judul.jumlah_kata": "Jumlah kata pada judul = $jumlah (ketentuan: $ketentuan).",
                "judul.tidak_ada": K.INDEKS["judul.tidak_ada"].bawaan}
        r = admin.put(f"/api/jurnal/{j['id']}/komentar", json={"teks": teks})
        assert r.status_code == 200 and r.json()["teks"] == {"judul.jumlah_kata": teks["judul.jumlah_kata"]}

        r = admin.put(f"/api/jurnal/{j['id']}/komentar", json={"teks": {"judul.jumlah_kata": "Judul $nword kata"}})
        assert r.status_code == 422 and "$nword" in r.json()["detail"]
        assert admin.get(f"/api/jurnal/{j['id']}/komentar").json()["teks"] == {"judul.jumlah_kata": teks["judul.jumlah_kata"]}

        # form profil tidak menimpa kalimat komentar; skema form tidak memuat field ini
        admin.put(f"/api/jurnal/{j['id']}", json={"nama": "Uji Komentar", "profil": e["profil"]})
        assert admin.get(f"/api/jurnal/{j['id']}/komentar").json()["teks"] == {"judul.jumlah_kata": teks["judul.jumlah_kata"]}
        assert "teks_komentar" not in admin.get("/api/skema").json()["properties"]

        # pengguna biasa tidak boleh membuka atau mengubah katalog
        penulis.post("/api/auth/daftar", json={"nama": "Sari", "email": "sari@gmail.com", "sandi": "rahasia123"})
        assert penulis.get("/api/komentar/katalog").status_code == 403
        assert penulis.put(f"/api/jurnal/{j['id']}/komentar", json={"teks": {}}).status_code == 403
