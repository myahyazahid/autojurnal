import { CircleCheck, CloudUpload, Info, LoaderCircle, OctagonAlert, ShieldCheck, ShieldX, TriangleAlert, type LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

type Varian = "utama" | "biasa" | "bahaya" | "hantu" | "lembut";

const gayaTombol: Record<Varian, string> = {
  utama:
    "bg-merek text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 disabled:opacity-50 disabled:shadow-none",
  biasa: "border border-line bg-panel text-ink hover:border-line-2 hover:bg-panel-2 shadow-xs disabled:opacity-50",
  bahaya: "border border-rose-200 bg-panel text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10 disabled:opacity-50",
  hantu: "text-ink-2 hover:bg-panel-3 hover:text-ink disabled:opacity-40",
  lembut: "bg-brand-soft text-brand hover:brightness-95 dark:hover:brightness-125 disabled:opacity-50",
};

const ukuranTombol = { kecil: "h-8 px-3 text-xs gap-1.5 rounded-lg", sedang: "h-10 px-4 text-sm gap-2 rounded-xl", besar: "h-12 px-6 text-[15px] gap-2.5 rounded-xl" };

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
      className={`inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed ${ukuranTombol[ukuran]} ${gayaTombol[varian]} ${className}`}
    >
      {memuat ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Ikon ? <Ikon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function TautanTombol({ href, children, varian = "biasa", ukuran = "sedang", ikon: Ikon, className = "" }: {
  href: string; children: ReactNode; varian?: Varian; ukuran?: keyof typeof ukuranTombol; ikon?: LucideIcon; className?: string;
}) {
  return (
    <a href={href} className={`inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all active:scale-[0.98] ${ukuranTombol[ukuran]} ${gayaTombol[varian]} ${className}`}>
      {Ikon && <Ikon className="h-4 w-4" />}
      {children}
    </a>
  );
}

export function Putar({ besar, className = "" }: { besar?: boolean; className?: string }) {
  return <LoaderCircle className={`animate-spin text-brand ${besar ? "h-7 w-7" : "h-4 w-4"} ${className}`} aria-label="memuat" />;
}

export function MemuatHalaman() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Putar besar />
    </div>
  );
}

export function Kartu({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`kartu ${className}`}>{children}</div>;
}

export function KotakIkon({ ikon: Ikon, warna = "merek", ukuran = "sedang" }: { ikon: LucideIcon; warna?: "merek" | "lembut"; ukuran?: "kecil" | "sedang" | "besar" }) {
  const u = { kecil: "h-8 w-8 rounded-lg", sedang: "h-10 w-10 rounded-xl", besar: "h-12 w-12 rounded-2xl" }[ukuran];
  const i = { kecil: "h-4 w-4", sedang: "h-5 w-5", besar: "h-6 w-6" }[ukuran];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${u} ${warna === "merek" ? "bg-merek text-white shadow-md shadow-indigo-500/25" : "bg-brand-soft text-brand"}`}>
      <Ikon className={i} />
    </span>
  );
}

export function JudulHalaman({ judul, sub, aksi, ikon, kecil }: { judul: ReactNode; sub?: ReactNode; aksi?: ReactNode; ikon?: LucideIcon; kecil?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-3.5">
        {ikon && <KotakIkon ikon={ikon} ukuran="besar" />}
        <div>
          {kecil && <div className="mb-1 text-xs font-semibold tracking-wide text-brand uppercase">{kecil}</div>}
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{judul}</h1>
          {sub && <p className="mt-1 max-w-2xl text-sm text-ink-2">{sub}</p>}
        </div>
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}

const gayaLencana = {
  wajib: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25",
  saran: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  ai: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25",
  netral: "bg-panel-3 text-ink-2 ring-line",
  sukses: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
  info: "bg-brand-soft text-brand ring-brand/20",
};

export function Lencana({ jenis = "netral", children, ikon: Ikon }: { jenis?: keyof typeof gayaLencana; children: ReactNode; ikon?: LucideIcon }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${gayaLencana[jenis]}`}>
      {Ikon && <Ikon className="h-3 w-3" />}
      {children}
    </span>
  );
}

const gayaPesan = {
  info: { k: "border-brand/20 bg-brand-soft/60 text-ink", i: Info, w: "text-brand" },
  peringatan: { k: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100", i: TriangleAlert, w: "text-amber-500" },
  galat: { k: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100", i: OctagonAlert, w: "text-rose-500" },
  sukses: { k: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100", i: CircleCheck, w: "text-emerald-500" },
};

export function Pesan({ jenis = "info", judul, children }: { jenis?: keyof typeof gayaPesan; judul?: ReactNode; children?: ReactNode }) {
  const g = gayaPesan[jenis];
  const Ikon = g.i;
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${g.k}`}>
      <Ikon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${g.w}`} />
      <div className="min-w-0">
        {judul && <div className="font-semibold">{judul}</div>}
        {children && <div className={`${judul ? "mt-1" : ""} opacity-90`}>{children}</div>}
      </div>
    </div>
  );
}

export function Sakelar({ nyala, ubah, label, keterangan, nonaktif }: {
  nyala: boolean; ubah: (v: boolean) => void; label: ReactNode; keterangan?: ReactNode; nonaktif?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${nonaktif ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={nyala}
        disabled={nonaktif}
        onClick={() => ubah(!nyala)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${nyala ? "bg-merek" : "bg-line-2"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all ${nyala ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {keterangan && <span className="mt-0.5 block text-xs text-ink-2">{keterangan}</span>}
      </span>
    </label>
  );
}

export function Kosong({ judul, sub, aksi, ikon: Ikon = Info }: { judul: string; sub?: ReactNode; aksi?: ReactNode; ikon?: LucideIcon }) {
  return (
    <div className="grid-titik relative overflow-hidden rounded-2xl border border-dashed border-line-2 bg-panel/60 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Ikon className="h-7 w-7" />
      </div>
      <div className="text-base font-bold text-ink">{judul}</div>
      {sub && <div className="mx-auto mt-1.5 max-w-md text-sm text-ink-2">{sub}</div>}
      {aksi && <div className="mt-5 flex justify-center gap-2">{aksi}</div>}
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
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
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
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed text-center transition-all duration-300 outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
        ringkas ? "px-5 py-7" : "px-6 py-12"
      } ${seret ? "scale-[1.01] border-brand bg-brand-soft" : "border-line-2 bg-panel-2 hover:border-brand/60 hover:bg-brand-soft/50"}`}
    >
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-500/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className={`relative mx-auto mb-3 flex items-center justify-center rounded-2xl bg-merek text-white shadow-lg shadow-indigo-500/30 transition-transform duration-300 group-hover:-translate-y-1 ${ringkas ? "h-11 w-11" : "h-14 w-14"}`}>
        <CloudUpload className={ringkas ? "h-5 w-5" : "h-7 w-7"} />
      </div>
      <div className="relative text-sm font-bold text-ink">{label}</div>
      {sub && <div className="relative mt-1 text-xs text-ink-3">{sub}</div>}
      <input
        ref={ref}
        type="file"
        accept={terima}
        multiple={ganda}
        className="hidden"
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
      <img src={foto} alt={nama} referrerPolicy="no-referrer" onError={() => setGagal(true)}
        className="shrink-0 rounded-full object-cover ring-2 ring-white/70 dark:ring-white/10" style={{ width: ukuran, height: ukuran }} />
    );
  }
  return (
    <span className="bg-merek inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/70 dark:ring-white/10"
      style={{ width: ukuran, height: ukuran, fontSize: ukuran * 0.38 }}>
      {inisial}
    </span>
  );
}

export function Kerangka({ className = "" }: { className?: string }) {
  return <div className={`kilau rounded-xl ${className}`} />;
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

export function LogoAutoJurnal({ ukuran = 36 }: { ukuran?: number }) {
  return (
    <span className="bg-merek relative inline-flex shrink-0 items-center justify-center rounded-xl shadow-lg shadow-violet-500/30" style={{ width: ukuran, height: ukuran }}>
      <svg viewBox="0 0 32 32" style={{ width: ukuran * 0.62, height: ukuran * 0.62 }} aria-hidden>
        <path d="M9 5.5h9.5l5 5V25a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 25V7A1.5 1.5 0 0 1 9 5.5z" fill="#fff" />
        <path d="M18.5 5.5v5h5" fill="#e9e5ff" />
        <path d="M11.5 17.5l3 3 6-6.5" stroke="#6d28d9" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Lencana putusan scope — warna solid agar langsung terlihat di daftar. */
export function LencanaScope({ keputusan, besar }: { keputusan?: "terima" | "tolak"; besar?: boolean }) {
  if (!keputusan) return null;
  const sesuai = keputusan === "terima";
  const Ikon = sesuai ? ShieldCheck : ShieldX;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap text-white shadow-sm ${
      besar ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"} ${sesuai ? "bg-emerald-500 shadow-emerald-500/30" : "bg-rose-500 shadow-rose-500/30"}`}>
      <Ikon className={besar ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {sesuai ? "Sesuai scope" : "Tidak sesuai scope"}
    </span>
  );
}
