from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import inspect, text
from sqlmodel import Field, Session, SQLModel, create_engine, select

from .config import DB_URL


def sekarang() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    """SQLite menyimpan waktu tanpa zona; nilai kita selalu UTC."""
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


class Pengguna(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    nama: str = ""
    foto: str = ""
    hash_sandi: str = ""  # kosong = hanya bisa masuk lewat Google
    google_sub: str | None = Field(default=None, index=True)
    peran: str = "pengguna"  # admin | pengguna
    aktif: bool = True
    format_nama_komentar: str = "nama"  # nama | nama_email | email
    dibuat: datetime = Field(default_factory=sekarang)
    terakhir_masuk: datetime | None = None


class Jurnal(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nama: str
    deskripsi: str = ""
    profil_json: str
    template_nama: str = ""
    dibuat_oleh: int | None = None
    dibuat: datetime = Field(default_factory=sekarang)
    diubah: datetime = Field(default_factory=sekarang)


class Pengecekan(SQLModel, table=True):
    id: str = Field(primary_key=True)
    pengguna_id: int | None = Field(default=None, index=True)
    pengguna_nama: str = ""
    jurnal_id: int | None = None
    jurnal_nama: str = ""
    nama_file: str
    pakai_ai: bool = False
    status: str = "selesai"  # selesai | gagal
    hasil_json: str = "{}"
    pesan_galat: str = ""
    file_hasil: str = ""  # nama file di DIR_HASIL; kosong bila sudah dihapus otomatis
    dibuat: datetime = Field(default_factory=sekarang)


class Pengaturan(SQLModel, table=True):
    kunci: str = Field(primary_key=True)
    nilai: str = ""


engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})

BAWAAN = {"ai_base_url": "", "ai_api_key": "", "ai_model": "", "retensi_jam": "24"}


def _migrasi() -> None:
    """Tambah kolom baru ke tabel lama (SQLModel tidak mengubah tabel yang sudah ada)."""
    ins = inspect(engine)
    with engine.begin() as con:
        for tabel in SQLModel.metadata.sorted_tables:
            if not ins.has_table(tabel.name):
                continue
            ada = {c["name"] for c in ins.get_columns(tabel.name)}
            for kol in tabel.columns:
                if kol.name in ada:
                    continue
                jenis = kol.type.compile(dialect=engine.dialect)
                bawaan = ""
                if kol.default is not None and getattr(kol.default, "is_scalar", False):
                    v = kol.default.arg
                    bawaan = f" DEFAULT {int(v) if isinstance(v, bool) else repr(v)}"
                con.execute(text(f'ALTER TABLE "{tabel.name}" ADD COLUMN "{kol.name}" {jenis}{bawaan}'))


def siapkan_db() -> None:
    SQLModel.metadata.create_all(engine)
    _migrasi()


def sesi():
    with Session(engine) as s:
        yield s


def baca_pengaturan(s: Session) -> dict[str, str]:
    data = dict(BAWAAN)
    for row in s.exec(select(Pengaturan)):
        data[row.kunci] = row.nilai
    return data


def simpan_pengaturan(s: Session, nilai: dict[str, str]) -> None:
    for k, v in nilai.items():
        row = s.get(Pengaturan, k) or Pengaturan(kunci=k)
        row.nilai = v
        s.add(row)
    s.commit()
