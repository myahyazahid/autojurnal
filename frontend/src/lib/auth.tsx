import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, SESI_HABIS, type Pengguna } from "./api";

interface NilaiAuth {
  pengguna: Pengguna | null;
  memuat: boolean;
  setPengguna: (p: Pengguna | null) => void;
  muatUlang: () => Promise<void>;
  keluar: () => Promise<void>;
}

const Konteks = createContext<NilaiAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pengguna, setPengguna] = useState<Pengguna | null>(null);
  const [memuat, setMemuat] = useState(true);

  const muatUlang = useCallback(async () => {
    try {
      setPengguna(await api.saya());
    } catch {
      setPengguna(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muatUlang();
    const habis = () => setPengguna(null);
    window.addEventListener(SESI_HABIS, habis);
    return () => window.removeEventListener(SESI_HABIS, habis);
  }, [muatUlang]);

  const keluar = useCallback(async () => {
    await api.keluar().catch(() => undefined);
    setPengguna(null);
  }, []);

  return <Konteks.Provider value={{ pengguna, memuat, setPengguna, muatUlang, keluar }}>{children}</Konteks.Provider>;
}

export function useAuth(): NilaiAuth {
  const k = useContext(Konteks);
  if (!k) throw new Error("useAuth harus di dalam AuthProvider");
  return k;
}

export function namaDepan(p: Pengguna | null): string {
  return (p?.nama || p?.email.split("@")[0] || "").split(" ")[0];
}
