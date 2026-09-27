"""Klien AI OpenAI-compatible (9router, OpenRouter, Ollama, LiteLLM, dll.) — cukup base URL + key + model."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

import httpx


class GalatAI(Exception):
    pass


@dataclass
class KlienAI:
    base_url: str
    api_key: str
    model: str
    timeout: float = 180.0

    @property
    def aktif(self) -> bool:
        return bool(self.base_url and self.model)

    def _url(self, jalur: str, base: str | None = None) -> str:
        return (base or self.base_url).rstrip("/") + jalur

    def _header(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def _kirim(self, metode: str, jalur: str, **kw) -> httpx.Response:
        """Coba base URL apa adanya; bila 404 dan belum diakhiri /v1, coba sekali lagi dengan /v1."""
        kandidat = [self.base_url]
        if not self.base_url.rstrip("/").endswith("/v1"):
            kandidat.append(self.base_url.rstrip("/") + "/v1")
        terakhir: httpx.Response | None = None
        for base in kandidat:
            try:
                r = httpx.request(metode, self._url(jalur, base), headers=self._header(), timeout=self.timeout, **kw)
            except httpx.HTTPError as e:
                raise GalatAI(f"Tidak bisa terhubung ke {base}: {e}") from e
            if r.status_code != 404:
                return r
            terakhir = r
        return terakhir  # type: ignore[return-value]

    def chat(self, pesan: list[dict], suhu: float = 0.1, maks_token: int = 8000) -> str:
        """`maks_token` sengaja longgar: model "reasoning" memakai sebagian token untuk berpikir sebelum menjawab."""
        if not self.aktif:
            raise GalatAI("AI belum diatur. Isi Base URL dan model di halaman Pengaturan.")
        r = self._kirim("POST", "/chat/completions", json={
            "model": self.model, "messages": pesan, "temperature": suhu, "max_tokens": maks_token,
            "stream": False,  # beberapa router (mis. 9router) streaming secara bawaan
        })
        if r.status_code >= 400:
            raise GalatAI(f"AI menolak permintaan (HTTP {r.status_code}): {r.text[:300]}")
        isi, alasan = _baca_balasan(r)
        if not isi.strip():
            if alasan in ("length", "max_tokens"):
                raise GalatAI(f"Model {self.model} kehabisan token sebelum sempat menjawab (biasanya model reasoning). "
                              "Coba model lain atau varian yang lebih ringan.")
            raise GalatAI(f"Model {self.model} mengembalikan jawaban kosong (finish_reason: {alasan}).")
        return isi

    def daftar_model(self) -> list[str]:
        r = self._kirim("GET", "/models")
        if r.status_code >= 400:
            raise GalatAI(f"Gagal mengambil daftar model (HTTP {r.status_code}): {r.text[:200]}")
        try:
            return sorted(m["id"] for m in r.json().get("data", []) if m.get("id"))
        except (ValueError, AttributeError) as e:
            raise GalatAI("Daftar model tidak dikenali.") from e


def _baca_balasan(r: httpx.Response) -> tuple[str, str | None]:
    """(isi, finish_reason) dari balasan JSON biasa MAUPUN streaming SSE ("data: {...}")."""
    teks = r.text
    if "text/event-stream" in r.headers.get("content-type", "") or teks.lstrip().startswith("data:"):
        potongan, alasan = [], None
        for baris in teks.splitlines():
            baris = baris.strip()
            if not baris.startswith("data:"):
                continue
            muatan = baris[5:].strip()
            if muatan == "[DONE]":
                break
            try:
                pilihan = json.loads(muatan)["choices"][0]
            except (ValueError, KeyError, IndexError, TypeError):
                continue
            potongan.append((pilihan.get("delta") or pilihan.get("message") or {}).get("content") or "")
            alasan = pilihan.get("finish_reason") or alasan
        return "".join(potongan), alasan
    try:
        pilihan = r.json()["choices"][0]
        return pilihan["message"].get("content") or "", pilihan.get("finish_reason")
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise GalatAI(f"Balasan AI tidak dikenali: {teks[:300]}") from e


def ambil_json(teks: str) -> dict:
    """Ambil objek JSON dari balasan model (toleran terhadap ```json ... ``` dan teks pembuka)."""
    t = teks.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", t, re.S)
    if m:
        t = m.group(1).strip()
    awal, akhir = t.find("{"), t.rfind("}")
    if awal < 0 or akhir <= awal:
        raise GalatAI("AI tidak mengembalikan JSON.")
    potong = t[awal: akhir + 1]
    for calon in (potong, re.sub(r",\s*([}\]])", r"\1", potong)):
        try:
            return json.loads(calon)
        except json.JSONDecodeError:
            continue
    raise GalatAI("JSON dari AI rusak dan tidak bisa dibaca.")
