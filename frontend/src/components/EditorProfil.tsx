import { ChevronDown, ScanText, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Peta, type Profil } from "../lib/api";
import SchemaForm from "./SchemaForm";
import { Kartu, Kerangka, Lencana } from "./ui";

const WARNA_PERAN: Record<string, "info" | "sukses" | "saran" | "ai" | "netral" | "wajib"> = {
  judul: "info", judul_inggris: "info", judul_bagian: "sukses", sub_judul: "sukses", abstrak: "ai", abstrak_inggris: "ai",
  kata_kunci: "ai", kata_kunci_inggris: "ai", judul_tabel: "saran", judul_gambar: "saran", daftar_pustaka: "wajib",
};

export function PetaTemplate({ peta }: { peta: Peta[] }) {
  const [buka, setBuka] = useState(false);
  return (
    <Kartu className="overflow-hidden">
      <button type="button" onClick={() => setBuka(!buka)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-panel-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><ScanText className="h-[18px] w-[18px]" /></span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-ink">Cara sistem membaca template</span>
          <span className="text-xs text-ink-3">{peta.length} paragraf dikenali</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-ink-3 transition ${buka ? "rotate-180" : ""}`} />
      </button>
      {buka && (
        <ul className="max-h-[520px] divide-y divide-line overflow-y-auto border-t border-line">
          {peta.map((p) => (
            <li key={p.i} className="flex gap-3 px-4 py-2.5 text-xs">
              <span className="w-28 shrink-0">
                <Lencana jenis={WARNA_PERAN[p.peran] ?? "netral"}>{p.label}{p.level ? ` ${p.level}` : ""}</Lencana>
              </span>
              <span className="min-w-0 flex-1 text-ink-2">
                {p.teks}
                {p.petunjuk.length > 0 && <span className="mt-0.5 block font-medium text-brand">petunjuk: {p.petunjuk.join(" | ")}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Kartu>
  );
}

export default function EditorProfil({ nama, setNama, deskripsi, setDeskripsi, profil, setProfil, hanyaBaca }: {
  nama: string; setNama: (v: string) => void; deskripsi: string; setDeskripsi: (v: string) => void;
  profil: Profil; setProfil: (p: Profil) => void; hanyaBaca?: boolean;
}) {
  const [skema, setSkema] = useState<Profil | null>(null);
  useEffect(() => {
    api.skema().then(setSkema);
  }, []);
  const catatan: string[] = profil?.catatan_ekstraksi ?? [];
  return (
    <div className="space-y-4">
      <Kartu className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label">Nama jurnal</label>
          <input className="input" value={nama} disabled={hanyaBaca} onChange={(e) => setNama(e.target.value)} placeholder="mis. Jurnal SIBC" />
        </div>
        <div>
          <label className="label">Keterangan</label>
          <input className="input" value={deskripsi} disabled={hanyaBaca} onChange={(e) => setDeskripsi(e.target.value)} placeholder="mis. template April 2026" />
        </div>
      </Kartu>
      {catatan.length > 0 && !hanyaBaca && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
            <TriangleAlert className="h-4 w-4 text-amber-500" /> Catatan pembacaan template — mohon ditinjau
          </div>
          <ul className="ml-6 list-disc space-y-1 text-[13px] text-amber-900/90 dark:text-amber-100/85">
            {catatan.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {skema ? (
        <SchemaForm skema={skema} nilai={profil} ubah={setProfil} sembunyikan={["catatan_ekstraksi"]} hanyaBaca={hanyaBaca} />
      ) : (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Kerangka key={i} className="h-14" />)}</div>
      )}
    </div>
  );
}
