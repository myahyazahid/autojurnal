import {
  BookOpen, ChevronDown, CircleUser, FileCheck2, History, LogOut, Menu, Monitor, Moon, Settings, Sun, Users, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTema, type Tema } from "../lib/tema";
import { Avatar, Lencana, LogoAutoJurnal } from "./ui";

interface Menu {
  ke: string;
  label: string;
  ikon: LucideIcon;
  akhir?: boolean;
  admin?: boolean;
}

const MENU: Menu[] = [
  { ke: "/", label: "Cek Naskah", ikon: FileCheck2, akhir: true },
  { ke: "/riwayat", label: "Riwayat", ikon: History },
  { ke: "/jurnal", label: "Profil Jurnal", ikon: BookOpen },
];
const MENU_ADMIN: Menu[] = [
  { ke: "/pengguna", label: "Pengguna", ikon: Users, admin: true },
  { ke: "/pengaturan", label: "Pengaturan", ikon: Settings, admin: true },
];

function Tautan({ m, tutup }: { m: Menu; tutup?: () => void }) {
  const Ikon = m.ikon;
  return (
    <NavLink
      to={m.ke}
      end={m.akhir}
      onClick={tutup}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
          isActive
            ? "bg-gradient-to-r from-indigo-500/25 via-violet-500/15 to-transparent text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-400 to-fuchsia-400" />}
          <Ikon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-violet-300" : "text-slate-500 group-hover:text-slate-300"}`} />
          {m.label}
        </>
      )}
    </NavLink>
  );
}

function PilihTema() {
  const { tema, setTema } = useTema();
  const opsi: [Tema, LucideIcon, string][] = [["terang", Sun, "Terang"], ["gelap", Moon, "Gelap"], ["sistem", Monitor, "Sistem"]];
  return (
    <div className="flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
      {opsi.map(([t, Ikon, label]) => (
        <button
          key={t}
          onClick={() => setTema(t)}
          title={label}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition ${
            tema === t ? "bg-white/15 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Ikon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function KartuPengguna() {
  const { pengguna, keluar } = useAuth();
  const nav = useNavigate();
  const [buka, setBuka] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const klik = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setBuka(false);
    document.addEventListener("mousedown", klik);
    return () => document.removeEventListener("mousedown", klik);
  }, []);
  if (!pengguna) return null;
  return (
    <div ref={ref} className="relative">
      {buka && (
        <div className="animasi-muncul absolute right-0 bottom-full left-0 mb-2 overflow-hidden rounded-xl border border-white/10 bg-slate-900 p-1.5 shadow-2xl">
          <button onClick={() => { setBuka(false); nav("/akun"); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            <CircleUser className="h-4 w-4" /> Akun saya
          </button>
          <button onClick={async () => { await keluar(); nav("/masuk"); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/15">
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </div>
      )}
      <button onClick={() => setBuka(!buka)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left ring-1 ring-white/10 transition hover:bg-white/5">
        <Avatar nama={pengguna.nama || pengguna.email} foto={pengguna.foto} ukuran={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{pengguna.nama || pengguna.email.split("@")[0]}</div>
          <div className="truncate text-[11px] text-slate-400">{pengguna.email}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${buka ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}

function IsiSidebar({ tutup }: { tutup?: () => void }) {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#0b0d1d] px-4 py-5">
      <div className="pointer-events-none absolute -top-24 -left-20 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -right-24 h-56 w-56 rounded-full bg-fuchsia-600/15 blur-3xl" />
      <div className="relative mb-8 flex items-center gap-3 px-1">
        <LogoAutoJurnal ukuran={40} />
        <div>
          <div className="text-[17px] font-extrabold tracking-tight text-white">AutoJurnal</div>
          <div className="text-[11px] font-medium text-slate-400">Cek naskah sesuai template</div>
        </div>
      </div>
      <nav className="relative space-y-1">
        <div className="mb-2 px-3 text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">Menu</div>
        {MENU.map((m) => <Tautan key={m.ke} m={m} tutup={tutup} />)}
        {admin && (
          <>
            <div className="mt-6 mb-2 flex items-center gap-2 px-3 text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">
              Admin <span className="h-px flex-1 bg-white/10" />
            </div>
            {MENU_ADMIN.map((m) => <Tautan key={m.ke} m={m} tutup={tutup} />)}
          </>
        )}
      </nav>
      <div className="relative mt-auto space-y-3">
        {pengguna && (
          <div className="px-1">
            <Lencana jenis={admin ? "ai" : "netral"}>{admin ? "Admin" : "Pengguna"}</Lencana>
          </div>
        )}
        <PilihTema />
        <KartuPengguna />
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [laci, setLaci] = useState(false);
  const lokasi = useLocation();
  useEffect(() => setLaci(false), [lokasi.pathname]);
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">
        <IsiSidebar />
      </aside>

      {/* mobile */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/85 px-4 py-3 backdrop-blur-lg lg:hidden">
        <button onClick={() => setLaci(true)} className="rounded-lg p-1.5 text-ink-2 hover:bg-panel-3" aria-label="Buka menu">
          <Menu className="h-5 w-5" />
        </button>
        <LogoAutoJurnal ukuran={30} />
        <span className="font-extrabold tracking-tight">AutoJurnal</span>
      </header>
      {laci && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLaci(false)} />
          <div className="animasi-muncul absolute inset-y-0 left-0 w-[280px] shadow-2xl">
            <IsiSidebar tutup={() => setLaci(false)} />
            <button onClick={() => setLaci(false)} className="absolute top-4 right-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="Tutup menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <main className="relative lg:pl-[264px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--c-brand)_12%,transparent),transparent_70%)]" />
        <div key={lokasi.pathname} className="animasi-muncul relative mx-auto max-w-[1360px] px-4 py-7 sm:px-8 sm:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}
