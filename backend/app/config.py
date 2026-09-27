from __future__ import annotations

import os
import secrets
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]


def _muat_env(path: Path) -> None:
    """Pembaca .env sederhana: KUNCI=nilai, abaikan komentar; tidak menimpa env yang sudah ada."""
    if not path.is_file():
        return
    for baris in path.read_text(encoding="utf-8").splitlines():
        baris = baris.strip()
        if not baris or baris.startswith("#") or "=" not in baris:
            continue
        k, v = baris.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        os.environ.setdefault(k.strip(), v)


_muat_env(AKAR / ".env")


def _env(nama: str, bawaan: str = "") -> str:
    """Nilai env; bila tidak ada ATAU dikosongkan di .env, pakai bawaan."""
    return os.environ.get(nama, "").strip() or bawaan


def _bool(nama: str, bawaan: bool) -> bool:
    v = _env(nama).lower()
    return bawaan if not v else v in ("1", "true", "ya", "yes", "on")


def _daftar(nama: str) -> list[str]:
    return [x.strip().lower() for x in _env(nama).split(",") if x.strip()]


DATA = Path(_env("AUTOJURNAL_DATA", str(AKAR / "data"))).resolve()
FRONTEND_DIST = Path(_env("AUTOJURNAL_FRONTEND", str(AKAR / "frontend" / "dist"))).resolve()
DB_URL = _env("AUTOJURNAL_DB", f"sqlite:///{(DATA / 'autojurnal.db').as_posix()}")
MAKS_MB = int(_env("AUTOJURNAL_MAKS_MB", "50"))
VERSI = "0.2.0"

DIR_TEMPLATE = DATA / "template"
DIR_HASIL = DATA / "hasil"
DIR_SEMENTARA = DATA / "sementara"
for _d in (DIR_TEMPLATE, DIR_HASIL, DIR_SEMENTARA):
    _d.mkdir(parents=True, exist_ok=True)

# --- akun & sesi ------------------------------------------------------------
BASE_URL = _env("AUTOJURNAL_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
COOKIE_AMAN = _bool("AUTOJURNAL_COOKIE_AMAN", BASE_URL.startswith("https://"))
IZINKAN_DAFTAR = _bool("AUTOJURNAL_IZINKAN_DAFTAR", True)
ADMIN_EMAILS = _daftar("AUTOJURNAL_ADMIN_EMAILS")
DOMAIN_EMAIL = _daftar("AUTOJURNAL_DOMAIN_EMAIL")  # kosong = semua domain boleh
LAMA_SESI_HARI = int(_env("AUTOJURNAL_LAMA_SESI_HARI", "14"))


def _kunci_rahasia() -> str:
    """Pakai AUTOJURNAL_SECRET_KEY; bila kosong, buat sekali lalu simpan agar sesi tetap valid setelah restart."""
    k = _env("AUTOJURNAL_SECRET_KEY")
    if k:
        return k
    f = DATA / ".secret_key"
    if not f.exists():
        f.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    return f.read_text(encoding="utf-8").strip()


SECRET_KEY = _kunci_rahasia()

# --- Google OAuth -------------------------------------------------------------
GOOGLE_CLIENT_ID = _env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = _env("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = _env("GOOGLE_REDIRECT_URI", f"{BASE_URL}/api/auth/google/callback")
GOOGLE_AKTIF = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
