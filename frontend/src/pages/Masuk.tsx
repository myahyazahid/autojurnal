import { ArrowRight, BookOpen, Eye, EyeOff, Lock, Mail, MessageSquareText, ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, type KonfigurasiAuth } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LogoAutoJurnal, LogoGoogle, Pesan, Tombol } from "../components/ui";

function KomentarContoh({ kelas, awalan, pesan, nama, waktu }: { kelas: string; awalan: string; pesan: string; nama: string; waktu: string }) {
  return (
    <div className={`kaca w-72 rounded-2xl p-3.5 text-left shadow-2xl shadow-black/20 ${kelas}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-violet-700">
          {nama.split(" ").map((w) => w[0]).join("").slice(0, 2)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-white">{nama}</div>
          <div className="text-[10px] text-white/60">{waktu}</div>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/90">
        <span className="font-bold text-white">{awalan}</span> {pesan}
      </p>
    </div>
  );
}

const FITUR = [
  { ikon: BookOpen, judul: "Aturan dari template jurnal", isi: "Unggah template, sistem membaca margin, font, struktur, sampai ketentuan referensi." },
  { ikon: MessageSquareText, judul: "Komentar langsung di Word", isi: "Setiap ketidaksesuaian ditandai sebagai komentar atas nama akun Anda." },
  { ikon: Sparkles, judul: "Bot + AI", isi: "Format dicek bot secara pasti; substansi seperti research gap dinilai AI." },
];

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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ---------- hero ---------- */}
      <div className="bg-merek relative hidden overflow-hidden lg:block">
        <div className="animasi-melayang absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-fuchsia-400/40 blur-3xl" />
        <div className="animasi-melayang absolute -right-20 bottom-[-120px] h-[460px] w-[460px] rounded-full bg-indigo-400/40 blur-3xl [animation-delay:-6s]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex min-h-screen flex-col gap-10 p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/15 p-1 ring-1 ring-white/25"><LogoAutoJurnal ukuran={40} /></span>
            <span className="text-xl font-extrabold tracking-tight text-white">AutoJurnal</span>
          </div>

          <div className="my-auto max-w-xl">
            <div className="kaca mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white">
              <Zap className="h-3.5 w-3.5" /> ±0,5 detik per naskah
            </div>
            <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-white xl:text-5xl">
              Naskah rapi sesuai template, <span className="text-white/70">sebelum reviewer melihatnya.</span>
            </h1>
            <div className="mt-8 space-y-4">
              {FITUR.map(({ ikon: Ikon, judul, isi }) => (
                <div key={judul} className="flex gap-3.5">
                  <span className="kaca flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"><Ikon className="h-5 w-5" /></span>
                  <div>
                    <div className="font-semibold text-white">{judul}</div>
                    <div className="text-sm text-white/70">{isi}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* contoh komentar Word — hanya di layar yang cukup tinggi agar tidak menabrak teks */}
          <div className="relative hidden h-40 shrink-0 [@media(min-height:860px)]:block">
            <KomentarContoh kelas="animasi-naik absolute left-0 top-0" awalan="[WAJIB · Abstrak]" pesan="Abstrak 174 kata; seharusnya 200–250 kata." nama="Reviewer Jurnal" waktu="baru saja" />
            <KomentarContoh kelas="animasi-naik absolute left-64 top-14 [animation-delay:-1.7s] xl:left-80" awalan="[WAJIB · Referensi]" pesan="Jumlah referensi 8, minimal 15." nama="Reviewer Jurnal" waktu="baru saja" />
          </div>
        </div>
      </div>

      {/* ---------- formulir ---------- */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="grid-titik pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="animasi-muncul relative w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoAutoJurnal ukuran={40} />
            <span className="text-xl font-extrabold tracking-tight">AutoJurnal</span>
          </div>
          <h2 className="text-[28px] font-extrabold tracking-tight">{mode === "masuk" ? "Selamat datang kembali" : "Buat akun baru"}</h2>
          <p className="mt-1.5 text-sm text-ink-2">
            {mode === "masuk" ? "Masuk untuk mulai memeriksa naskah." : "Gunakan akun Google atau email Anda."}
          </p>

          <div className="mt-7 space-y-4">
            {galat && <Pesan jenis="galat">{galat}</Pesan>}

            <a
              href={konf?.google ? "/api/auth/google" : undefined}
              aria-disabled={!konf?.google}
              className={`flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-panel text-[15px] font-semibold text-ink shadow-sm transition ${
                konf?.google ? "hover:border-line-2 hover:shadow-md active:scale-[0.99]" : "cursor-not-allowed opacity-55"
              }`}
            >
              <LogoGoogle /> {mode === "masuk" ? "Masuk" : "Daftar"} dengan Google
            </a>
            {konf && !konf.google && (
              <p className="-mt-2 text-center text-[11px] text-ink-3">Login Google belum aktif — admin perlu mengisi GOOGLE_CLIENT_ID di .env</p>
            )}

            <div className="flex items-center gap-3 text-xs font-medium text-ink-3">
              <span className="h-px flex-1 bg-line" /> atau dengan email <span className="h-px flex-1 bg-line" />
            </div>

            {mode === "daftar" && konf && !konf.daftar ? (
              <Pesan jenis="info">Pendaftaran dengan email dinonaktifkan admin. Silakan gunakan Google.</Pesan>
            ) : (
              <form onSubmit={kirim} className="space-y-3.5">
                {mode === "daftar" && (
                  <Isian ikon={UserRound} label="Nama lengkap" nilai={nama} ubah={setNama} placeholder="Nama yang tampil di komentar" autoComplete="name" wajib />
                )}
                <Isian ikon={Mail} label="Email" jenis="email" nilai={email} ubah={setEmail} placeholder="nama@gmail.com" autoComplete="email" wajib />
                <div>
                  <label className="label">Kata sandi</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
                    <input
                      className="input pr-10 pl-10"
                      type={lihat ? "text" : "password"}
                      value={sandi}
                      onChange={(e) => setSandi(e.target.value)}
                      placeholder={mode === "daftar" ? "Minimal 8 karakter" : "••••••••"}
                      autoComplete={mode === "masuk" ? "current-password" : "new-password"}
                      minLength={mode === "daftar" ? 8 : undefined}
                      required
                    />
                    <button type="button" onClick={() => setLihat(!lihat)} className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label="Tampilkan sandi">
                      {lihat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Tombol type="submit" varian="utama" ukuran="besar" className="w-full" memuat={sibuk}>
                  {mode === "masuk" ? "Masuk" : "Buat akun"} {!sibuk && <ArrowRight className="h-4 w-4" />}
                </Tombol>
              </form>
            )}

            <p className="pt-1 text-center text-sm text-ink-2">
              {mode === "masuk" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
              <button onClick={() => { setMode(mode === "masuk" ? "daftar" : "masuk"); setGalat(""); }} className="font-semibold text-brand hover:underline">
                {mode === "masuk" ? "Daftar" : "Masuk"}
              </button>
            </p>
            {konf && konf.domain.length > 0 && (
              <p className="text-center text-[11px] text-ink-3">Hanya untuk email {konf.domain.map((d) => "@" + d).join(", ")}</p>
            )}
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-ink-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Naskah langsung dihapus setelah diperiksa
          </div>
        </div>
      </div>
    </div>
  );
}

function Isian({ ikon: Ikon, label, nilai, ubah, jenis = "text", placeholder, autoComplete, wajib }: {
  ikon: typeof Mail; label: string; nilai: string; ubah: (v: string) => void; jenis?: string; placeholder?: string; autoComplete?: string; wajib?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Ikon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input className="input pl-10" type={jenis} value={nilai} onChange={(e) => ubah(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required={wajib} />
      </div>
    </div>
  );
}
