import { CircleCheck, CircleX, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Jenis = "sukses" | "galat" | "info";
interface Toast {
  id: number;
  jenis: Jenis;
  judul: string;
  isi?: string;
}

const Konteks = createContext<(jenis: Jenis, judul: string, isi?: string) => void>(() => undefined);

const IKON = { sukses: CircleCheck, galat: CircleX, info: Info };
const WARNA = {
  sukses: "text-ok",
  galat: "text-bahaya",
  info: "text-ink-2",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);
  const tutup = (id: number) => setDaftar((d) => d.filter((t) => t.id !== id));
  const tampil = useCallback((jenis: Jenis, judul: string, isi?: string) => {
    const id = Date.now() + Math.random();
    setDaftar((d) => [...d.slice(-3), { id, jenis, judul, isi }]);
    setTimeout(() => tutup(id), jenis === "galat" ? 7000 : 4000);
  }, []);
  return (
    <Konteks.Provider value={tampil}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {daftar.map((t) => {
          const Ikon = IKON[t.jenis];
          return (
            <div key={t.id} className="melayang pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3.5">
              <Ikon className={`mt-0.5 h-5 w-5 shrink-0 ${WARNA[t.jenis]}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{t.judul}</div>
                {t.isi && <div className="mt-0.5 text-xs break-words text-ink-2">{t.isi}</div>}
              </div>
              <button type="button" onClick={() => tutup(t.id)} className="ketuk -m-1 inline-flex items-center justify-center rounded-md p-1 text-ink-2 hover:text-ink" aria-label="Tutup notifikasi">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </Konteks.Provider>
  );
}

export const useToast = () => useContext(Konteks);
