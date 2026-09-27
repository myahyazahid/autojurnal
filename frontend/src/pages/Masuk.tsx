import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, type KonfigurasiAuth } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LogoAutoJurnal, LogoGoogle, Pesan, Tombol } from "../components/ui";

const FAKTA = [
  { judul: "Aturan dibaca dari template", isi: "Margin, font, struktur bagian, jumlah kata abstrak, sampai ketentuan referensi diambil dari template .docx jurnal." },
  { judul: "Komentar langsung di Word", isi: "Setiap ketidaksesuaian ditulis sebagai komentar atas nama akun Anda. Penulis tinggal membuka berkasnya." },
  { judul: "Bot dulu, AI bila diminta", isi: "Format dicek bot secara pasti. AI hanya dipakai bila diaktifkan, untuk menilai isi seperti research gap." },
];

/** Contoh keluaran: potongan naskah dengan satu komentar Word. Pesannya memakai format asli dari mesin pemeriksa. */
function ContohKomentar() {
  return (
    <figure className="max-w-xl">
      <div className="grid gap-3 sm:grid-cols-[1fr_15rem]">
        <div className="rounded-lg border border-brand-garis bg-panel p-5">
          <div className="font-serif text-sm font-bold text-ink">Abstrak</div>
          <p className="mt-2 font-serif text-[15px] leading-relaxed text-ink-2">
            <mark className="rounded-sm bg-brand-soft px-0.5 text-ink">Penelitian ini menganalisis pengaruh literasi digital</mark> terhadap kinerja guru
            sekolah dasar. Data dikumpulkan melalui kuesioner dan dianalisis dengan regresi linear.
          </p>
        </div>
        <div className="self-start rounded-lg border border-line bg-panel p-3.5">
          <div className="text-xs font-semibold text-ink">Nama akun Anda</div>
          <p className="mt-1 text-[13px] leading-snug text-ink-2">Abstrak terdiri atas 174 kata; seharusnya 200–250 kata.</p>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-ink-2">Contoh komentar yang ditulis ke salinan naskah.</figcaption>
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
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ---------- penjelasan produk (desktop) ---------- */}
      <div className="hidden border-r border-brand-garis bg-brand-soft lg:block">
        <div className="flex min-h-screen flex-col gap-12 p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <LogoAutoJurnal ukuran={36} />
            <span className="font-serif text-xl font-semibold tracking-tight">AutoJurnal</span>
          </div>

          <div className="my-auto space-y-10">
            <div className="max-w-xl">
              <h1 className="font-serif text-[40px] leading-[1.15] font-semibold tracking-tight text-ink xl:text-[46px]">
                Naskah rapi <span className="coret-merah">sesuai template</span>, sebelum reviewer membacanya.
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">
                Unggah template jurnal sekali. Setelah itu setiap naskah .docx dikembalikan sebagai salinan berkomentar di bagian yang belum sesuai.
              </p>
            </div>
            <ContohKomentar />
            <dl className="grid max-w-2xl gap-6 border-t border-brand-garis pt-6 xl:grid-cols-3">
              {FAKTA.map((f) => (
                <div key={f.judul}>
                  <dt className="text-sm font-semibold text-ink">{f.judul}</dt>
                  <dd className="mt-1 text-[13px] leading-relaxed text-ink-2">{f.isi}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* ---------- formulir ---------- */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <LogoAutoJurnal ukuran={36} />
              <span className="font-serif text-xl font-semibold tracking-tight">AutoJurnal</span>
            </div>
            <p className="mt-3 text-sm text-ink-2">Cek naskah .docx sesuai template jurnal, hasilnya berupa komentar Word.</p>
          </div>
          <h2 className="font-serif text-[30px] leading-tight font-semibold tracking-tight">{mode === "masuk" ? "Masuk" : "Buat akun"}</h2>
          <p className="mt-1.5 text-sm text-ink-2">
            {mode === "masuk" ? "Masuk untuk memeriksa naskah dan melihat riwayat Anda." : "Nama akun dipakai sebagai penulis komentar di naskah."}
          </p>

          <div className="mt-7 space-y-4">
            {galat && <Pesan jenis="galat">{galat}</Pesan>}

            {konf?.google ? (
              <a
                href="/api/auth/google"
                className="ketuk flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-line-2 bg-panel text-[15px] font-semibold text-ink transition-colors hover:border-isian hover:bg-panel-2"
              >
                <LogoGoogle /> {mode === "masuk" ? "Masuk" : "Daftar"} dengan Google
              </a>
            ) : (
              <div>
                <button type="button" disabled className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-line-2 bg-panel text-[15px] font-semibold text-ink opacity-55">
                  <LogoGoogle /> {mode === "masuk" ? "Masuk" : "Daftar"} dengan Google
                </button>
                {konf && <p className="mt-1.5 text-center text-xs text-ink-2">Login Google belum aktif. Admin perlu mengisi GOOGLE_CLIENT_ID di .env.</p>}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs font-medium text-ink-2">
              <span className="h-px flex-1 bg-line-2" /> atau dengan email <span className="h-px flex-1 bg-line-2" />
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
                      className="input pr-12"
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

            <p className="pt-1 text-center text-sm text-ink-2">
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

          <p className="mt-10 flex items-center justify-center gap-2 text-xs text-ink-2">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Naskah langsung dihapus setelah diperiksa
          </p>
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
      <input id={id} className="input" type={jenis} value={nilai} onChange={(e) => ubah(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required={wajib} />
    </div>
  );
}
