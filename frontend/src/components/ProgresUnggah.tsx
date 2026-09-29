import { useEffect, useRef, useState } from "react";
import type { Progres } from "../lib/api";

function ukuran(b: number): string {
  return b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(b / 1024)).toLocaleString("id-ID")} KB`;
}

function durasi(detik: number): string {
  if (detik < 60) return `${Math.max(1, Math.round(detik))} dtk`;
  const m = Math.floor(detik / 60);
  const s = Math.round(detik % 60);
  return s ? `${m} mnt ${s} dtk` : `${m} mnt`;
}

/** Kecepatan unggah (byte/detik) dengan rata-rata bergerak supaya angkanya tidak meloncat. */
function useKecepatan(p: Progres | null): number | null {
  const lalu = useRef<{ t: number; b: number } | null>(null);
  const [cepat, setCepat] = useState<number | null>(null);
  useEffect(() => {
    if (!p || p.tahap !== "unggah") return;
    const kini = { t: performance.now(), b: p.terkirim };
    const l = lalu.current;
    if (!l || kini.b < l.b) {
      lalu.current = kini;
      return;
    }
    const dt = (kini.t - l.t) / 1000;
    if (dt < 0.4) return;
    const v = (kini.b - l.b) / dt;
    setCepat((c) => (c === null ? v : c * 0.7 + v * 0.3));
    lalu.current = kini;
  }, [p]);
  return cepat;
}

/** Bilah progres dua tahap: persen unggah (dengan kecepatan & sisa waktu), lalu pemrosesan di server. */
export default function ProgresUnggah({ progres, ringkas, labelProses = "Memproses di server" }: {
  progres: Progres | null; ringkas?: boolean; labelProses?: string;
}) {
  const cepat = useKecepatan(progres);
  const p = progres ?? { tahap: "unggah" as const, terkirim: 0, total: 0 };
  const persen = p.total ? Math.min(100, Math.floor((p.terkirim * 100) / p.total)) : 0;
  const proses = p.tahap === "proses";
  const sisa = cepat && cepat > 0 ? (p.total - p.terkirim) / cepat : null;
  const rincian = proses
    ? `Terkirim ${ukuran(p.total)}. Menunggu hasil dari server.`
    : p.total
      ? [`${ukuran(p.terkirim)} dari ${ukuran(p.total)}`, cepat ? `${ukuran(cepat)}/dtk` : null, sisa !== null ? `sisa ±${durasi(sisa)}` : null]
          .filter(Boolean)
          .join(" · ")
      : "Menyiapkan unggahan…";

  return (
    <div className={ringkas ? "w-full" : "mx-auto w-full max-w-md"}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-semibold ${proses ? "text-brand-tinta" : "text-ink"} ${ringkas ? "text-xs" : "text-sm"}`}>
          {proses ? labelProses : "Mengunggah"}
        </span>
        {!proses && <span className={`font-bold text-ink tabular-nums ${ringkas ? "text-xs" : "text-sm"}`}>{persen}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={proses ? labelProses : "Mengunggah berkas"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={proses ? undefined : persen}
        aria-valuetext={proses ? labelProses : `${persen}%`}
        className={`progres-jalur relative mt-1.5 overflow-hidden rounded-full bg-panel-3 ${ringkas ? "h-1.5" : "h-2.5"}`}
      >
        {proses ? (
          <span className="progres-proses absolute inset-y-0 left-0 w-2/5 rounded-full bg-brand" />
        ) : (
          <span className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${persen}%` }} />
        )}
      </div>
      <div className={`mt-1.5 text-ink-2 tabular-nums ${ringkas ? "text-[11px]" : "text-xs"}`}>{rincian}</div>
    </div>
  );
}
