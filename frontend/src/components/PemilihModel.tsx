import { Check, ChevronDown, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Putar } from "./ui";

/** Dropdown model AI: daftar dari endpoint /models, dikelompokkan per awalan (mis. "ag/", "kr/"), bisa dicari. */
export default function PemilihModel({ nilai, ubah, daftar, memuat, galat, muatUlang, labelId }: {
  nilai: string;
  ubah: (m: string) => void;
  daftar: string[];
  memuat: boolean;
  galat: string;
  muatUlang: () => void;
  labelId?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const pemicu = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!buka) return;
    const klik = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setBuka(false);
    document.addEventListener("mousedown", klik);
    return () => document.removeEventListener("mousedown", klik);
  }, [buka]);

  const grup = useMemo(() => {
    const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
    const g = new Map<string, string[]>();
    for (const id of daftar) {
      if (kata.length && !kata.every((k) => id.toLowerCase().includes(k))) continue;
      const kunci = id.includes("/") ? id.split("/")[0] : "lainnya";
      g.set(kunci, [...(g.get(kunci) ?? []), id]);
    }
    return [...g.entries()];
  }, [daftar, cari]);
  const jumlah = grup.reduce((a, [, v]) => a + v.length, 0);

  function tutup() {
    setBuka(false);
    pemicu.current?.focus();
  }

  function pilih(m: string) {
    ubah(m);
    setCari("");
    tutup();
  }

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && buka) {
          e.stopPropagation();
          tutup();
        }
      }}
    >
      <button
        ref={pemicu}
        type="button"
        onClick={() => setBuka(!buka)}
        aria-expanded={buka}
        aria-labelledby={labelId ? `${labelId} ${labelId}-nilai` : undefined}
        className="input ketuk flex items-center gap-2 text-left"
      >
        <span id={labelId ? `${labelId}-nilai` : undefined} className={`min-w-0 flex-1 truncate ${nilai ? "font-semibold text-ink" : "text-ink-3"}`}>{nilai || "Pilih model…"}</span>
        {memuat ? <Putar /> : <ChevronDown className={`h-4 w-4 shrink-0 text-ink-2 transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden />}
      </button>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-2">
        <span className="min-w-0">{galat ? <span className="text-bahaya">{galat}</span> : daftar.length ? `${daftar.length} model tersedia` : "Isi Base URL & API key, lalu muat daftar model."}</span>
        <button type="button" onClick={muatUlang} className="ketuk inline-flex shrink-0 items-center gap-1 font-semibold text-brand-tinta underline-offset-2 hover:underline">
          <RefreshCw className={`h-3 w-3 ${memuat ? "animate-spin" : ""}`} aria-hidden /> Muat ulang
        </button>
      </div>

      {buka && (
        <div className="melayang absolute inset-x-0 top-11 z-30 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
            <input
              autoFocus
              value={cari}
              aria-label="Cari model"
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const pertama = grup[0]?.[1][0];
                  pilih(pertama ?? cari.trim());
                }
              }}
              placeholder="Cari model (mis. gemini flash, claude)"
              className="w-full rounded-sm bg-transparent py-1 text-sm placeholder:text-ink-3 focus-visible:outline-offset-1"
            />
            {cari && <span className="shrink-0 text-xs text-ink-2">{jumlah}</span>}
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {memuat && !daftar.length ? (
              <div role="status" className="flex items-center gap-2 px-3 py-6 text-sm text-ink-2"><Putar /> Mengambil daftar model…</div>
            ) : galat && !daftar.length ? (
              <div className="px-3 py-6 text-sm text-bahaya">{galat}</div>
            ) : jumlah === 0 ? (
              <div className="px-3 py-6 text-sm text-ink-2">
                {cari ? <>Tidak ada yang cocok. Tekan <b>Enter</b> untuk memakai “{cari}”.</> : "Daftar model kosong. Tekan Muat ulang setelah Base URL terisi."}
              </div>
            ) : (
              grup.map(([kunci, ids]) => (
                <div key={kunci} className="mb-1" role="group" aria-label={kunci}>
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-panel px-2.5 pt-2 pb-1 text-xs font-semibold text-ink-2">
                    {kunci} <span className="font-normal">({ids.length})</span>
                  </div>
                  {ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pilih(id)}
                      aria-pressed={id === nilai}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        id === nilai ? "bg-brand-soft font-semibold text-brand-tinta" : "text-ink hover:bg-panel-2"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{kunci === "lainnya" ? id : id.slice(kunci.length + 1)}</span>
                      {id === nilai && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-line bg-panel-2 px-3 py-2 text-xs text-ink-2">
            Model <b className="text-ink">flash</b>/ringan lebih cepat dan hemat. Model <b className="text-ink">pro</b>/<b className="text-ink">thinking</b> lebih teliti tapi lebih lambat.
          </div>
        </div>
      )}
    </div>
  );
}
