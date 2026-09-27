import { CircleCheck, FileUp, Info, LoaderCircle, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Varian = "utama" | "biasa" | "bahaya" | "hantu" | "lembut";

const gayaTombol: Record<Varian, string> = {
  utama: "bg-brand-kuat text-white hover:bg-brand-kuat-2 disabled:opacity-50",
  biasa: "border border-line-2 bg-panel text-ink hover:border-isian hover:bg-panel-2 disabled:opacity-50",
  bahaya: "border border-brand-garis bg-panel text-brand-tinta hover:bg-brand-soft disabled:opacity-50",
  hantu: "text-ink-2 hover:bg-panel-3 hover:text-ink disabled:opacity-40",
  lembut: "bg-brand-soft text-brand-tinta hover:bg-brand-garis/70 disabled:opacity-50",
};

const ukuranTombol = {
  kecil: "h-8 px-3 text-xs gap-1.5 rounded-md",
  sedang: "h-10 px-4 text-sm gap-2 rounded-lg",
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
      {memuat ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : Ikon ? <Ikon className="h-4 w-4" aria-hidden /> : null}
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
      {Ikon && <Ikon className="h-4 w-4" aria-hidden />}
      {children}
    </>
  );
  return ke ? <Link to={ke} className={kelas} {...aria}>{isi}</Link> : <a href={href} className={kelas} {...aria}>{isi}</a>;
}

export function Putar({ besar, className = "" }: { besar?: boolean; className?: string }) {
  return <LoaderCircle className={`animate-spin text-brand-kuat ${besar ? "h-6 w-6" : "h-4 w-4"} ${className}`} aria-hidden />;
}

export function MemuatHalaman({ teks = "Memuat…" }: { teks?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-ink-2">
      <Putar besar />
      {teks}
    </div>
  );
}

export function Kartu({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`kartu ${className}`}>{children}</div>;
}

export function JudulHalaman({ judul, sub, aksi, kecil }: { judul: ReactNode; sub?: ReactNode; aksi?: ReactNode; kecil?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {kecil && <div className="mb-2 text-sm font-semibold text-ink-2">{kecil}</div>}
        <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[32px]">{judul}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{sub}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}

/* Warna lencana hanya untuk status yang nyata: wajib (tinta merah), saran (kuning), siap (hijau). */
const gayaLencana = {
  wajib: "bg-brand-soft text-brand-tinta",
  saran: "bg-waspada-soft text-waspada",
  ai: "bg-panel text-ink ring-1 ring-inset ring-isian",
  netral: "bg-panel-3 text-ink-2",
  sukses: "bg-ok-soft text-ok",
  info: "bg-panel-3 text-ink",
};

export function Lencana({ jenis = "netral", children, ikon: Ikon }: { jenis?: keyof typeof gayaLencana; children: ReactNode; ikon?: LucideIcon }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${gayaLencana[jenis]}`}>
      {Ikon && <Ikon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

const gayaPesan = {
  info: { k: "border-line bg-panel-2", i: Info, w: "text-ink-2" },
  peringatan: { k: "border-waspada/25 bg-waspada-soft", i: TriangleAlert, w: "text-waspada" },
  galat: { k: "border-brand-garis bg-brand-soft", i: OctagonAlert, w: "text-brand-tinta" },
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
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors before:absolute before:-inset-2.5 before:content-[''] disabled:cursor-not-allowed ${nyala ? "bg-brand-kuat" : "bg-isian"}`}
      >
        <span className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition-[left] ${nyala ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {(label || keterangan) && (
        <span className="min-w-0">
          {label && <label htmlFor={id} className={`block text-sm font-semibold text-ink ${nonaktif ? "cursor-not-allowed" : "cursor-pointer"}`}>{label}</label>}
          {keterangan && <span id={`${id}-ket`} className="mt-0.5 block text-xs text-ink-2">{keterangan}</span>}
        </span>
      )}
    </div>
  );
}

export function Kosong({ judul, sub, aksi, ikon: Ikon }: { judul: string; sub?: ReactNode; aksi?: ReactNode; ikon?: LucideIcon }) {
  return (
    <div className="rounded-xl border border-dashed border-line-2 bg-panel px-6 py-12 text-center">
      {Ikon && <Ikon className="mx-auto mb-3 h-6 w-6 text-ink-3" aria-hidden />}
      <div className="font-serif text-lg font-semibold text-ink">{judul}</div>
      {sub && <div className="mx-auto mt-1.5 max-w-md text-sm text-ink-2">{sub}</div>}
      {aksi && <div className="mt-5 flex flex-wrap justify-center gap-2">{aksi}</div>}
    </div>
  );
}

export function ZonaUnggah({ ganda, terima = ".docx", pilih, label, sub, ringkas }: {
  ganda?: boolean; terima?: string; pilih: (f: File[]) => void; label: string; sub?: string; ringkas?: boolean;
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
      className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed text-center transition-colors ${
        ringkas ? "px-4 py-5" : "px-6 py-10"
      } ${seret ? "border-brand-kuat bg-brand-soft" : "border-isian bg-panel hover:border-brand-kuat hover:bg-brand-soft/50"}`}
    >
      <FileUp className={`mb-2 text-brand-tinta ${ringkas ? "h-5 w-5" : "h-7 w-7"}`} aria-hidden />
      <div className="text-sm font-semibold text-ink">{label}</div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
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
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-tinta"
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

/** Logo yang sudah ada (dokumen + centang), diwarnai ulang merah lembut. Warna tetap di kedua tema. */
export function LogoAutoJurnal({ ukuran = 36 }: { ukuran?: number }) {
  return (
    <svg viewBox="0 0 32 32" style={{ width: ukuran, height: ukuran }} className="shrink-0" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#e06a6a" />
      <path d="M11 6.5h8.5l4.5 4.5v13.5a1.5 1.5 0 0 1-1.5 1.5H11a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 11 6.5z" fill="#fff" />
      <path d="M19.5 6.5V11H24" fill="#fceeee" />
      <path d="M12.8 17.4l2.8 2.8 5.4-5.9" stroke="#a8323a" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
