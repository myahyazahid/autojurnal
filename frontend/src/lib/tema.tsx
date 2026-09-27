import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Tema = "terang" | "gelap" | "sistem";

const Konteks = createContext<{ tema: Tema; setTema: (t: Tema) => void }>({ tema: "terang", setTema: () => undefined });

function baca(): Tema {
  try {
    const t = localStorage.getItem("aj_tema");
    if (t === "terang" || t === "gelap" || t === "sistem") return t;
  } catch {
    /* penyimpanan diblokir */
  }
  return "terang";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(baca);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const terapkan = () =>
      document.documentElement.classList.toggle("dark", tema === "gelap" || (tema === "sistem" && mq.matches));
    terapkan();
    mq.addEventListener("change", terapkan);
    return () => mq.removeEventListener("change", terapkan);
  }, [tema]);

  const setTema = (t: Tema) => {
    setTemaState(t);
    try {
      localStorage.setItem("aj_tema", t);
    } catch {
      /* abaikan */
    }
  };
  return <Konteks.Provider value={{ tema, setTema }}>{children}</Konteks.Provider>;
}

export const useTema = () => useContext(Konteks);
