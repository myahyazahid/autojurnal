import { ChevronDown, TriangleAlert } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { api, type Peta, type Profil } from "../lib/api";
import SchemaForm, { BAGIAN_TERBUKA_AWAL, daftarBagian } from "./SchemaForm";
import { Kartu, Kerangka, Lencana, Pesan, Tombol } from "./ui";

const SEMBUNYI = ["catatan_ekstraksi"];

export function PetaTemplate({ peta }: { peta: Peta[] }) {
  const [buka, setBuka] = useState(false);
  const id = useId();
  return (
    <Kartu className="overflow-hidden">
      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-expanded={buka}
        aria-controls={id}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-panel-2"
      >
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink">Cara sistem membaca template</span>
          <span className="text-xs text-ink-2">{peta.length} paragraf dikenali</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {buka && (
        <ul id={id} className="max-h-[520px] divide-y divide-line overflow-y-auto border-t border-line">
          {peta.map((p) => (
            <li key={p.i} className="flex gap-3 px-5 py-2.5 text-xs">
              <span className="w-28 shrink-0">
                <Lencana>{p.label}{p.level ? ` ${p.level}` : ""}</Lencana>
              </span>
              <span className="min-w-0 flex-1 break-words text-ink-2">
                <span className="font-serif text-[13px]">{p.teks}</span>
                {p.petunjuk.length > 0 && <span className="mt-0.5 block font-semibold text-ink">petunjuk: {p.petunjuk.join(" | ")}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Kartu>
  );
}

/**
 * Editor profil aturan: navigasi bagian di kiri (menempel saat digulir), form di kanan.
 * `atas` diletakkan di atas form (panel template, info AI), `bawah` di bawahnya (bilah simpan).
 */
export default function EditorProfil({ nama, setNama, deskripsi, setDeskripsi, profil, setProfil, hanyaBaca, atas, bawah }: {
  nama: string; setNama: (v: string) => void; deskripsi: string; setDeskripsi: (v: string) => void;
  profil: Profil; setProfil: (p: Profil) => void; hanyaBaca?: boolean; atas?: ReactNode; bawah?: ReactNode;
}) {
  const [skema, setSkema] = useState<Profil | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<Record<string, boolean>>(BAGIAN_TERBUKA_AWAL);
  const id = useId();
  const muatSkema = () => {
    setGalat("");
    api.skema().then(setSkema).catch((e) => setGalat(e.message));
  };
  useEffect(() => {
    muatSkema();
  }, []);
  const catatan: string[] = profil?.catatan_ekstraksi ?? [];
  const bagian: [string, string][] = [["identitas", "Identitas jurnal"], ...(skema ? daftarBagian(skema, SEMBUNYI) : [])];

  function lompat(k: string) {
    if (k !== "identitas") setBuka((b) => ({ ...b, [k]: true }));
    const halus = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById(`sek-${k}`)?.scrollIntoView({ behavior: halus ? "smooth" : "auto", block: "start" }));
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Bagian aturan" className="lg:sticky lg:top-6">
        <div className="mb-2 hidden px-3 text-xs font-medium text-ink-3 lg:block">Bagian aturan</div>
        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
          {bagian.map(([k, judul]) => (
            <li key={k} className="shrink-0">
              <button
                type="button"
                onClick={() => lompat(k)}
                className="ketuk w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap text-ink-2 transition-colors hover:bg-panel-3 hover:text-ink lg:border-0 lg:bg-transparent lg:whitespace-normal"
              >
                {judul}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        {atas}
        <Kartu as="section" className="scroll-mt-6 p-5" >
          <h2 id="sek-identitas" className="mb-4 scroll-mt-6 text-[15px] font-semibold">Identitas jurnal</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`${id}-nama`}>Nama jurnal</label>
              <input id={`${id}-nama`} className="input" value={nama} disabled={hanyaBaca} onChange={(e) => setNama(e.target.value)} placeholder="mis. Jurnal SIBC" />
            </div>
            <div>
              <label className="label" htmlFor={`${id}-ket`}>Keterangan</label>
              <input id={`${id}-ket`} className="input" value={deskripsi} disabled={hanyaBaca} onChange={(e) => setDeskripsi(e.target.value)} placeholder="mis. template April 2026" />
            </div>
          </div>
        </Kartu>
        {catatan.length > 0 && !hanyaBaca && (
          <div className="rounded-xl border border-waspada/25 bg-waspada-soft p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <TriangleAlert className="h-4 w-4 text-waspada" aria-hidden /> Catatan pembacaan template, mohon ditinjau
            </div>
            <ul className="ml-6 list-disc space-y-1 text-[13px] text-ink-2">
              {catatan.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
        {galat ? (
          <Pesan jenis="galat" judul="Form aturan tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muatSkema}>Coba lagi</Tombol>}>{galat}</Pesan>
        ) : skema ? (
          <SchemaForm skema={skema} nilai={profil} ubah={setProfil} sembunyikan={SEMBUNYI} hanyaBaca={hanyaBaca} buka={buka} setBuka={setBuka} />
        ) : (
          <div className="space-y-3" role="status" aria-label="Memuat form aturan">{[0, 1, 2].map((i) => <Kerangka key={i} className="h-14" />)}</div>
        )}
        {bawah}
      </div>
    </div>
  );
}
