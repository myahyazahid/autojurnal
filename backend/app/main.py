"""AutoJurnal — API + penyaji frontend."""
from __future__ import annotations

import asyncio
import io
import json
import re
import shutil
import time
import uuid
import zipfile
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from sqlmodel import Session, func, select
from starlette.middleware.sessions import SessionMiddleware

from . import auth
from .ai.ekstrak_ai import perbaiki_dengan_ai
from .ai.klien import GalatAI, KlienAI
from .ai.naratif import cek_naratif
from .auth import nama_komentar, pengguna_saat_ini, wajib_admin
from .config import (COOKIE_AMAN, DIR_HASIL, DIR_SEMENTARA, DIR_TEMPLATE, FRONTEND_DIST, LAMA_SESI_HARI, MAKS_MB,
                     SECRET_KEY, VERSI)
from .db import (Jurnal, Pengecekan, Pengguna, baca_pengaturan, engine, iso, sekarang, sesi, siapkan_db,
                 simpan_pengaturan)
from .engine.ekstrak import ekstrak_template
from .engine.layanan import cek_naskah
from .engine.profil import Profil, skema_json

# ---------------------------------------------------------------------------
# siklus hidup & pembersihan otomatis


def bersihkan_file_lama() -> int:
    with Session(engine) as s:
        jam = float(baca_pengaturan(s).get("retensi_jam") or 24)
        batas = time.time() - jam * 3600
        dihapus = 0
        for f in DIR_HASIL.glob("*.docx"):
            if f.stat().st_mtime < batas:
                f.unlink(missing_ok=True)
                dihapus += 1
                row = s.get(Pengecekan, f.stem)
                if row:
                    row.file_hasil = ""
                    s.add(row)
        for f in DIR_SEMENTARA.glob("*"):
            if f.stat().st_mtime < time.time() - 6 * 3600:
                f.unlink(missing_ok=True)
        s.commit()
    return dihapus


async def _tugas_pembersih():
    while True:
        try:
            await asyncio.to_thread(bersihkan_file_lama)
        except Exception:
            pass
        await asyncio.sleep(1800)


@asynccontextmanager
async def lifespan(app: FastAPI):
    siapkan_db()
    tugas = asyncio.create_task(_tugas_pembersih())
    yield
    tugas.cancel()


app = FastAPI(title="AutoJurnal", version=VERSI, lifespan=lifespan)
app.add_middleware(
    SessionMiddleware, secret_key=SECRET_KEY, session_cookie="autojurnal_sesi",
    max_age=LAMA_SESI_HARI * 86400, same_site="lax", https_only=COOKIE_AMAN,
)
app.include_router(auth.router)

Pengguna_ = Depends(pengguna_saat_ini)
Admin_ = Depends(wajib_admin)


def klien_ai(s: Session) -> KlienAI:
    p = baca_pengaturan(s)
    return KlienAI(base_url=p["ai_base_url"].strip(), api_key=p["ai_api_key"].strip(), model=p["ai_model"].strip())


async def simpan_unggahan(berkas: UploadFile, tujuan: Path) -> None:
    nama = (berkas.filename or "").lower()
    if nama.endswith(".doc"):
        raise HTTPException(400, "Format .doc (Word lama) belum didukung. Buka di Word lalu Simpan Sebagai .docx.")
    if not nama.endswith((".docx", ".dotx")):
        raise HTTPException(400, "Berkas harus berformat .docx.")
    data = await berkas.read()
    if len(data) > MAKS_MB * 1024 * 1024:
        raise HTTPException(413, f"Berkas melebihi {MAKS_MB} MB.")
    if not data.startswith(b"PK"):
        raise HTTPException(400, "Berkas bukan .docx yang valid.")
    tujuan.write_bytes(data)


# ---------------------------------------------------------------------------
# umum


@app.get("/api/status")
def status(_: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    k = klien_ai(s)
    return {"versi": VERSI, "ai_aktif": k.aktif, "ai_model": k.model}


@app.get("/api/skema")
def skema(_: Pengguna = Pengguna_):
    return skema_json()


@app.get("/api/statistik")
def statistik(u: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    milik = select(Pengecekan).where(Pengecekan.pengguna_id == u.id)
    cek = list(s.exec(milik.order_by(Pengecekan.dibuat.desc()).limit(200)))
    selesai = [json.loads(c.hasil_json or "{}").get("ringkasan") or {} for c in cek if c.status == "selesai"]
    minggu = sekarang() - timedelta(days=7)
    return {
        "total_cek": s.exec(select(func.count()).select_from(Pengecekan).where(Pengecekan.pengguna_id == u.id)).one(),
        "cek_minggu_ini": sum(1 for c in cek if (c.dibuat if c.dibuat.tzinfo else c.dibuat.replace(tzinfo=minggu.tzinfo)) >= minggu),
        "rata_masalah": round(sum(r.get("masalah", 0) for r in selesai) / len(selesai), 1) if selesai else None,
        "jumlah_jurnal": s.exec(select(func.count()).select_from(Jurnal)).one(),
        "siap_kirim": sum(1 for r in selesai if r.get("wajib") == 0),
    }


# ---------------------------------------------------------------------------
# jurnal & profil aturan (baca: semua pengguna; ubah: admin)


class JurnalMasuk(BaseModel):
    nama: str
    deskripsi: str = ""
    profil: Profil
    token_template: Optional[str] = None
    template_nama: Optional[str] = None


def _ringkas_jurnal(j: Jurnal) -> dict:
    p = json.loads(j.profil_json)
    return {
        "id": j.id,
        "nama": j.nama,
        "deskripsi": j.deskripsi,
        "template_nama": j.template_nama,
        "punya_template": (DIR_TEMPLATE / f"{j.id}.docx").exists(),
        "diubah": iso(j.diubah),
        "bagian": [b["judul"] for b in p.get("struktur", {}).get("bagian", [])],
        "jumlah_naratif": len(p.get("aturan_naratif", [])),
    }


@app.get("/api/jurnal")
def daftar_jurnal(_: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    return [_ringkas_jurnal(j) for j in s.exec(select(Jurnal).order_by(Jurnal.nama))]


@app.get("/api/jurnal/{jid}")
def ambil_jurnal(jid: int, _: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    j = s.get(Jurnal, jid)
    if not j:
        raise HTTPException(404, "Jurnal tidak ditemukan.")
    return {**_ringkas_jurnal(j), "profil": json.loads(j.profil_json)}


def _ekstrak(path: Path, k: KlienAI | None, panduan: str) -> dict:
    try:
        prof, peta = ekstrak_template(str(path))
    except Exception as e:
        raise HTTPException(400, f"Template tidak bisa dibaca: {e}")
    info_ai = {"dipakai": False, "galat": None, "perubahan": []}
    if k is not None:
        try:
            prof, ubah = perbaiki_dengan_ai(k, prof, peta, panduan)
            info_ai.update(dipakai=True, perubahan=ubah)
        except Exception as e:  # AI gagal -> tetap kembalikan hasil bot
            info_ai["galat"] = str(e)
    return {"profil": prof.model_dump(), "peta": peta, "ai": info_ai}


@app.post("/api/jurnal/ekstrak")
async def ekstrak(template: UploadFile = File(...), pakai_ai: bool = Form(False), panduan: str = Form(""),
                  _: Pengguna = Admin_, s: Session = Depends(sesi)):
    token = uuid.uuid4().hex
    path = DIR_SEMENTARA / f"tpl_{token}.docx"
    await simpan_unggahan(template, path)
    hasil = await asyncio.to_thread(_ekstrak, path, klien_ai(s) if pakai_ai else None, panduan)
    return {"token": token, "template_nama": template.filename, **hasil}


@app.post("/api/jurnal/{jid}/ekstrak-ulang")
async def ekstrak_ulang(jid: int, pakai_ai: bool = Form(False), panduan: str = Form(""),
                        _: Pengguna = Admin_, s: Session = Depends(sesi)):
    path = DIR_TEMPLATE / f"{jid}.docx"
    if not s.get(Jurnal, jid) or not path.exists():
        raise HTTPException(404, "Template jurnal ini tidak tersimpan.")
    return await asyncio.to_thread(_ekstrak, path, klien_ai(s) if pakai_ai else None, panduan)


def _buat_jurnal(masuk: JurnalMasuk, u: Pengguna, s: Session) -> dict:
    j = Jurnal(nama=masuk.nama.strip() or "Tanpa nama", deskripsi=masuk.deskripsi, dibuat_oleh=u.id,
               profil_json=masuk.profil.model_dump_json(), template_nama=masuk.template_nama or "")
    s.add(j)
    s.commit()
    s.refresh(j)
    if masuk.token_template and re.fullmatch(r"[0-9a-f]{32}", masuk.token_template):
        sumber = DIR_SEMENTARA / f"tpl_{masuk.token_template}.docx"
        if sumber.exists():
            shutil.move(str(sumber), DIR_TEMPLATE / f"{j.id}.docx")
    return _ringkas_jurnal(j)


@app.post("/api/jurnal")
def buat_jurnal(masuk: JurnalMasuk, u: Pengguna = Admin_, s: Session = Depends(sesi)):
    return _buat_jurnal(masuk, u, s)


@app.put("/api/jurnal/{jid}")
def ubah_jurnal(jid: int, masuk: JurnalMasuk, _: Pengguna = Admin_, s: Session = Depends(sesi)):
    j = s.get(Jurnal, jid)
    if not j:
        raise HTTPException(404, "Jurnal tidak ditemukan.")
    j.nama, j.deskripsi = masuk.nama.strip() or j.nama, masuk.deskripsi
    j.profil_json, j.diubah = masuk.profil.model_dump_json(), sekarang()
    s.add(j)
    s.commit()
    s.refresh(j)
    return _ringkas_jurnal(j)


@app.delete("/api/jurnal/{jid}")
def hapus_jurnal(jid: int, _: Pengguna = Admin_, s: Session = Depends(sesi)):
    j = s.get(Jurnal, jid)
    if not j:
        raise HTTPException(404, "Jurnal tidak ditemukan.")
    s.delete(j)
    s.commit()
    (DIR_TEMPLATE / f"{jid}.docx").unlink(missing_ok=True)
    return {"ok": True}


@app.get("/api/jurnal/{jid}/ekspor")
def ekspor_jurnal(jid: int, _: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    j = s.get(Jurnal, jid)
    if not j:
        raise HTTPException(404, "Jurnal tidak ditemukan.")
    isi = {"format": "autojurnal-profil", "versi": 1, "nama": j.nama, "deskripsi": j.deskripsi,
           "profil": json.loads(j.profil_json)}
    nama = re.sub(r"[^\w\-]+", "_", j.nama).strip("_") or "profil"
    return Response(json.dumps(isi, ensure_ascii=False, indent=2), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{nama}.autojurnal.json"'})


@app.post("/api/jurnal/impor")
async def impor_jurnal(berkas: UploadFile = File(...), u: Pengguna = Admin_, s: Session = Depends(sesi)):
    try:
        data = json.loads((await berkas.read()).decode("utf-8"))
        prof = Profil.model_validate(data.get("profil", data))
    except (ValueError, ValidationError, AttributeError) as e:
        raise HTTPException(400, f"Berkas profil tidak valid: {e}")
    return _buat_jurnal(JurnalMasuk(nama=data.get("nama") or Path(berkas.filename or "Impor").stem,
                                    deskripsi=data.get("deskripsi", ""), profil=prof), u, s)


@app.get("/api/jurnal/{jid}/template")
def unduh_template(jid: int, _: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    j = s.get(Jurnal, jid)
    path = DIR_TEMPLATE / f"{jid}.docx"
    if not j or not path.exists():
        raise HTTPException(404, "Template tidak tersimpan.")
    return FileResponse(path, filename=j.template_nama or f"template_{jid}.docx")


# ---------------------------------------------------------------------------
# pengecekan naskah (pengguna hanya melihat miliknya; admin boleh melihat semua)


def _baris_cek(c: Pengecekan, lengkap: bool = False) -> dict:
    hasil = json.loads(c.hasil_json or "{}")
    d = {
        "id": c.id, "jurnal_id": c.jurnal_id, "jurnal_nama": c.jurnal_nama, "nama_file": c.nama_file,
        "pengguna_id": c.pengguna_id, "pengguna_nama": c.pengguna_nama,
        "pakai_ai": c.pakai_ai, "status": c.status, "pesan_galat": c.pesan_galat,
        "file_tersedia": bool(c.file_hasil) and (DIR_HASIL / c.file_hasil).exists(),
        "dibuat": iso(c.dibuat), "ringkasan": hasil.get("ringkasan"),
    }
    if lengkap:
        d.update(statistik=hasil.get("statistik"), temuan=hasil.get("temuan", []), galat_ai=hasil.get("galat_ai"),
                 penulis_komentar=hasil.get("penulis_komentar"))
    return d


def _milik(cid: str, u: Pengguna, s: Session) -> Pengecekan:
    c = s.get(Pengecekan, cid)
    if not c or (c.pengguna_id != u.id and u.peran != "admin"):
        raise HTTPException(404, "Data pengecekan tidak ditemukan.")
    return c


@app.post("/api/cek")
async def cek(naskah: UploadFile = File(...), jurnal_id: int = Form(...), pakai_ai: bool = Form(False),
              u: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    j = s.get(Jurnal, jurnal_id)
    if not j:
        raise HTTPException(404, "Jurnal tidak ditemukan.")
    prof = Profil.model_validate_json(j.profil_json)
    cid = uuid.uuid4().hex
    masuk = DIR_SEMENTARA / f"naskah_{cid}.docx"
    await simpan_unggahan(naskah, masuk)
    keluar = DIR_HASIL / f"{cid}.docx"
    tambahan = None
    if pakai_ai:
        k = klien_ai(s)
        if not k.aktif:
            masuk.unlink(missing_ok=True)
            raise HTTPException(400, "AI belum diatur. Minta admin mengisinya di Pengaturan, atau matikan opsi AI.")
        if prof.aturan_naratif:
            tambahan = lambda dm, pr: cek_naratif(k, dm, pr)  # noqa: E731
    penulis = nama_komentar(u)
    pemeriksa = f"{u.nama or u.email} <{u.email}>"
    row = Pengecekan(id=cid, pengguna_id=u.id, pengguna_nama=u.nama or u.email, jurnal_id=j.id, jurnal_nama=j.nama,
                     nama_file=naskah.filename or "naskah.docx", pakai_ai=pakai_ai)
    try:
        hasil = await asyncio.to_thread(cek_naskah, str(masuk), prof, j.nama, keluar, tambahan, penulis, pemeriksa)
        hasil["penulis_komentar"] = penulis
        row.hasil_json = json.dumps(hasil, ensure_ascii=False)
        row.file_hasil = keluar.name
    except Exception as e:
        row.status, row.pesan_galat = "gagal", f"Naskah tidak bisa diproses: {e}"
    finally:
        masuk.unlink(missing_ok=True)
    s.add(row)
    s.commit()
    s.refresh(row)
    return _baris_cek(row, lengkap=True)


@app.get("/api/cek")
def riwayat(batas: int = Query(100, le=500), semua: bool = False, u: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    q = select(Pengecekan)
    if not (semua and u.peran == "admin"):
        q = q.where(Pengecekan.pengguna_id == u.id)
    return [_baris_cek(c) for c in s.exec(q.order_by(Pengecekan.dibuat.desc()).limit(batas))]


@app.get("/api/cek/{cid}")
def detail_cek(cid: str, u: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    return _baris_cek(_milik(cid, u, s), lengkap=True)


def _nama_unduh(c: Pengecekan) -> str:
    return f"{Path(c.nama_file).stem}_DICEK.docx"


@app.get("/api/cek/{cid}/unduh")
def unduh(cid: str, u: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    c = _milik(cid, u, s)
    if not c.file_hasil or not (DIR_HASIL / c.file_hasil).exists():
        raise HTTPException(404, "Berkas hasil sudah tidak tersedia (terhapus otomatis setelah masa simpan).")
    return FileResponse(DIR_HASIL / c.file_hasil, filename=_nama_unduh(c),
                        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@app.get("/api/unduh-zip")
def unduh_zip(id: list[str] = Query(...), u: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    buf = io.BytesIO()
    dipakai: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for cid in id:
            c = s.get(Pengecekan, cid)
            if not c or (c.pengguna_id != u.id and u.peran != "admin"):
                continue
            if c.file_hasil and (DIR_HASIL / c.file_hasil).exists():
                nama = _nama_unduh(c)
                while nama in dipakai:
                    nama = "_" + nama
                dipakai.add(nama)
                z.write(DIR_HASIL / c.file_hasil, nama)
    if not dipakai:
        raise HTTPException(404, "Tidak ada berkas hasil yang tersedia.")
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
                             headers={"Content-Disposition": 'attachment; filename="hasil_cek_autojurnal.zip"'})


@app.delete("/api/cek/{cid}")
def hapus_cek(cid: str, u: Pengguna = Pengguna_, s: Session = Depends(sesi)):
    c = _milik(cid, u, s)
    if c.file_hasil:
        (DIR_HASIL / c.file_hasil).unlink(missing_ok=True)
    s.delete(c)
    s.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# pengaturan (admin)


class PengaturanMasuk(BaseModel):
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    hapus_api_key: bool = False
    retensi_jam: Optional[float] = None


def _samar(key: str) -> str:
    return "" if not key else (key[:3] + "…" + key[-4:] if len(key) > 10 else "•" * len(key))


@app.get("/api/pengaturan")
def ambil_pengaturan(_: Pengguna = Admin_, s: Session = Depends(sesi)):
    p = baca_pengaturan(s)
    return {"ai_base_url": p["ai_base_url"], "ai_model": p["ai_model"], "ai_api_key_samar": _samar(p["ai_api_key"]),
            "ai_api_key_terisi": bool(p["ai_api_key"]), "retensi_jam": float(p["retensi_jam"] or 24)}


@app.put("/api/pengaturan")
def ubah_pengaturan(m: PengaturanMasuk, a: Pengguna = Admin_, s: Session = Depends(sesi)):
    baru: dict[str, str] = {}
    if m.ai_base_url is not None:
        baru["ai_base_url"] = m.ai_base_url.strip()
    if m.ai_model is not None:
        baru["ai_model"] = m.ai_model.strip()
    if m.ai_api_key:
        baru["ai_api_key"] = m.ai_api_key.strip()
    if m.hapus_api_key:
        baru["ai_api_key"] = ""
    if m.retensi_jam is not None:
        baru["retensi_jam"] = str(max(1.0, min(m.retensi_jam, 24 * 90)))
    simpan_pengaturan(s, baru)
    return ambil_pengaturan(a, s)


class TesAI(BaseModel):
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None


def _klien_uji(m: TesAI, s: Session) -> KlienAI:
    k = klien_ai(s)
    return KlienAI(base_url=(m.ai_base_url or k.base_url).strip(), api_key=(m.ai_api_key or k.api_key).strip(),
                   model=(m.ai_model or k.model).strip())


@app.post("/api/pengaturan/tes-ai")
def tes_ai(m: TesAI, _: Pengguna = Admin_, s: Session = Depends(sesi)):
    k = _klien_uji(m, s)
    try:
        t0 = time.time()
        jawab = k.chat([{"role": "user", "content": "Balas hanya dengan kata: SIAP"}], maks_token=1024)
        return {"ok": True, "pesan": f"Terhubung ke {k.model} ({time.time() - t0:.1f} detik). Balasan: {jawab.strip()[:60]}"}
    except GalatAI as e:
        return {"ok": False, "pesan": str(e)}


@app.post("/api/pengaturan/model-ai")
def model_ai(m: TesAI, _: Pengguna = Admin_, s: Session = Depends(sesi)):
    try:
        return {"ok": True, "model": _klien_uji(m, s).daftar_model()}
    except GalatAI as e:
        return {"ok": False, "pesan": str(e), "model": []}


# ---------------------------------------------------------------------------
# frontend (hasil build React) + fallback SPA


# index.html selalu dicek ulang browser -> setelah UI di-update, pengguna langsung mendapat versi baru.
# Berkas di /assets bernama hash (mis. index-Cv4cEMTg.js) sehingga aman di-cache lama.
TANPA_CACHE = {"Cache-Control": "no-cache"}


class AsetAbadi(StaticFiles):
    async def get_response(self, path, scope):
        r = await super().get_response(path, scope)
        if r.status_code == 200:
            r.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return r


def _halaman_utama():
    if (FRONTEND_DIST / "index.html").exists():
        return FileResponse(FRONTEND_DIST / "index.html", headers=TANPA_CACHE)
    return JSONResponse({"pesan": "Frontend belum di-build. Jalankan: cd frontend && npm install && npm run build"})


@app.exception_handler(404)
async def _tidak_ada(request, exc):
    if request.url.path.startswith("/api/") or not (FRONTEND_DIST / "index.html").exists():
        detail = getattr(exc, "detail", "Tidak ditemukan.")
        return JSONResponse({"detail": detail}, status_code=404)
    berkas = (FRONTEND_DIST / request.url.path.lstrip("/")).resolve()
    if berkas.is_file() and FRONTEND_DIST in berkas.parents:  # mis. /favicon.svg
        return FileResponse(berkas, headers=TANPA_CACHE)
    return _halaman_utama()


# check_dir=False: build UI boleh diunggah belakangan tanpa perlu restart server
app.mount("/assets", AsetAbadi(directory=FRONTEND_DIST / "assets", check_dir=False), name="assets")


@app.get("/", include_in_schema=False)
def beranda():
    return _halaman_utama()
