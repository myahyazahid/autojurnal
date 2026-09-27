import { ChevronDown, LogOut, Menu, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTema, type Tema } from "../lib/tema";
import { Avatar, Lencana, LogoAutoJurnal } from "./ui";

interface Menu {
  ke: string;
  label: string;
  akhir?: boolean;
}

const MENU: Menu[] = [
  { ke: "/", label: "Cek Naskah", akhir: true },
  { ke: "/riwayat", label: "Riwayat" },
  { ke: "/jurnal", label: "Profil Jurnal" },
];
const MENU_ADMIN: Menu[] = [
  { ke: "/pengguna", label: "Pengguna" },
  { ke: "/pengaturan", label: "Pengaturan" },
];

/** Tab navigasi desktop: halaman aktif ditandai garis merah di tepi bawah bilah, seperti garis koreksi. */
function TabNav({ m }: { m: Menu }) {
  return (
    <NavLink
      to={m.ke}
      end={m.akhir}
      className={({ isActive }) =>
        `relative inline-flex h-16 items-center px-3 text-sm font-semibold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 ${
          isActive ? "text-ink after:bg-brand-kuat" : "text-ink-2 hover:text-ink after:bg-transparent"
        }`
      }
    >
      {m.label}
    </NavLink>
  );
}

function PilihTema() {
  const { tema, setTema } = useTema();
  const opsi: [Tema, string][] = [["terang", "Terang"], ["gelap", "Gelap"], ["sistem", "Ikuti sistem"]];
  return (
    <div>
      <div id="label-tema" className="mb-1.5 text-xs font-semibold text-ink-2">Tema</div>
      <div role="group" aria-labelledby="label-tema" className="grid grid-cols-3 gap-1 rounded-lg bg-panel-3 p-1">
        {opsi.map(([t, label]) => (
          <button
            key={t}
            type="button"
            aria-pressed={tema === t}
            onClick={() => setTema(t)}
            className={`ketuk rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
              tema === t ? "bg-panel text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function IdentitasPengguna() {
  const { pengguna } = useAuth();
  if (!pengguna) return null;
  const admin = pengguna.peran === "admin";
  return (
    <div className="flex items-center gap-3">
      <Avatar nama={pengguna.nama || pengguna.email} foto={pengguna.foto} ukuran={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{pengguna.nama || pengguna.email.split("@")[0]}</div>
        <div className="truncate text-xs text-ink-2">{pengguna.email}</div>
      </div>
      <Lencana jenis={admin ? "info" : "netral"}>{admin ? "Admin" : "Pengguna"}</Lencana>
    </div>
  );
}

function AksiAkun({ tutup }: { tutup: () => void }) {
  const { keluar } = useAuth();
  const nav = useNavigate();
  return (
    <div className="space-y-1">
      <Link to="/akun" onClick={tutup} className="ketuk flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-ink hover:bg-panel-3">
        <UserRound className="h-4 w-4 text-ink-2" aria-hidden /> Akun saya
      </Link>
      <button
        type="button"
        onClick={async () => {
          tutup();
          await keluar();
          nav("/masuk");
        }}
        className="ketuk flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-brand-tinta hover:bg-brand-soft"
      >
        <LogOut className="h-4 w-4" aria-hidden /> Keluar
      </button>
    </div>
  );
}

/** Menu akun desktop: tombol pembuka + panel. Tutup dengan Escape, klik di luar, atau pindah halaman. */
function MenuPengguna() {
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
  return (
    <div ref={ref} className="relative">
      <button
        ref={pemicu}
        type="button"
        aria-expanded={buka}
        aria-controls="panel-akun"
        onClick={() => setBuka(!buka)}
        className="ketuk flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left transition-colors hover:bg-panel-3"
      >
        <Avatar nama={pengguna.nama || pengguna.email} foto={pengguna.foto} ukuran={32} />
        <span className="hidden max-w-40 truncate text-sm font-semibold text-ink xl:block">{pengguna.nama || pengguna.email.split("@")[0]}</span>
        <span className="sr-only xl:hidden">Akun dan tema</span>
        <ChevronDown className={`h-4 w-4 text-ink-2 transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {buka && (
        <div id="panel-akun" className="melayang absolute top-full right-0 z-40 mt-2 w-80 space-y-4 p-4">
          <IdentitasPengguna />
          <PilihTema />
          <div className="border-t border-line pt-3">
            <AksiAkun tutup={() => setBuka(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Laci navigasi untuk layar di bawah 1024px. */
function LaciMobile({ tutup, pemicu }: { tutup: () => void; pemicu: React.RefObject<HTMLButtonElement | null> }) {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
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
  const tautan = (m: Menu) => (
    <NavLink
      key={m.ke}
      to={m.ke}
      end={m.akhir}
      onClick={tutup}
      className={({ isActive }) =>
        `flex min-h-12 items-center rounded-lg px-3 text-[15px] font-semibold ${isActive ? "bg-brand-soft text-brand-tinta" : "text-ink hover:bg-panel-3"}`
      }
    >
      {m.label}
    </NavLink>
  );
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
      <div className="absolute inset-0 bg-ink/40" onClick={tutup} aria-hidden />
      <div className="absolute inset-y-0 right-0 flex w-[min(22rem,100%-2.5rem)] flex-col overflow-y-auto border-l border-line bg-panel p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-serif text-lg font-semibold">Menu</span>
          <button ref={tombolTutup} type="button" onClick={tutup} className="ketuk inline-flex items-center justify-center rounded-lg p-2 text-ink-2 hover:bg-panel-3" aria-label="Tutup menu">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Utama" className="space-y-1">
          {MENU.map(tautan)}
          {admin && (
            <>
              <div className="px-3 pt-4 pb-1 text-xs font-semibold text-ink-3">Admin</div>
              {MENU_ADMIN.map(tautan)}
            </>
          )}
        </nav>
        <div className="mt-auto space-y-4 border-t border-line pt-4">
          <IdentitasPengguna />
          <PilihTema />
          <AksiAkun tutup={tutup} />
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  const [laci, setLaci] = useState(false);
  const tutupLaci = useCallback(() => setLaci(false), []);
  const tombolLaci = useRef<HTMLButtonElement>(null);
  const lokasi = useLocation();
  useEffect(() => setLaci(false), [lokasi.pathname]);
  return (
    <div className="min-h-screen">
      <a href="#konten" className="sr-only z-50 rounded-md bg-panel px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-panel">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-4 px-4 sm:px-8 lg:h-16">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-md">
            <LogoAutoJurnal ukuran={30} />
            <span className="font-serif text-lg font-semibold tracking-tight text-ink">AutoJurnal</span>
          </Link>
          <nav aria-label="Utama" className="ml-4 hidden items-center lg:flex">
            {MENU.map((m) => <TabNav key={m.ke} m={m} />)}
            {admin && (
              <>
                <span className="mx-2 h-5 w-px bg-line-2" aria-hidden />
                {MENU_ADMIN.map((m) => <TabNav key={m.ke} m={m} />)}
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <MenuPengguna />
            </div>
            <button
              ref={tombolLaci}
              type="button"
              onClick={() => setLaci(true)}
              aria-expanded={laci}
              className="ketuk inline-flex items-center gap-2 rounded-lg border border-line-2 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-panel-3 lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden /> Menu
            </button>
          </div>
        </div>
      </header>
      {laci && <LaciMobile tutup={tutupLaci} pemicu={tombolLaci} />}

      <main id="konten" className="mx-auto max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </main>
    </div>
  );
}
