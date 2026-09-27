import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, type KonfigurasiAuth } from "../lib/api";
import { useAuth } from "../lib/auth";
import { IkonBerkas, Lencana, LogoAutoJurnal, LogoGoogle, Pesan, Tombol } from "../components/ui";

const FAKTA = [
  "Aturan dibaca dari template .docx jurnal: margin, font, struktur, sampai referensi.",
  "Setiap ketidaksesuaian ditulis sebagai komentar Word atas nama akun Anda.",
  "Format dicek bot secara pasti. AI hanya dipakai bila diaktifkan.",
];

/** Contoh keluaran, diberi label jelas. Pesannya memakai format asli dari mesin pemeriksa. */
function ContohHasil() {
  const baris: ["wajib" | "saran", string][] = [
    ["wajib", "Abstrak terdiri atas 174 kata; seharusnya 200–250 kata."],
    ["wajib", "Jumlah referensi 8, minimal 15."],
    ["saran", "Kata kunci sebaiknya huruf kecil (kecuali singkatan): Wisata, Website."],
  ];
  return (
    <figure className="melayang w-full max-w-md overflow-hidden text-ink">
      <figcaption className="border-b border-line bg-panel-2 px-4 py-2 text-xs font-medium text-ink-2">Contoh hasil pemeriksaan</figcaption>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <IkonBerkas ukuran={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">naskah-artikel.docx</div>
          <div className="text-xs text-ink-2">2 wajib · 1 saran</div>
        </div>
        <Lencana jenis="wajib">Revisi minor</Lencana>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {baris.map(([t, p]) => (
          <li key={p} className="flex items-start gap-2.5 px-4 py-2.5 text-[13px] leading-snug">
            <Lencana jenis={t}>{t === "wajib" ? "Wajib" : "Saran"}</Lencana>
            <span className="text-ink-2">{p}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default function Masuk() {
  const { pengguna, setPengguna } = useAuth();
  const [param] = useSearchParams();
  const lokasi = useLocation();
  const nav = useNavigate();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [konf, setKonf] = useState<KonfigurasiAuth | null>(null);
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [lihat, setLihat] = useState(false);
  const [galat, setGalat] = useState(param.get("galat") ?? "");
  const [sibuk, setSibuk] = useState(false);
  const idSandi = useId();

  useEffect(() => {
    api.konfigurasi().then(setKonf).catch(() => undefined);
  }, []);

  if (pengguna) return <Navigate to={(lokasi.state as { dari?: string })?.dari ?? "/"} replace />;

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat("");
    setSibuk(true);
    try {
      const p = mode === "masuk" ? await api.masuk(email, sandi) : await api.daftar(nama, email, sandi);
      setPengguna(p);
      nav((lokasi.state as { dari?: string })?.dari ?? "/", { replace: true });
    } catch (err) {
      setGalat((err as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-panel lg:grid-cols-2">
      {/* ---------- formulir ---------- */}
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center gap-2.5">
          <LogoAutoJurnal ukuran={32} />
          <span className="text-lg font-bold tracking-tight">AutoJurnal</span>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{mode === "masuk" ? "Masuk ke AutoJurnal" : "Buat akun"}</h1>
          <p className="mt-2 text-[15px] text-ink-2">
            {mode === "masuk" ? "Periksa naskah dan lihat riwayat pengecekan Anda." : "Nama akun dipakai sebagai penulis komentar di naskah."}
          </p>

          <div className="mt-8 space-y-5">
            {galat && <Pesan jenis="galat">{galat}</Pesan>}

            {konf?.google ? (
              <a
                href="/api/auth/google"
                className="ketuk flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-line-2 bg-panel text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,41,0.05)] transition-colors hover:bg-panel-2"
              >
                <LogoGoogle /> {mode === "masuk" ? "Masuk" : "Daftar"} dengan Google
              </a>
            ) : (
              <div>
                <button type="button" disabled className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-line-2 bg-panel-2 text-sm font-semibold text-ink-2">
                  <LogoGoogle /> {mode === "masuk" ? "Masuk" : "Daftar"} dengan Google
                </button>
                {konf && <p className="mt-2 text-xs text-ink-2">Login Google belum aktif. Admin perlu mengisi GOOGLE_CLIENT_ID di .env.</p>}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs font-medium text-ink-3">
              <span className="h-px flex-1 bg-line" /> atau dengan email <span className="h-px flex-1 bg-line" />
            </div>

            {mode === "daftar" && konf && !konf.daftar ? (
              <Pesan jenis="info">Pendaftaran dengan email dinonaktifkan admin. Silakan gunakan Google.</Pesan>
            ) : (
              <form onSubmit={kirim} className="space-y-4">
                {mode === "daftar" && (
                  <Isian label="Nama lengkap" nilai={nama} ubah={setNama} placeholder="Nama yang tampil di komentar" autoComplete="name" wajib />
                )}
                <Isian label="Email" jenis="email" nilai={email} ubah={setEmail} placeholder="email@example.com" autoComplete="email" wajib />
                <div>
                  <label className="label" htmlFor={idSandi}>Kata sandi</label>
                  <div className="relative">
                    <input
                      id={idSandi}
                      className="input h-11 pr-12"
                      type={lihat ? "text" : "password"}
                      value={sandi}
                      onChange={(e) => setSandi(e.target.value)}
                      placeholder={mode === "daftar" ? "Minimal 8 karakter" : ""}
                      autoComplete={mode === "masuk" ? "current-password" : "new-password"}
                      minLength={mode === "daftar" ? 8 : undefined}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setLihat(!lihat)}
                      aria-pressed={lihat}
                      aria-label={lihat ? "Sembunyikan sandi" : "Tampilkan sandi"}
                      className="ketuk absolute top-1/2 right-1 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-2 text-ink-2 hover:text-ink"
                    >
                      {lihat ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </div>
                <Tombol type="submit" varian="utama" ukuran="besar" className="w-full" memuat={sibuk}>
                  {mode === "masuk" ? "Masuk" : "Buat akun"}
                </Tombol>
              </form>
            )}

            <p className="text-center text-sm text-ink-2">
              {mode === "masuk" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
              <button
                type="button"
                onClick={() => { setMode(mode === "masuk" ? "daftar" : "masuk"); setGalat(""); }}
                className="ketuk font-semibold text-brand-tinta underline-offset-2 hover:underline"
              >
                {mode === "masuk" ? "Daftar" : "Masuk"}
              </button>
            </p>
            {konf && konf.domain.length > 0 && (
              <p className="text-center text-xs text-ink-2">Hanya untuk email {konf.domain.map((d) => "@" + d).join(", ")}</p>
            )}
          </div>
        </div>

        <p className="flex items-center justify-center gap-2 text-xs text-ink-2 lg:justify-start">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Naskah langsung dihapus setelah diperiksa
        </p>
      </div>

      {/* ---------- penjelasan produk (desktop) ---------- */}
      <div className="hidden p-3 lg:block">
        <div className="flex h-full flex-col justify-center gap-10 rounded-2xl bg-brand px-12 py-12 text-white xl:px-16">
          <div className="max-w-lg">
            <h2 className="text-[34px] leading-[1.15] font-bold tracking-tight xl:text-[40px]">Naskah sesuai template sebelum sampai ke reviewer.</h2>
            <ul className="mt-6 space-y-3">
              {FAKTA.map((f) => (
                <li key={f} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-white" aria-hidden /> {f}
                </li>
              ))}
            </ul>
          </div>
          <ContohHasil />
        </div>
      </div>
    </div>
  );
}

function Isian({ label, nilai, ubah, jenis = "text", placeholder, autoComplete, wajib }: {
  label: string; nilai: string; ubah: (v: string) => void; jenis?: string; placeholder?: string; autoComplete?: string; wajib?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input h-11" type={jenis} value={nilai} onChange={(e) => ubah(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required={wajib} />
    </div>
  );
}
