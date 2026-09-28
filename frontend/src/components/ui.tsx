import { ArrowLeft, CircleCheck, Info, LoaderCircle, OctagonAlert, ShieldCheck, ShieldX, TriangleAlert, Upload, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Membaca from "./Membaca";

type Varian = "utama" | "biasa" | "bahaya" | "hantu" | "lembut";

const gayaTombol: Record<Varian, string> = {
  utama: "bg-brand text-white shadow-[0_1px_2px_rgba(15,23,41,0.12)] hover:bg-brand-2 disabled:opacity-50",
  biasa: "border border-line-2 bg-panel text-ink shadow-[0_1px_2px_rgba(15,23,41,0.05)] hover:bg-panel-2 hover:border-isian disabled:opacity-50",
  bahaya: "border border-line-2 bg-panel text-bahaya hover:border-bahaya/40 hover:bg-bahaya-soft disabled:opacity-50",
  hantu: "text-ink-2 hover:bg-panel-3 hover:text-ink disabled:opacity-40",
  lembut: "bg-brand-soft text-brand-tinta hover:bg-brand-garis/60 disabled:opacity-50",
};

const ukuranTombol = {
  kecil: "h-8 px-2.5 text-xs gap-1.5 rounded-md",
  sedang: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  besar: "h-11 px-5 text-[15px] gap-2 rounded-lg",
};

const dasarTombol = "ketuk inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed";

export function Tombol({
  varian = "biasa",
  ukuran = "sedang",
  ikon: Ikon,
  className = "",
  memuat,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { varian?: Varian; ukuran?: keyof typeof ukuranTombol; ikon?: LucideIcon; memuat?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || memuat}
      aria-busy={memuat || undefined}
      className={`${dasarTombol} ${ukuranTombol[ukuran]} ${gayaTombol[varian]} ${className}`}
    >
      {memuat ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : Ikon ? <Ikon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** Tombol yang sebenarnya tautan: `href` untuk unduhan/API, `ke` untuk halaman di aplikasi. */
export function TautanTombol({ href, ke, children, varian = "biasa", ukuran = "sedang", ikon: Ikon, className = "", ...aria }: {
  href?: string; ke?: string; children?: ReactNode; varian?: Varian; ukuran?: keyof typeof ukuranTombol; ikon?: LucideIcon; className?: string;
  "aria-label"?: string; title?: string;
}) {
  const kelas = `${dasarTombol} ${ukuranTombol[ukuran]} ${gayaTombol[varian]} ${className}`;
  const isi = (
    <>
      {Ikon && <Ikon className="h-4 w-4 shrink-0" aria-hidden />}
      {children}
    </>
  );
  return ke ? <Link to={ke} className={kelas} {...aria}>{isi}</Link> : <a href={href} className={kelas} {...aria}>{isi}</a>;
}

export function Putar({ besar, className = "" }: { besar?: boolean; className?: string }) {
  return <LoaderCircle className={`animate-spin text-brand ${besar ? "h-6 w-6" : "h-4 w-4"} ${className}`} aria-hidden />;
}

export function MemuatHalaman({ teks = "Memuat…" }: { teks?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Membaca judul={teks} />
    </div>
  );
}

export function Kartu({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" }) {
  return <Tag className={`kartu ${className}`}>{children}</Tag>;
}

/** Kepala kartu: judul kecil + keterangan + aksi di kanan, dipisah garis dari isi. */
export function KepalaKartu({ judul, sub, aksi, id }: { judul: ReactNode; sub?: ReactNode; aksi?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold text-ink">{judul}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-ink-2">{sub}</p>}
      </div>
      {aksi && <div className="flex shrink-0 flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}

/** Satu bagian halaman pengaturan: judul & penjelasan di kiri, isian di dalam kartu di kanan, tombol di kaki kartu. */
export function BagianPengaturan({ judul, sub, children, kaki, id }: { judul: string; sub?: ReactNode; children: ReactNode; kaki?: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-b border-line py-8 first-of-type:pt-0 last-of-type:border-b-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 id={id} className="text-[15px] font-semibold text-ink">{judul}</h2>
        {sub && <div className="mt-1 text-sm leading-relaxed text-ink-2">{sub}</div>}
      </div>
      <div className="kartu min-w-0 overflow-hidden">
        <div className="space-y-5 p-5 sm:p-6">{children}</div>
        {kaki && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-panel-2 px-5 py-3 sm:px-6">{kaki}</div>}
      </div>
    </section>
  );
}

export function JudulHalaman({ judul, sub, aksi, kembali }: { judul: ReactNode; sub?: ReactNode; aksi?: ReactNode; kembali?: { ke: string; label: string } }) {
  return (
    <div className="mb-6 sm:mb-8">
      {kembali && (
        <Link to={kembali.ke} className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {kembali.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-ink sm:text-[28px]">{judul}</h1>
          {sub && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-2">{sub}</p>}
        </div>
        {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
      </div>
    </div>
  );
}

/* Warna lencana hanya untuk status nyata: wajib (merah), saran (kuning), siap (hijau). */
const gayaLencana = {
  wajib: "bg-bahaya-soft text-bahaya",
  saran: "bg-waspada-soft text-waspada",
  ai: "bg-brand-soft text-brand-tinta",
  netral: "bg-panel-3 text-ink-2",
  sukses: "bg-ok-soft text-ok",
  info: "bg-panel-3 text-ink",
};

export function Lencana({ jenis = "netral", children, ikon: Ikon }: { jenis?: keyof typeof gayaLencana; children: ReactNode; ikon?: LucideIcon }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap ${gayaLencana[jenis]}`}>
      {Ikon && <Ikon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

/** Lencana putusan scope: isi warna penuh agar langsung terlihat di daftar. Warna tetap di kedua tema (teks putih ≥5.6:1). */
export function LencanaScope({ keputusan, besar }: { keputusan?: "terima" | "tolak"; besar?: boolean }) {
  if (!keputusan) return null;
  const sesuai = keputusan === "terima";
  const Ikon = sesuai ? ShieldCheck : ShieldX;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap text-white ${
      besar ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[11px]"} ${sesuai ? "bg-[#157347]" : "bg-[#c22e3a]"}`}>
      <Ikon className={besar ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden />
      {sesuai ? "Sesuai scope" : "Tidak sesuai scope"}
    </span>
  );
}

const gayaPesan = {
  info: { k: "border-line bg-panel-2", i: Info, w: "text-ink-2" },
  peringatan: { k: "border-waspada/25 bg-waspada-soft", i: TriangleAlert, w: "text-waspada" },
  galat: { k: "border-bahaya/25 bg-bahaya-soft", i: OctagonAlert, w: "text-bahaya" },
  sukses: { k: "border-ok/25 bg-ok-soft", i: CircleCheck, w: "text-ok" },
};

export function Pesan({ jenis = "info", judul, children, aksi }: { jenis?: keyof typeof gayaPesan; judul?: ReactNode; children?: ReactNode; aksi?: ReactNode }) {
  const g = gayaPesan[jenis];
  const Ikon = g.i;
  return (
    <div role={jenis === "galat" ? "alert" : "status"} className={`flex gap-3 rounded-lg border px-4 py-3 text-sm text-ink ${g.k}`}>
      <Ikon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${g.w}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {judul && <div className="font-semibold">{judul}</div>}
        {children && <div className={`${judul ? "mt-1" : ""} break-words text-ink-2`}>{children}</div>}
        {aksi && <div className="mt-2.5">{aksi}</div>}
      </div>
    </div>
  );
}

export function Sakelar({ nyala, ubah, label, keterangan, nonaktif, labelAria }: {
  nyala: boolean; ubah: (v: boolean) => void; label: ReactNode; keterangan?: ReactNode; nonaktif?: boolean; labelAria?: string;
}) {
  const id = useId();
  return (
    <div className={`flex items-start gap-3 ${nonaktif ? "opacity-60" : ""}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={nyala}
        aria-label={labelAria}
        aria-describedby={keterangan ? `${id}-ket` : undefined}
        disabled={nonaktif}
        onClick={() => ubah(!nyala)}
        className={`relative mt-px inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors before:absolute before:-inset-3 before:content-[''] disabled:cursor-not-allowed ${nyala ? "bg-brand" : "bg-isian"}`}
      >
        <span className={`absolute h-4 w-4 rounded-full bg-white shadow-sm transition-[left] ${nyala ? "left-[18px]" : "left-0.5"}`} />
      </button>
      {(label || keterangan) && (
        <span className="min-w-0">
          {label && <label htmlFor={id} className={`block text-sm font-semibold text-ink ${nonaktif ? "cursor-not-allowed" : "cursor-pointer"}`}>{label}</label>}
          {keterangan && <span id={`${id}-ket`} className="mt-0.5 block text-[13px] text-ink-2">{keterangan}</span>}
        </span>
      )}
    </div>
  );
}

export function Kosong({ judul, sub, aksi, ikon: Ikon, ringkas }: { judul: string; sub?: ReactNode; aksi?: ReactNode; ikon?: LucideIcon; ringkas?: boolean }) {
  return (
    <div className={`kartu flex flex-col items-center px-6 text-center ${ringkas ? "py-10" : "py-14"}`}>
      {Ikon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-tinta">
          <Ikon className="h-6 w-6" aria-hidden />
        </span>
      )}
      <div className="text-base font-semibold text-ink">{judul}</div>
      {sub && <div className="mt-1.5 max-w-md text-sm text-ink-2">{sub}</div>}
      {aksi && <div className="mt-5 flex flex-wrap justify-center gap-2">{aksi}</div>}
    </div>
  );
}

export function ZonaUnggah({ ganda, terima = ".docx", pilih, label, sub, ringkas, className = "" }: {
  ganda?: boolean; terima?: string; pilih: (f: File[]) => void; label: string; sub?: string; ringkas?: boolean; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [seret, setSeret] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}. ${sub ?? ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ref.current?.click();
        }
      }}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setSeret(true);
      }}
      onDragLeave={() => setSeret(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSeret(false);
        const f = Array.from(e.dataTransfer.files);
        if (f.length) pilih(ganda ? f : f.slice(0, 1));
      }}
      className={`group flex cursor-pointer items-center rounded-xl border-2 border-dashed transition-colors ${
        ringkas ? "gap-3 px-4 py-3.5 text-left" : "flex-col justify-center px-6 py-10 text-center sm:py-12"
      } ${seret ? "border-brand bg-brand-soft" : "border-line-2 bg-panel-2 hover:border-brand/60 hover:bg-brand-soft/60"} ${className}`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-tinta ring-1 ring-brand-garis ${ringkas ? "h-9 w-9" : "mb-4 h-12 w-12"}`}>
        <Upload className={ringkas ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold text-ink ${ringkas ? "text-sm" : "text-base"}`}>{label}</span>
        {sub && <span className={`block text-ink-2 ${ringkas ? "text-xs" : "mt-1 text-sm"}`}>{sub}</span>}
      </span>
      {!ringkas && (
        <span className="mt-5 inline-flex h-9 items-center rounded-lg border border-line-2 bg-panel px-3.5 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,41,0.05)] group-hover:border-isian">
          Pilih berkas
        </span>
      )}
      <input
        ref={ref}
        type="file"
        accept={terima}
        multiple={ganda}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          if (f.length) pilih(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Motif berkas: lembar dengan sudut terlipat, bentuk yang sama dengan logo. Dipakai di setiap tempat yang menampilkan berkas. */
export function IkonBerkas({ ukuran = 32, redup }: { ukuran?: number; redup?: boolean }) {
  return (
    <svg viewBox="0 0 32 40" style={{ width: ukuran * 0.8, height: ukuran }} className="shrink-0" aria-hidden>
      <path d="M4 1.5h16.5L30.5 11.5V37a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 37V3A1.5 1.5 0 0 1 4 1.5z"
        fill={redup ? "var(--c-panel-3)" : "var(--c-brand-soft)"} stroke={redup ? "var(--c-line-2)" : "var(--c-brand-garis)"} strokeWidth="1.5" />
      <path d="M20.5 1.5V10a1.5 1.5 0 0 0 1.5 1.5h8.5" fill="none" stroke={redup ? "var(--c-line-2)" : "var(--c-brand-garis)"} strokeWidth="1.5" />
      <rect x="7" y="19" width="16" height="2.2" rx="1.1" fill={redup ? "var(--c-line-2)" : "var(--c-grafik)"} opacity={redup ? 1 : 0.55} />
      <rect x="7" y="24.5" width="12" height="2.2" rx="1.1" fill={redup ? "var(--c-line-2)" : "var(--c-grafik)"} opacity={redup ? 1 : 0.35} />
      <rect x="7" y="30" width="14" height="2.2" rx="1.1" fill={redup ? "var(--c-line-2)" : "var(--c-grafik)"} opacity={redup ? 1 : 0.35} />
    </svg>
  );
}

/** Deretan angka ringkas dalam satu kartu, dipisah garis tipis. Angka nyata dari API, bukan hiasan. */
export function StripAngka({ butir, className = "" }: { butir: { label: string; nilai: ReactNode; ket?: ReactNode; aksen?: "bahaya" }[]; className?: string }) {
  return (
    <dl className={`kartu grid grid-cols-2 overflow-hidden sm:grid-cols-4 ${className}`}>
      {butir.map((b, i) => (
        <div key={b.label} className={`px-5 py-4 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
          <dt className="text-[13px] font-medium text-ink-2">{b.label}</dt>
          <dd className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${b.aksen === "bahaya" ? "text-bahaya" : "text-ink"}`}>{b.nilai}</dd>
          {b.ket && <dd className="mt-0.5 text-xs text-ink-3">{b.ket}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ nama, foto, ukuran = 36 }: { nama: string; foto?: string; ukuran?: number }) {
  const [gagal, setGagal] = useState(false);
  const inisial = nama.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  if (foto && !gagal) {
    return (
      <img src={foto} alt="" referrerPolicy="no-referrer" onError={() => setGagal(true)}
        className="shrink-0 rounded-full object-cover" style={{ width: ukuran, height: ukuran }} />
    );
  }
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-tinta"
      style={{ width: ukuran, height: ukuran, fontSize: ukuran * 0.38 }}>
      {inisial}
    </span>
  );
}

export function Kerangka({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`kilau rounded-lg ${className}`} />;
}

export function LogoGoogle({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Logo yang sudah ada (dokumen + centang), diwarnai biru. Warna tetap di kedua tema. */
export function LogoAutoJurnal({ ukuran = 36 }: { ukuran?: number }) {
  return (
    <svg viewBox="0 0 32 32" style={{ width: ukuran, height: ukuran }} className="shrink-0" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2456d3" />
      <path d="M11 6.5h8.5l4.5 4.5v13.5a1.5 1.5 0 0 1-1.5 1.5H11a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 11 6.5z" fill="#fff" />
      <path d="M19.5 6.5V11H24" fill="#dbe5ff" />
      <path d="M12.8 17.4l2.8 2.8 5.4-5.9" stroke="#2456d3" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
