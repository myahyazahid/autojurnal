import { Check, ChevronDown, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Putar } from "./ui";

/** Dropdown model AI: daftar dari endpoint /models, dikelompokkan per awalan (mis. "ag/", "kr/"), bisa dicari. */
export default function PemilihModel({ nilai, ubah, daftar, memuat, galat, muatUlang }: {
  nilai: string;
  ubah: (m: string) => void;
  daftar: string[];
  memuat: boolean;
  galat: string;
  muatUlang: () => void;
}) {
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const klik = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setBuka(false);
    document.addEventListener("mousedown", klik);
    return () => document.removeEventListener("mousedown", klik);
  }, []);

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

  function pilih(m: string) {
    ubah(m);
    setBuka(false);
    setCari("");
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setBuka(!buka)} className="input flex items-center gap-2 text-left">
        <span className={`min-w-0 flex-1 truncate ${nilai ? "font-semibold text-ink" : "text-ink-3"}`}>{nilai || "Pilih model…"}</span>
        {memuat ? <Putar /> : <ChevronDown className={`h-4 w-4 shrink-0 text-ink-3 transition ${buka ? "rotate-180" : ""}`} />}
      </button>
      <div className="mt-1.5 flex items-center justify-between text-xs text-ink-3">
        <span>{galat ? <span className="text-rose-500">{galat}</span> : daftar.length ? `${daftar.length} model tersedia` : "Isi Base URL & API key, lalu muat daftar model."}</span>
        <button type="button" onClick={muatUlang} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
          <RefreshCw className={`h-3 w-3 ${memuat ? "animate-spin" : ""}`} /> Muat ulang
        </button>
      </div>

      {buka && (
        <div className="kartu animasi-muncul absolute inset-x-0 top-12 z-30 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search className="h-4 w-4 text-ink-3" />
            <input
              autoFocus
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const pertama = grup[0]?.[1][0];
                  pilih(pertama ?? cari.trim());
                }
                if (e.key === "Escape") setBuka(false);
              }}
              placeholder="Cari model… (mis. gemini flash, claude, deepseek)"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
            />
            {cari && <span className="shrink-0 text-[11px] text-ink-3">{jumlah}</span>}
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {memuat && !daftar.length ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-ink-2"><Putar /> Mengambil daftar model…</div>
            ) : galat && !daftar.length ? (
              <div className="px-3 py-6 text-sm text-rose-500">{galat}</div>
            ) : jumlah === 0 ? (
              <div className="px-3 py-6 text-sm text-ink-3">
                {cari ? <>Tidak ada yang cocok. Tekan <b>Enter</b> untuk memakai “{cari}”.</> : "Daftar model kosong."}
              </div>
            ) : (
              grup.map(([kunci, ids]) => (
                <div key={kunci} className="mb-1">
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-panel px-2.5 pt-2 pb-1 text-[10px] font-bold tracking-[0.12em] text-ink-3 uppercase">
                    {kunci} <span className="rounded bg-panel-3 px-1.5 font-semibold tracking-normal">{ids.length}</span>
                  </div>
                  {ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pilih(id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                        id === nilai ? "bg-brand-soft font-semibold text-brand" : "text-ink hover:bg-panel-2"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{kunci === "lainnya" ? id : id.slice(kunci.length + 1)}</span>
                      {id === nilai && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-line bg-panel-2 px-3 py-2 text-[11px] text-ink-3">
            Tip: model <b>flash</b>/ringan lebih cepat & hemat; model <b>pro</b>/<b>thinking</b> lebih teliti tapi lebih lambat.
          </div>
        </div>
      )}
    </div>
  );
}
