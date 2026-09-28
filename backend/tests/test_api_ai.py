from __future__ import annotations

import json
import re

from app.ai.ekstrak_ai import perbaiki_dengan_ai
from app.ai.klien import KlienAI, ambil_json
from app.ai.naratif import cek_naratif
from app.engine.ekstrak import ekstrak_template
from app.engine.layanan import cek_naskah


class KlienTiruan(KlienAI):
    """Meniru endpoint OpenAI-compatible tanpa jaringan."""

    def chat(self, pesan, suhu=0.1, maks_token=4000):
        u = pesan[-1]["content"]
        if "PROFIL HASIL BACAAN" in u:
            return "```json\n" + json.dumps({
                "profil": {"judul": {"maks_kata": 20}, "referensi": {"gaya_sitasi": "tidak-valid"},
                           "tabel_gambar": {"posisi_judul_tabel": None}},
                "aturan_naratif": [{"bagian": "Pendahuluan", "aturan": "Pendahuluan memuat research gap."}],
                "catatan": ["contoh catatan"],
            }) + "\n```"
        p = re.findall(r"\[P(\d+)\]", u)
        return json.dumps({"hasil": [{"no": 1, "sesuai": False, "penjelasan": "Belum ada research gap.", "paragraf": f"P{p[0]}"}]})


def test_ambil_json_toleran():
    assert ambil_json('Berikut:\n```json\n{"a": [1, 2,],}\n```') == {"a": [1, 2]}


def test_ai_ekstrak_dan_naratif(template_docx, naskah_docx, tmp_path):
    k = KlienTiruan(base_url="http://tiruan", api_key="", model="tiruan")
    prof, peta = ekstrak_template(str(template_docx))
    prof2, ubah = perbaiki_dengan_ai(k, prof, peta)
    assert prof2.judul.maks_kata == 20
    assert prof2.referensi.gaya_sitasi == prof.referensi.gaya_sitasi  # usulan tidak valid ditolak
    assert prof.tabel_gambar.posisi_judul_tabel and prof2.tabel_gambar.posisi_judul_tabel == prof.tabel_gambar.posisi_judul_tabel  # null AI tidak menghapus
    assert [b.judul for b in prof2.struktur.bagian] == [b.judul for b in prof.struktur.bagian]
    assert any("Maksimal kata judul" in u for u in ubah)
    hasil = cek_naskah(str(naskah_docx), prof2, "Uji", tmp_path / "h.docx", lambda dm, p: cek_naratif(k, dm, p))
    ai = [t for t in hasil["temuan"] if t["sumber"] == "ai"]
    assert ai and ai[0]["para"] is not None and "research gap" in ai[0]["pesan"]


def test_alur_api_dengan_akun(template_docx, naskah_docx, tmp_path):
    import docx
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as admin, TestClient(app) as penulis:
        # belum login -> ditolak
        assert admin.get("/api/jurnal").status_code == 401
        assert admin.get("/api/auth/konfigurasi").json()["google"] is False
        # Google belum dikonfigurasi -> kembali ke halaman masuk dengan pesan
        r = admin.get("/api/auth/google", follow_redirects=False)
        assert r.status_code in (302, 307) and r.headers["location"].startswith("/masuk?galat=")

        # akun pertama otomatis admin
        a = admin.post("/api/auth/daftar", json={"nama": "Yahya Zahid", "email": "Yahya@Gmail.com", "sandi": "rahasia123"}).json()
        assert a["peran"] == "admin" and a["email"] == "yahya@gmail.com"
        assert admin.post("/api/auth/daftar", json={"nama": "x", "email": "yahya@gmail.com", "sandi": "rahasia123"}).status_code == 409

        with open(template_docx, "rb") as f:
            e = admin.post("/api/jurnal/ekstrak", files={"template": ("t.docx", f)}).json()
        j = admin.post("/api/jurnal", json={"nama": "Uji", "profil": e["profil"], "token_template": e["token"]}).json()
        assert j["punya_template"] is True

        # akun kedua = pengguna biasa: boleh cek, tidak boleh ubah jurnal/pengaturan
        p = penulis.post("/api/auth/daftar", json={"nama": "Budi Santoso", "email": "budi@gmail.com", "sandi": "rahasia123"}).json()
        assert p["peran"] == "pengguna"
        assert penulis.put(f"/api/jurnal/{j['id']}", json={"nama": "x", "profil": e["profil"]}).status_code == 403
        assert penulis.get("/api/pengaturan").status_code == 403
        penulis.put("/api/auth/saya", json={"format_nama_komentar": "nama_email"})
        with open(naskah_docx, "rb") as f:
            r = penulis.post("/api/cek", files={"naskah": ("n.docx", f)}, data={"jurnal_id": j["id"]}).json()
        assert r["status"] == "selesai" and r["ringkasan"]["wajib"] > 0
        assert r["penulis_komentar"] == "Budi Santoso (budi@gmail.com)"
        assert "belum berisi Focus & Scope" in r["scope"]["alasan_tidak_dinilai"]

        # komentar Word ditulis atas nama akun yang login
        berkas = tmp_path / "hasil.docx"
        berkas.write_bytes(penulis.get(f"/api/cek/{r['id']}/unduh").content)
        komentar = list(docx.Document(str(berkas)).comments)
        assert {k.author for k in komentar} == {"Budi Santoso (budi@gmail.com)"}
        assert any("Diperiksa oleh Budi Santoso <budi@gmail.com>" in k.text for k in komentar)

        # riwayat terpisah per akun; admin bisa melihat semua
        assert [x["id"] for x in penulis.get("/api/cek").json()] == [r["id"]]
        assert admin.get("/api/cek").json() == []
        assert r["id"] in [x["id"] for x in admin.get("/api/cek?semua=true").json()]
        assert admin.get(f"/api/cek/{r['id']}").status_code == 200

        assert penulis.post("/api/cek", files={"naskah": ("lama.doc", b"x")}, data={"jurnal_id": j["id"]}).status_code == 400
        assert admin.put("/api/pengaturan", json={"ai_api_key": "sk-rahasia-123456"}).json()["ai_api_key_samar"] == "sk-…3456"
        assert "rahasia-123456" not in admin.get("/api/pengaturan").text

        # admin terakhir tidak bisa diturunkan; keluar menghapus sesi
        assert admin.put(f"/api/pengguna/{a['id']}", json={"peran": "pengguna"}).status_code == 400
        penulis.post("/api/auth/keluar")
        assert penulis.get("/api/cek").status_code == 401
        assert penulis.post("/api/auth/masuk", json={"email": "budi@gmail.com", "sandi": "salah"}).status_code == 401
        assert penulis.post("/api/auth/masuk", json={"email": "budi@gmail.com", "sandi": "rahasia123"}).status_code == 200


def test_klien_membaca_streaming_sse_dan_json(monkeypatch):
    """9router membalas SSE bila `stream` tidak dimatikan; klien harus tetap bisa membacanya."""
    import httpx
    import pytest

    from app.ai import klien as K
    from app.ai.klien import GalatAI

    terkirim = {}

    def palsu(balasan: str, jenis: str):
        def request(metode, url, headers=None, timeout=None, json=None):
            terkirim.update(json or {})
            return httpx.Response(200, headers={"content-type": jenis}, text=balasan)
        return request

    sse = (
        'data: {"choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n'
        'data: {"choices":[{"index":0,"delta":{"content":"SI"},"finish_reason":null}]}\n\n'
        'data: {"choices":[{"index":0,"delta":{"content":"AP"},"finish_reason":"stop"}]}\n\n'
        "data: [DONE]\n"
    )
    k = KlienAI(base_url="http://router/v1", api_key="x", model="ag/gemini-3.1-pro-low")
    monkeypatch.setattr(K.httpx, "request", palsu(sse, "text/event-stream"))
    assert k.chat([{"role": "user", "content": "hai"}]) == "SIAP"
    assert terkirim["stream"] is False

    monkeypatch.setattr(K.httpx, "request", palsu('{"choices":[{"message":{"content":"OK"},"finish_reason":"stop"}]}', "application/json"))
    assert k.chat([{"role": "user", "content": "hai"}]) == "OK"

    kosong = '{"choices":[{"message":{"role":"assistant","content":""},"finish_reason":"max_tokens"}]}'
    monkeypatch.setattr(K.httpx, "request", palsu(kosong, "application/json"))
    with pytest.raises(GalatAI, match="kehabisan token"):
        k.chat([{"role": "user", "content": "hai"}])


class KlienScope(KlienAI):
    def __init__(self, balasan: str):
        super().__init__(base_url="http://tiruan", api_key="", model="tiruan-scope")
        self.balasan, self.pesan = balasan, ""

    def chat(self, pesan, suhu=0.1, maks_token=8000):
        self.pesan = pesan[-1]["content"]
        return self.balasan


def test_penilaian_scope_terima_tolak(template_docx, naskah_docx, tmp_path):
    import docx

    from app.ai.scope import nilai_scope

    prof, _ = ekstrak_template(str(template_docx))
    prof.scope.fokus_dan_ruang_lingkup = "1. Data Mining\n2. E-Business\n3. Human-Computer Interaction"
    k = KlienScope('{"keputusan": "tolak", "skor": 22, "bidang_cocok": [], "alasan": "Kontribusi utama pada pedagogi, bukan sistem informasi."}')
    keluar = tmp_path / "scope.docx"
    hasil = cek_naskah(str(naskah_docx), prof, "Uji", keluar, penilai_scope=lambda dm, p: nilai_scope(k, dm, p))
    assert hasil["scope"]["keputusan"] == "tolak" and hasil["scope"]["skor"] == 22
    # AI menerima scope + ringkasan menyeluruh naskah (judul, abstrak, kata kunci, struktur, isi bagian)
    for kunci in ("FOCUS & SCOPE JURNAL", "Data Mining", "JUDUL:", "ABSTRAK:", "KATA KUNCI:", "STRUKTUR:", "[PENDAHULUAN]"):
        assert kunci in k.pesan
    teks = " | ".join(c.text for c in docx.Document(str(keluar)).comments)
    assert "Kesesuaian scope: tidak sesuai, naskah ditolak (22/100). Kontribusi utama pada pedagogi" in teks

    # putusan yang tidak dikenali / AI gagal -> dicatat, cek bot tetap selesai
    rusak = KlienScope('{"keputusan": "mungkin"}')
    hasil = cek_naskah(str(naskah_docx), prof, "Uji", tmp_path / "s2.docx", penilai_scope=lambda dm, p: nilai_scope(rusak, dm, p))
    assert "galat" in hasil["scope"] and hasil["ringkasan"]["wajib"] > 0
