"""Alur Masuk dengan Google, memakai Google tiruan (tanpa jaringan)."""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app import auth
from app import config as C
from app.main import app


class _Balasan:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        return None

    def json(self):
        return self._data


def test_masuk_dengan_google(monkeypatch):
    monkeypatch.setattr(C, "GOOGLE_AKTIF", True)
    monkeypatch.setattr(C, "GOOGLE_CLIENT_ID", "id-uji.apps.googleusercontent.com")
    monkeypatch.setattr(C, "GOOGLE_CLIENT_SECRET", "rahasia-uji")
    dikirim = {}

    def post(url, data=None, timeout=None):
        dikirim.update(data)
        return _Balasan({"access_token": "token-uji"})

    def get(url, headers=None, timeout=None):
        assert headers["Authorization"] == "Bearer token-uji"
        return _Balasan({"sub": "google-123", "email": "Reviewer.Asli@gmail.com", "email_verified": True,
                         "name": "Reviewer Asli", "picture": "https://lh3.googleusercontent.com/a/foto"})

    monkeypatch.setattr(auth.httpx, "post", post)
    monkeypatch.setattr(auth.httpx, "get", get)

    with TestClient(app) as c:
        r = c.get("/api/auth/google", follow_redirects=False)
        tujuan = urlparse(r.headers["location"])
        q = parse_qs(tujuan.query)
        assert tujuan.netloc == "accounts.google.com"
        assert q["code_challenge_method"] == ["S256"] and q["scope"] == ["openid email profile"]

        # state salah ditolak
        r = c.get("/api/auth/google/callback?code=abc&state=palsu", follow_redirects=False)
        assert r.headers["location"].startswith("/masuk?galat=")

        r = c.get("/api/auth/google", follow_redirects=False)
        state = parse_qs(urlparse(r.headers["location"]).query)["state"][0]
        r = c.get(f"/api/auth/google/callback?code=kode-uji&state={state}", follow_redirects=False)
        assert r.headers["location"] == "/"
        assert dikirim["code"] == "kode-uji" and dikirim["code_verifier"]

        saya = c.get("/api/auth/saya").json()
        assert saya["email"] == "reviewer.asli@gmail.com" and saya["nama"] == "Reviewer Asli"
        assert saya["terhubung_google"] and not saya["punya_sandi"] and saya["foto"].startswith("https://")
        assert saya["nama_komentar"] == "Reviewer Asli"

        # akun Google tidak bisa masuk pakai sandi sebelum membuat sandi
        c.post("/api/auth/keluar")
        r = c.post("/api/auth/masuk", json={"email": "reviewer.asli@gmail.com", "sandi": "apa saja"})
        assert r.status_code == 401 and "Google" in r.json()["detail"]


def test_admin_emails_mencegah_perebutan_admin(monkeypatch):
    """Bila ADMIN_EMAILS diisi, orang asing yang mendaftar pertama TIDAK menjadi admin."""
    import secrets as _s

    monkeypatch.setattr(C, "ADMIN_EMAILS", ["pemilik@gmail.com"])
    with TestClient(app) as asing, TestClient(app) as pemilik:
        e1 = f"asing{_s.token_hex(4)}@gmail.com"
        assert asing.post("/api/auth/daftar", json={"nama": "Asing", "email": e1, "sandi": "rahasia123"}).json()["peran"] == "pengguna"
        r = pemilik.post("/api/auth/daftar", json={"nama": "Pemilik", "email": "pemilik@gmail.com", "sandi": "rahasia123"})
        assert r.json()["peran"] == "admin"
