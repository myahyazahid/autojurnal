import { useEffect, useState } from "react";

type Ukuran = "kecil" | "sedang" | "besar";
const LEBAR: Record<Ukuran, string> = { kecil: "w-24", sedang: "w-36", besar: "w-48" };

/** Ilustrasi pemeriksa membaca naskah: kaca pembesar menyusuri baris, kesalahan ditandai, komentar muncul di margin. */
export function AnimasiBaca({ ukuran = "sedang" }: { ukuran?: Ukuran }) {
  const baris = [92, 84, 92, 70, 92, 88, 60, 80];
  return (
    <svg viewBox="0 0 220 170" className={`baca ${LEBAR[ukuran]} h-auto shrink-0`} aria-hidden>
      {/* lembar naskah dengan sudut terlipat */}
      <path d="M44 14h100l20 20v130a4 4 0 0 1-4 4H44a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" className="baca-bayang" transform="translate(3 3)" />
      <path d="M44 10h100l20 20v130a4 4 0 0 1-4 4H44a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" className="baca-kertas" />
      <path d="M144 10v16a4 4 0 0 0 4 4h16" className="baca-lipat" />
      <rect x="54" y="26" width="58" height="6" rx="3" className="baca-judul" />

      {/* sorotan baris yang sedang dibaca */}
      <rect x="51" y="55" width="98" height="10" rx="3" className="baca-sorot baca-sorot-1" />
      <rect x="51" y="79" width="76" height="10" rx="3" className="baca-sorot baca-sorot-2" />
      <rect x="51" y="103" width="98" height="10" rx="3" className="baca-sorot baca-sorot-3" />

      {baris.map((w, i) => (
        <rect key={i} x="54" y={46 + i * 12} width={w} height="4" rx="2" className="baca-baris" />
      ))}

      {/* kesalahan yang ditemukan: garis bergelombang ala Word */}
      <path d="M84 91q3-3 6 0t6 0t6 0t6 0t6 0t6 0t6 0" className="baca-gelombang" />

      {/* komentar di margin */}
      <g className="baca-balon baca-balon-1">
        <path d="M171 70h26a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-18l-6 5v-5h-2a4 4 0 0 1-4-4V74a4 4 0 0 1 4-4z" className="baca-balon-isi" />
        <rect x="173" y="75" width="20" height="2.5" rx="1.25" className="baca-balon-teks" />
        <rect x="173" y="81" width="13" height="2.5" rx="1.25" className="baca-balon-teks" />
      </g>
      <g className="baca-balon baca-balon-2">
        <path d="M171 96h26a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-18l-6 5v-5h-2a4 4 0 0 1-4-4v-10a4 4 0 0 1 4-4z" className="baca-balon-isi" />
        <rect x="173" y="101" width="20" height="2.5" rx="1.25" className="baca-balon-teks" />
        <rect x="173" y="107" width="13" height="2.5" rx="1.25" className="baca-balon-teks" />
      </g>

      {/* selesai */}
      <g className="baca-centang">
        <circle cx="150" cy="148" r="13" className="baca-centang-bulat" />
        <path d="M144 148l4.5 4.5 8-9" className="baca-centang-garis" />
      </g>

      {/* kaca pembesar */}
      <g className="baca-lensa">
        <line x1="9" y1="9" x2="21" y2="21" className="baca-lensa-gagang" />
        <circle r="12" className="baca-lensa-kaca" />
      </g>
    </svg>
  );
}

const reduksi = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Status memuat dengan animasi membaca naskah. `langkah` (opsional) ditampilkan bergantian di bawah judul. */
export default function Membaca({ judul, sub, langkah, ukuran = "sedang", mendatar, className = "" }: {
  judul: string; sub?: string; langkah?: string[]; ukuran?: Ukuran; mendatar?: boolean; className?: string;
}) {
  const [ke, setKe] = useState(0);
  useEffect(() => {
    if (!langkah || langkah.length < 2 || reduksi()) return;
    const t = window.setInterval(() => setKe((k) => (k + 1) % langkah.length), 2400);
    return () => window.clearInterval(t);
  }, [langkah]);
  return (
    <div role="status" className={`flex items-center ${mendatar ? "gap-5 text-left" : "flex-col gap-4 text-center"} ${className}`}>
      <AnimasiBaca ukuran={ukuran} />
      <div className="min-w-0">
        <div className={`font-semibold text-ink ${ukuran === "kecil" ? "text-sm" : "text-[15px]"}`}>{judul}</div>
        {sub && <div className="mt-1 text-sm text-ink-2">{sub}</div>}
        {langkah && langkah.length > 0 && (
          <div key={ke} className="baca-langkah mt-2 text-xs font-medium text-brand-tinta" aria-hidden>
            {langkah[ke]}
          </div>
        )}
      </div>
    </div>
  );
}
