"""Akun & sesi: daftar/masuk dengan email+sandi, masuk dengan Google (OAuth 2.0 + PKCE), peran admin/pengguna."""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import time
from collections import defaultdict, deque
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, func, select

from . import config as C
from .db import Pengguna, iso, sekarang, sesi

router = APIRouter()

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"
RX_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# sandi (scrypt, pustaka standar)


def hash_sandi(sandi: str) -> str:
    garam = secrets.token_bytes(16)
    h = hashlib.scrypt(sandi.encode(), salt=garam, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt$16384$8$1${base64.b64encode(garam).decode()}${base64.b64encode(h).decode()}"


def cek_sandi(sandi: str, tersimpan: str) -> bool:
    try:
        _, n, r, p, garam, h = tersimpan.split("$")
        hitung = hashlib.scrypt(sandi.encode(), salt=base64.b64decode(garam), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(hitung, base64.b64decode(h))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# pembatas percobaan masuk (per IP, di memori)

_gagal: dict[str, deque] = defaultdict(deque)
JENDELA_DETIK, MAKS_GAGAL = 600, 10


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else None) or (request.client.host if request.client else "?")


def _cek_batas(request: Request) -> None:
    q = _gagal[_ip(request)]
    while q and q[0] < time.time() - JENDELA_DETIK:
        q.popleft()
    if len(q) >= MAKS_GAGAL:
        raise HTTPException(429, "Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit.")


def _catat_gagal(request: Request) -> None:
    _gagal[_ip(request)].append(time.time())


# ---------------------------------------------------------------------------
# dependensi


def pengguna_saat_ini(request: Request, s: Session = Depends(sesi)) -> Pengguna:
    uid = request.session.get("uid")
    u = s.get(Pengguna, uid) if uid else None
    if not u or not u.aktif:
        request.session.clear()
        raise HTTPException(401, "Silakan masuk terlebih dahulu.")
    return u


def wajib_admin(u: Pengguna = Depends(pengguna_saat_ini)) -> Pengguna:
    if u.peran != "admin":
        raise HTTPException(403, "Hanya admin yang boleh melakukan ini.")
    return u


def nama_komentar(u: Pengguna) -> str:
    nama = u.nama or u.email.split("@")[0]
    return {"email": u.email, "nama_email": f"{nama} ({u.email})"}.get(u.format_nama_komentar, nama)


def ke_dict(u: Pengguna) -> dict:
    return {
        "id": u.id, "email": u.email, "nama": u.nama, "foto": u.foto, "peran": u.peran, "aktif": u.aktif,
        "punya_sandi": bool(u.hash_sandi), "terhubung_google": bool(u.google_sub),
        "format_nama_komentar": u.format_nama_komentar, "nama_komentar": nama_komentar(u),
        "dibuat": iso(u.dibuat), "terakhir_masuk": iso(u.terakhir_masuk),
    }


def _domain_boleh(email: str) -> bool:
    return not C.DOMAIN_EMAIL or email.rsplit("@", 1)[-1].lower() in C.DOMAIN_EMAIL


def _peran_awal(s: Session, email: str) -> str:
    """Bila AUTOJURNAL_ADMIN_EMAILS diisi, HANYA email itu yang menjadi admin.
    Bila kosong, pengguna pertama menjadi admin (praktis untuk instalasi lokal)."""
    if C.ADMIN_EMAILS:
        return "admin" if email.lower() in C.ADMIN_EMAILS else "pengguna"
    ada_admin = s.exec(select(func.count()).select_from(Pengguna).where(Pengguna.peran == "admin")).one()
    return "pengguna" if ada_admin else "admin"


def _masukkan(request: Request, s: Session, u: Pengguna) -> dict:
    if u.email.lower() in C.ADMIN_EMAILS:
        u.peran = "admin"  # email yang ditambahkan ke ADMIN_EMAILS belakangan ikut naik saat masuk
    u.terakhir_masuk = sekarang()
    s.add(u)
    s.commit()
    s.refresh(u)
    request.session.clear()
    request.session["uid"] = u.id
    return ke_dict(u)


# ---------------------------------------------------------------------------
# email + sandi


class Daftar(BaseModel):
    nama: str
    email: str
    sandi: str


class Masuk(BaseModel):
    email: str
    sandi: str


@router.get("/api/auth/konfigurasi")
def konfigurasi():
    return {"google": C.GOOGLE_AKTIF, "daftar": C.IZINKAN_DAFTAR, "domain": C.DOMAIN_EMAIL,
            "redirect_uri": C.GOOGLE_REDIRECT_URI}


@router.post("/api/auth/daftar")
def daftar(m: Daftar, request: Request, s: Session = Depends(sesi)):
    if not C.IZINKAN_DAFTAR:
        raise HTTPException(403, "Pendaftaran dengan email dinonaktifkan. Silakan masuk dengan Google.")
    email = m.email.strip().lower()
    if not RX_EMAIL.match(email):
        raise HTTPException(400, "Alamat email tidak valid.")
    if not _domain_boleh(email):
        raise HTTPException(403, f"Hanya email {', '.join('@' + d for d in C.DOMAIN_EMAIL)} yang diizinkan.")
    if len(m.sandi) < 8:
        raise HTTPException(400, "Kata sandi minimal 8 karakter.")
    if s.exec(select(Pengguna).where(Pengguna.email == email)).first():
        raise HTTPException(409, "Email sudah terdaftar. Silakan masuk.")
    u = Pengguna(email=email, nama=m.nama.strip()[:120] or email.split("@")[0], hash_sandi=hash_sandi(m.sandi),
                 peran=_peran_awal(s, email))
    s.add(u)
    s.commit()
    return _masukkan(request, s, u)


@router.post("/api/auth/masuk")
def masuk(m: Masuk, request: Request, s: Session = Depends(sesi)):
    _cek_batas(request)
    u = s.exec(select(Pengguna).where(Pengguna.email == m.email.strip().lower())).first()
    if not u or not u.hash_sandi or not cek_sandi(m.sandi, u.hash_sandi):
        _catat_gagal(request)
        if u and not u.hash_sandi:
            raise HTTPException(401, "Akun ini dibuat lewat Google. Silakan klik “Masuk dengan Google”.")
        raise HTTPException(401, "Email atau kata sandi salah.")
    if not u.aktif:
        raise HTTPException(403, "Akun dinonaktifkan. Hubungi admin.")
    return _masukkan(request, s, u)


@router.post("/api/auth/keluar")
def keluar(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/api/auth/saya")
def saya(u: Pengguna = Depends(pengguna_saat_ini)):
    return ke_dict(u)


class UbahSaya(BaseModel):
    nama: str | None = None
    format_nama_komentar: str | None = None


@router.put("/api/auth/saya")
def ubah_saya(m: UbahSaya, u: Pengguna = Depends(pengguna_saat_ini), s: Session = Depends(sesi)):
    if m.nama is not None and m.nama.strip():
        u.nama = m.nama.strip()[:120]
    if m.format_nama_komentar in ("nama", "nama_email", "email"):
        u.format_nama_komentar = m.format_nama_komentar
    s.add(u)
    s.commit()
    s.refresh(u)
    return ke_dict(u)


class UbahSandi(BaseModel):
    sandi_lama: str = ""
    sandi_baru: str


@router.put("/api/auth/sandi")
def ubah_sandi(m: UbahSandi, request: Request, u: Pengguna = Depends(pengguna_saat_ini), s: Session = Depends(sesi)):
    if u.hash_sandi and not cek_sandi(m.sandi_lama, u.hash_sandi):
        _catat_gagal(request)
        raise HTTPException(400, "Kata sandi lama salah.")
    if len(m.sandi_baru) < 8:
        raise HTTPException(400, "Kata sandi minimal 8 karakter.")
    u.hash_sandi = hash_sandi(m.sandi_baru)
    s.add(u)
    s.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Google OAuth 2.0 (authorization code + PKCE)


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _gagal_oauth(pesan: str) -> RedirectResponse:
    return RedirectResponse("/masuk?" + urlencode({"galat": pesan}))


@router.get("/api/auth/google")
def google_mulai(request: Request):
    if not C.GOOGLE_AKTIF:
        return _gagal_oauth("Login Google belum dikonfigurasi (isi GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di .env).")
    state, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    request.session["oauth"] = {"state": state, "verifier": verifier, "t": time.time()}
    q = {
        "client_id": C.GOOGLE_CLIENT_ID, "redirect_uri": C.GOOGLE_REDIRECT_URI, "response_type": "code",
        "scope": "openid email profile", "state": state, "prompt": "select_account",
        "code_challenge": _b64url(hashlib.sha256(verifier.encode()).digest()), "code_challenge_method": "S256",
    }
    if len(C.DOMAIN_EMAIL) == 1:
        q["hd"] = C.DOMAIN_EMAIL[0]  # petunjuk ke Google agar menawarkan akun domain itu
    return RedirectResponse(f"{GOOGLE_AUTH}?{urlencode(q)}")


@router.get("/api/auth/google/callback")
def google_kembali(request: Request, code: str = "", state: str = "", error: str = "", s: Session = Depends(sesi)):
    simpan = request.session.pop("oauth", None) or {}
    if error:
        return _gagal_oauth("Masuk dengan Google dibatalkan.")
    if not code or not state or not hmac.compare_digest(state, simpan.get("state", "")) or time.time() - simpan.get("t", 0) > 600:
        return _gagal_oauth("Sesi login Google kedaluwarsa atau tidak valid. Silakan coba lagi.")
    try:
        tok = httpx.post(GOOGLE_TOKEN, data={
            "code": code, "client_id": C.GOOGLE_CLIENT_ID, "client_secret": C.GOOGLE_CLIENT_SECRET,
            "redirect_uri": C.GOOGLE_REDIRECT_URI, "grant_type": "authorization_code", "code_verifier": simpan["verifier"],
        }, timeout=20)
        tok.raise_for_status()
        info = httpx.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {tok.json()['access_token']}"}, timeout=20)
        info.raise_for_status()
        data = info.json()
    except (httpx.HTTPError, KeyError, ValueError):
        return _gagal_oauth("Gagal menghubungi Google. Periksa GOOGLE_CLIENT_SECRET & GOOGLE_REDIRECT_URI.")
    email = (data.get("email") or "").lower()
    if not email or not data.get("email_verified"):
        return _gagal_oauth("Email akun Google belum terverifikasi.")
    if not _domain_boleh(email):
        return _gagal_oauth(f"Hanya email {', '.join('@' + d for d in C.DOMAIN_EMAIL)} yang diizinkan.")
    u = s.exec(select(Pengguna).where(Pengguna.google_sub == data["sub"])).first() or \
        s.exec(select(Pengguna).where(Pengguna.email == email)).first()
    if u is None:
        if not C.IZINKAN_DAFTAR and email not in C.ADMIN_EMAILS:
            return _gagal_oauth("Akun belum terdaftar. Minta admin mendaftarkan email Anda.")
        u = Pengguna(email=email, peran=_peran_awal(s, email))
    if not u.aktif:
        return _gagal_oauth("Akun dinonaktifkan. Hubungi admin.")
    u.google_sub = data["sub"]
    u.nama = data.get("name") or u.nama or email.split("@")[0]
    u.foto = data.get("picture") or u.foto
    s.add(u)
    s.commit()
    _masukkan(request, s, u)
    return RedirectResponse("/")


# ---------------------------------------------------------------------------
# manajemen pengguna (admin)


@router.get("/api/pengguna")
def daftar_pengguna(_: Pengguna = Depends(wajib_admin), s: Session = Depends(sesi)):
    return [ke_dict(u) for u in s.exec(select(Pengguna).order_by(Pengguna.dibuat))]


class UbahPengguna(BaseModel):
    peran: str | None = None
    aktif: bool | None = None


@router.put("/api/pengguna/{uid}")
def ubah_pengguna(uid: int, m: UbahPengguna, _: Pengguna = Depends(wajib_admin), s: Session = Depends(sesi)):
    u = s.get(Pengguna, uid)
    if not u:
        raise HTTPException(404, "Pengguna tidak ditemukan.")
    turun = (m.peran and m.peran != "admin") or m.aktif is False
    if u.peran == "admin" and turun:
        sisa = s.exec(select(func.count()).select_from(Pengguna).where(Pengguna.peran == "admin", Pengguna.aktif == True)).one()  # noqa: E712
        if sisa <= 1:
            raise HTTPException(400, "Harus tersisa minimal satu admin aktif.")
    if m.peran in ("admin", "pengguna"):
        u.peran = m.peran
    if m.aktif is not None:
        u.aktif = m.aktif
    s.add(u)
    s.commit()
    s.refresh(u)
    return ke_dict(u)
