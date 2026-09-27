"""CLI AutoJurnal — cek banyak naskah tanpa membuka web.

  python -m app.cli ekstrak "Template.docx" -o profil.json
  python -m app.cli cek "folder_naskah" --profil profil.json -o hasil/
  python -m app.cli cek naskah.docx --jurnal "Jurnal SIBC"        (profil dari database aplikasi)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine.ekstrak import ekstrak_template
from .engine.layanan import cek_naskah
from .engine.profil import Profil


def _muat_profil(a) -> tuple[Profil, str]:
    if a.profil:
        data = json.loads(Path(a.profil).read_text(encoding="utf-8"))
        return Profil.model_validate(data.get("profil", data)), data.get("nama") or Path(a.profil).stem
    from sqlmodel import Session, select

    from .db import Jurnal, engine, siapkan_db

    siapkan_db()
    with Session(engine) as s:
        j = s.exec(select(Jurnal).where(Jurnal.nama == a.jurnal)).first()
        if not j:
            sys.exit(f"Jurnal “{a.jurnal}” tidak ada. Pilihan: {', '.join(x.nama for x in s.exec(select(Jurnal)))}")
        return Profil.model_validate_json(j.profil_json), j.nama


def perintah_ekstrak(a):
    prof, _ = ekstrak_template(a.template)
    keluar = Path(a.o or Path(a.template).with_suffix(".profil.json").name)
    keluar.write_text(json.dumps({"format": "autojurnal-profil", "versi": 1, "nama": Path(a.template).stem,
                                  "profil": prof.model_dump()}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Profil disimpan ke {keluar}")
    for c in prof.catatan_ekstraksi:
        print(" -", c)


def perintah_cek(a):
    prof, nama = _muat_profil(a)
    sumber = Path(a.naskah)
    berkas = sorted(sumber.rglob("*.docx")) if sumber.is_dir() else [sumber]
    berkas = [b for b in berkas if not b.name.startswith("~$") and not b.stem.endswith("_DICEK")]
    keluar = Path(a.o or (sumber if sumber.is_dir() else sumber.parent) / "hasil_autojurnal")
    keluar.mkdir(parents=True, exist_ok=True)
    ringkas = []
    for b in berkas:
        try:
            h = cek_naskah(str(b), prof, nama, keluar / f"{b.stem}_DICEK.docx")
            r = h["ringkasan"]
            print(f"✓ {b.name}: {r['masalah']} masalah ({r['wajib']} wajib, {r['saran']} saran)")
            ringkas.append({"berkas": b.name, **r, "statistik": h["statistik"]})
        except Exception as e:  # satu berkas rusak tidak menghentikan yang lain
            print(f"✗ {b.name}: {e}")
            ringkas.append({"berkas": b.name, "galat": str(e)})
    (keluar / "ringkasan.json").write_text(json.dumps(ringkas, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(berkas)} naskah diperiksa. Hasil di: {keluar}")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="autojurnal", description="Cek naskah artikel berdasarkan template jurnal.")
    sub = ap.add_subparsers(dest="perintah", required=True)
    e = sub.add_parser("ekstrak", help="baca template jurnal -> profil aturan (.json)")
    e.add_argument("template")
    e.add_argument("-o", help="berkas keluaran .json")
    e.set_defaults(fungsi=perintah_ekstrak)
    c = sub.add_parser("cek", help="cek satu naskah .docx atau satu folder")
    c.add_argument("naskah")
    g = c.add_mutually_exclusive_group(required=True)
    g.add_argument("--profil", help="berkas profil .json (hasil ekstrak / ekspor web)")
    g.add_argument("--jurnal", help="nama jurnal yang tersimpan di aplikasi web")
    c.add_argument("-o", help="folder keluaran")
    c.set_defaults(fungsi=perintah_cek)
    a = ap.parse_args(argv)
    a.fungsi(a)


if __name__ == "__main__":
    main()
