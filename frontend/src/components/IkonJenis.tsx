export type JenisBerkas = "pdf" | "word" | "excel" | "gambar";

/* Warna mengikuti konvensi yang sudah dikenal pengguna untuk tiap jenis berkas; teks putih di atasnya >= 5:1. */
export const WARNA_JENIS: Record<JenisBerkas, string> = {
  pdf: "#c42b2b",
  word: "#2b579a",
  excel: "#1d6f42",
  gambar: "#6d3fd6",
};
const LABEL: Record<JenisBerkas, string> = { pdf: "PDF", word: "DOC", excel: "XLS", gambar: "IMG" };

/** Lembar terlipat (bentuk yang sama dengan logo) dengan pita warna jenis berkas. */
export default function IkonJenis({ jenis, ukuran = 40 }: { jenis: JenisBerkas; ukuran?: number }) {
  const warna = WARNA_JENIS[jenis];
  const tipis = `color-mix(in oklab, ${warna} 9%, var(--c-panel))`;
  const garis = `color-mix(in oklab, ${warna} 38%, var(--c-panel))`;
  return (
    <svg viewBox="0 0 34 40" style={{ width: ukuran * 0.85, height: ukuran }} className="shrink-0" aria-hidden>
      <path d="M5 1.5h17.5L31.5 10.5V37a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 37V3A1.5 1.5 0 0 1 5 1.5z" fill={tipis} stroke={garis} strokeWidth="1.5" />
      <path d="M22.5 1.5V9a1.5 1.5 0 0 0 1.5 1.5h7.5" fill="none" stroke={garis} strokeWidth="1.5" />
      {jenis === "gambar" ? (
        <g fill={warna} opacity="0.55">
          <circle cx="13" cy="14" r="2.4" />
          <path d="M8 22l5-5 3.5 3.5 3.5-4 6 5.5z" />
        </g>
      ) : jenis === "excel" ? (
        <g stroke={warna} strokeWidth="1.3" fill="none" opacity="0.55">
          <rect x="8" y="12" width="17" height="10" rx="1" />
          <path d="M8 17h17M13.7 12v10M19.3 12v10" />
        </g>
      ) : (
        <g fill={warna} opacity="0.5">
          <rect x="8" y="12" width="15" height="2" rx="1" />
          <rect x="8" y="16.5" width="18" height="2" rx="1" />
          <rect x="8" y="21" width="12" height="2" rx="1" />
        </g>
      )}
      <rect x="0.5" y="26" width="26" height="10" rx="2.5" fill={warna} />
      <text x="13.5" y="33.6" textAnchor="middle" fontSize="7.4" fontWeight="800" fill="#fff" fontFamily="inherit" letterSpacing="0.3">
        {LABEL[jenis]}
      </text>
    </svg>
  );
}
