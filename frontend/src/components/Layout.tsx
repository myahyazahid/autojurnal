import { BookOpen, ChevronsUpDown, FileCheck2, History, LogOut, Menu, MessageSquareText, Settings, Shrink, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTema, type Tema } from "../lib/tema";
import { Avatar, LogoAutoJurnal } from "./ui";

interface Menu {
  ke: string;
  label: string;
  ikon: LucideIcon;
  akhir?: boolean;
}

const MENU: Menu[] = [
  { ke: "/", label: "Cek Naskah", ikon: FileCheck2, akhir: true },
  { ke: "/riwayat", label: "Riwayat", ikon: History },
  { ke: "/jurnal", label: "Profil Jurnal", ikon: BookOpen },
  { ke: "/resizer", label: "Resizer", ikon: Shrink },
];
const MENU_ADMIN: Menu[] = [
  { ke: "/komentar", label: "Komentar", ikon: MessageSquareText },
  { ke: "/pengguna", label: "Pengguna", ikon: Users },
  { ke: "/pengaturan", label: "Pengaturan", ikon: Settings },
];

function TautanNav({ m, tutup }: { m: Menu; tutup?: () => void }) {
  const Ikon = m.ikon;
  return (
    <NavLink
      to={m.ke}
      end={m.akhir}
      onClick={tutup}
      className={({ isActive }) =>
        `ketuk flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
          isActive ? "bg-brand-soft font-semibold text-brand-tinta" : "font-medium text-ink-2 hover:bg-panel-3 hover:text-ink"
        }`
      }
    >
      <Ikon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {m.label}
    </NavLink>
  );
}

function PilihTema() {
  const { tema, setTema } = useTema();
  const opsi: [Tema, string][] = [["terang", "Terang"], ["gelap", "Gelap"], ["sistem", "Sistem"]];
  return (
    <div>
      <div id="label-tema" className="mb-1.5 px-1 text-xs font-medium text-ink-2">Tema</div>
      <div role="group" aria-labelledby="label-tema" className="grid grid-cols-3 gap-1 rounded-lg bg-panel-3 p-1">
        {opsi.map(([t, label]) => (
          <button
            key={t}
            type="button"
            aria-pressed={tema === t}
            onClick={() => setTema(t)}
            className={`ketuk rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              tema === t ? "bg-panel text-ink shadow-[0_1px_2px_rgba(15,23,41,0.12)]" : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AksiAkun({ tutup }: { tutup: () => void }) {
  const { keluar } = useAuth();
  const nav = useNavigate();
  return (
    <div className="space-y-0.5">
      <Link to="/akun" onClick={tutup} className="ketuk flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-ink hover:bg-panel-3">
        <UserRound className="h-4 w-4 text-ink-2" aria-hidden /> Akun saya
      </Link>
      <button
        type="button"
        onClick={async () => {
          tutup();
          await keluar();
          nav("/masuk");
        }}
        className="ketuk flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium text-bahaya hover:bg-bahaya-soft"
      >
        <LogOut className="h-4 w-4" aria-hidden /> Keluar
      </button>
    </div>
  );
}

/** Kartu akun di dasar sidebar. Membuka panel ke atas; tutup dengan Escape, klik di luar, atau pindah halaman. */
function MenuAkun() {
  const { pengguna } = useAuth();
  const [buka, setBuka] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pemicu = useRef<HTMLButtonElement>(null);
  const lokasi = useLocation();
  useEffect(() => setBuka(false), [lokasi.pathname]);
  useEffect(() => {
    if (!buka) return;
    const klik = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setBuka(false);
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBuka(false);
        pemicu.current?.focus();
      }
    };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", tombol);
    return () => {
      document.removeEventListener("mousedown", klik);
      document.removeEventListener("keydown", tombol);
    };
  }, [buka]);
  if (!pengguna) return null;
  const nama = pengguna.nama || pengguna.email.split("@")[0];
  return (
    <div ref={ref} className="relative">
      {buka && (
        <div id="panel-akun" className="melayang absolute right-0 bottom-full left-0 z-40 mb-2 space-y-3 p-2.5">
          <PilihTema />
          <div className="border-t border-line pt-2">
            <AksiAkun tutup={() => setBuka(false)} />
          </div>
        </div>
      )}
      <button
        ref={pemicu}
        type="button"
        aria-expanded={buka}
        aria-controls="panel-akun"
        onClick={() => setBuka(!buka)}
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-panel-3"
      >
        <Avatar nama={pengguna.nama || pengguna.email} foto={pengguna.foto} ukuran={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{nama}</span>
          <span className="block truncate text-xs text-ink-2">{pengguna.peran === "admin" ? "Admin" : "Pengguna"} · {pengguna.email}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
      </button>
    </div>
  );
}

function Navigasi({ tutup }: { tutup?: () => void }) {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  return (
    <nav aria-label="Utama" className="space-y-0.5">
      {MENU.map((m) => <TautanNav key={m.ke} m={m} tutup={tutup} />)}
      {admin && (
        <>
          <div className="px-3 pt-6 pb-1.5 text-xs font-medium text-ink-3">Admin</div>
          {MENU_ADMIN.map((m) => <TautanNav key={m.ke} m={m} tutup={tutup} />)}
        </>
      )}
    </nav>
  );
}

function Merek() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md">
      <LogoAutoJurnal ukuran={30} />
      <span className="text-[17px] font-bold tracking-tight text-ink">AutoJurnal</span>
    </Link>
  );
}

/** Laci navigasi untuk layar di bawah 1024px. */
function LaciMobile({ tutup, pemicu }: { tutup: () => void; pemicu: React.RefObject<HTMLButtonElement | null> }) {
  const { pengguna } = useAuth();
  const tombolTutup = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    tombolTutup.current?.focus();
    const tombol = (e: KeyboardEvent) => e.key === "Escape" && tutup();
    document.addEventListener("keydown", tombol);
    const tadi = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const kembali = pemicu.current;
    return () => {
      document.removeEventListener("keydown", tombol);
      document.body.style.overflow = tadi;
      kembali?.focus();
    };
  }, [tutup, pemicu]);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
      <div className="absolute inset-0 bg-ink/40" onClick={tutup} aria-hidden />
      <div className="absolute inset-y-0 left-0 flex w-[min(18rem,100%-3rem)] flex-col overflow-y-auto border-r border-line bg-panel">
        <div className="flex h-14 items-center justify-between px-4">
          <Merek />
          <button ref={tombolTutup} type="button" onClick={tutup} className="ketuk inline-flex items-center justify-center rounded-lg p-2 text-ink-2 hover:bg-panel-3" aria-label="Tutup menu">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 px-3 py-3">
          <Navigasi tutup={tutup} />
        </div>
        {pengguna && (
          <div className="space-y-3 border-t border-line p-3">
            <div className="flex items-center gap-3 px-1">
              <Avatar nama={pengguna.nama || pengguna.email} foto={pengguna.foto} ukuran={34} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{pengguna.nama || pengguna.email.split("@")[0]}</span>
                <span className="block truncate text-xs text-ink-2">{pengguna.email}</span>
              </span>
            </div>
            <PilihTema />
            <AksiAkun tutup={tutup} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [laci, setLaci] = useState(false);
  const tutupLaci = useCallback(() => setLaci(false), []);
  const tombolLaci = useRef<HTMLButtonElement>(null);
  const lokasi = useLocation();
  useEffect(() => setLaci(false), [lokasi.pathname]);
  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#konten" className="sr-only z-50 rounded-md bg-panel px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Lewati ke konten
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-panel lg:flex">
        <div className="flex h-16 items-center px-5">
          <Merek />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <Navigasi />
        </div>
        <div className="border-t border-line p-3">
          <MenuAkun />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-panel px-4 lg:hidden">
        <Merek />
        <button
          ref={tombolLaci}
          type="button"
          onClick={() => setLaci(true)}
          aria-expanded={laci}
          className="ketuk inline-flex items-center gap-2 rounded-lg border border-line-2 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-panel-3"
        >
          <Menu className="h-4 w-4" aria-hidden /> Menu
        </button>
      </header>
      {laci && <LaciMobile tutup={tutupLaci} pemicu={tombolLaci} />}

      <main id="konten" className="px-4 py-6 sm:px-8 sm:py-8 xl:px-10">
        <div className="mx-auto w-full max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
