/* Form yang dibangkitkan dari JSON Schema profil (Pydantic). Tambah jenis aturan di backend -> form ikut. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

type S = any;

const LABEL_ENUM: Record<string, string> = {
  kiri: "Kiri",
  tengah: "Tengah",
  kanan: "Kanan",
  rata_kanan_kiri: "Rata kanan-kiri",
  potret: "Potret",
  lanskap: "Lanskap",
  wajib: "Wajib",
  dilarang: "Dilarang",
  opsional: "Opsional",
  tidak_boleh: "Tidak boleh",
  otomatis: "Otomatis (deteksi)",
  penulis_tahun: "Nama-tahun (APA/Harvard)",
  numerik: "Numerik [1] (IEEE)",
  abjad: "Urut abjad",
  kemunculan: "Urut kemunculan",
  atas: "Di atas",
  bawah: "Di bawah",
  ";": "Titik koma ( ; )",
  ",": "Koma ( , )",
  horizontal: "Garis horizontal saja",
  grid: "Grid penuh (semua garis)",
  tanpa_garis: "Tanpa garis",
  indonesia: "Bahasa Indonesia",
  inggris: "Bahasa Inggris",
  disarankan: "Disarankan",
};
const FONT_UMUM = ["Times New Roman", "Arial", "Calibri", "Cambria", "Book Antiqua", "Georgia", "Garamond", "Tahoma"];

/** Ikuti $ref, tapi pertahankan title/description yang ditulis di samping $ref (milik field). */
function selesaikan(s: S, akar: S): S {
  let x = s;
  let batas = 10;
  while (x && x.$ref && batas--) {
    const target = akar.$defs?.[x.$ref.split("/").pop()] ?? {};
    x = { ...target, title: x.title ?? target.title, description: x.description ?? target.description };
  }
  return x ?? {};
}

function bukaNullable(s: S, akar: S): { s: S; nullable: boolean } {
  const x = selesaikan(s, akar);
  if (x.anyOf) {
    const bukanNull = x.anyOf.filter((a: S) => a.type !== "null");
    const nullable = bukanNull.length < x.anyOf.length;
    return { s: { ...selesaikan(bukanNull[0], akar), title: x.title, description: x.description, default: x.default }, nullable };
  }
  return { s: x, nullable: false };
}

export function nilaiBawaan(s: S, akar: S): any {
  const { s: x, nullable } = bukaNullable(s, akar);
  if (x.default !== undefined) return structuredClone(x.default);
  if (nullable) return null;
  if (x.type === "object") {
    const o: any = {};
    for (const [k, v] of Object.entries(x.properties ?? {})) o[k] = nilaiBawaan(v, akar);
    return o;
  }
  if (x.type === "array") return [];
  if (x.type === "boolean") return false;
  if (x.type === "number" || x.type === "integer") return 0;
  return "";
}

/* ---------------- kontrol dasar ---------------- */

function Kontrol({ s: s0, akar, nilai, ubah, kecil, kunci, saran, id, labelAria }: {
  s: S; akar: S; nilai: any; ubah: (v: any) => void; kecil?: boolean; kunci?: string; saran?: string[]; id?: string; labelAria?: string;
}) {
  const { s, nullable } = bukaNullable(s0, akar);
  const cls = kecil ? "input-sm" : "input";
  const a11y = { id, "aria-label": labelAria };
  if (s.enum) {
    return (
      <select {...a11y} className={cls} value={nilai ?? ""} onChange={(e) => ubah(e.target.value === "" ? null : e.target.value)}>
        {nullable && <option value="">{kecil ? "–" : "(tidak dicek)"}</option>}
        {s.enum.map((v: string) => (
          <option key={v} value={v}>
            {LABEL_ENUM[v] ?? v}
          </option>
        ))}
      </select>
    );
  }
  if (s.type === "boolean") {
    if (nullable) {
      return (
        <select
          {...a11y}
          className={cls}
          value={nilai === null || nilai === undefined ? "" : nilai ? "1" : "0"}
          onChange={(e) => ubah(e.target.value === "" ? null : e.target.value === "1")}
        >
          <option value="">{kecil ? "–" : "(tidak dicek)"}</option>
          <option value="1">Ya</option>
          <option value="0">Tidak</option>
        </select>
      );
    }
    return (
      <input {...a11y} type="checkbox" className="h-4 w-4 accent-brand" checked={!!nilai} onChange={(e) => ubah(e.target.checked)} />
    );
  }
  if (s.type === "number" || s.type === "integer") {
    return (
      <input
        {...a11y}
        className={cls}
        type="number"
        step={s.type === "integer" ? 1 : "any"}
        value={nilai ?? ""}
        placeholder={nullable ? (kecil ? "–" : "tidak dicek") : ""}
        onChange={(e) => {
          const t = e.target.value;
          if (t === "") return ubah(nullable ? null : 0);
          const n = s.type === "integer" ? parseInt(t, 10) : parseFloat(t);
          ubah(Number.isNaN(n) ? null : n);
        }}
      />
    );
  }
  if (s.type === "array" && selesaikan(s.items, akar).type === "string") {
    return <InputTag nilai={nilai ?? []} ubah={ubah} id={id} />;
  }
  const listId = kunci === "font" ? "daftar-font" : saran?.length ? `saran-${kunci}` : undefined;
  if (kunci === "aturan" || s.format === "textarea") {
    return (
      <textarea {...a11y} className={cls} rows={s.format === "textarea" ? 10 : 2} value={nilai ?? ""} onChange={(e) => ubah(e.target.value)}
        placeholder={s.format === "textarea" ? "Tempel teks Focus and Scope dari situs jurnal…" : undefined} />
    );
  }
  return (
    <>
      <input
        {...a11y}
        className={cls}
        value={nilai ?? ""}
        list={listId}
        placeholder={nullable ? (kecil ? "–" : "tidak dicek") : ""}
        onChange={(e) => ubah(e.target.value === "" && nullable ? null : e.target.value)}
      />
      {saran?.length ? (
        <datalist id={listId}>
          {saran.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}

function InputTag({ nilai, ubah, id }: { nilai: string[]; ubah: (v: string[]) => void; id?: string }) {
  const [teks, setTeks] = useState("");
  const tambah = () => {
    const baru = teks.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    if (baru.length) ubah([...nilai, ...baru.filter((b) => !nilai.includes(b))]);
    setTeks("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-isian bg-panel px-2 py-1.5 has-[input:focus-visible]:border-brand">
      {nilai.map((t, i) => (
        <span key={t + i} className="inline-flex items-center gap-1 rounded-md bg-panel-3 py-0.5 pr-0.5 pl-2 text-xs text-ink-2">
          {t}
          <button type="button" aria-label={`Hapus ${t}`} className="rounded px-1 text-ink-2 hover:bg-line hover:text-bahaya" onClick={() => ubah(nilai.filter((_, j) => j !== i))}>
            <span aria-hidden>×</span>
          </button>
        </span>
      ))}
      <input
        id={id}
        className="min-w-24 flex-1 rounded-sm border-0 bg-transparent px-1 py-0.5 text-sm"
        value={teks}
        placeholder={nilai.length ? "" : "ketik lalu Enter"}
        onChange={(e) => setTeks(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            tambah();
          } else if (e.key === "Backspace" && !teks && nilai.length) ubah(nilai.slice(0, -1));
        }}
        onBlur={tambah}
      />
    </div>
  );
}

/* ---------------- objek, matriks, daftar ---------------- */

function adalahMatriks(s: S, akar: S): boolean {
  const props = Object.values(s.properties ?? {}) as S[];
  if (props.length < 3) return false;
  const ref = props[0]?.$ref;
  return !!ref && props.every((p) => p.$ref === ref) && !!selesaikan(props[0], akar).properties;
}

function Matriks({ s, akar, nilai, ubah }: { s: S; akar: S; nilai: any; ubah: (v: any) => void }) {
  const baris = Object.entries(s.properties) as [string, S][];
  const kolomS = selesaikan(baris[0][1], akar);
  const kolom = Object.entries(kolomS.properties) as [string, S][];
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-panel px-2 py-2 text-left font-semibold text-ink-2">Elemen</th>
            {kolom.map(([k, ks]) => (
              <th key={k} className="px-1 py-2 text-left font-semibold text-ink-2" title={ks.description}>
                {ks.title ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map(([bk, bs]) => {
            const judulBaris = selesaikan(bs, akar).title ?? bs.title ?? bk;
            return (
              <tr key={bk} className="bg-panel odd:bg-panel-2">
                <th scope="row" className="sticky left-0 z-10 bg-inherit px-2 py-1.5 text-left font-medium whitespace-nowrap text-ink-2">
                  {judulBaris}
                </th>
                {kolom.map(([k, ks]) => (
                  <td key={k} className={`px-1 py-1 ${k === "font" ? "min-w-36" : k === "perataan" ? "min-w-32" : "min-w-20"}`}>
                    <Kontrol
                      s={ks}
                      akar={akar}
                      kecil
                      kunci={k}
                      labelAria={`${judulBaris}: ${ks.title ?? k}`}
                      nilai={nilai?.[bk]?.[k]}
                      ubah={(v) => ubah({ ...nilai, [bk]: { ...(nilai?.[bk] ?? {}), [k]: v } })}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <datalist id="daftar-font">
        {FONT_UMUM.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <p className="mt-2 px-1 text-xs text-ink-2">“–” artinya properti itu tidak dicek untuk elemen tersebut.</p>
    </div>
  );
}

function DaftarObjek({ s, akar, nilai, ubah, saran }: { s: S; akar: S; nilai: any[]; ubah: (v: any[]) => void; saran?: Record<string, string[]> }) {
  const itemS = selesaikan(s.items, akar);
  const geser = (i: number, d: number) => {
    const b = [...nilai];
    const j = i + d;
    if (j < 0 || j >= b.length) return;
    [b[i], b[j]] = [b[j], b[i]];
    ubah(b);
  };
  return (
    <div className="space-y-3">
      {nilai.map((item, i) => (
        <div key={i} className="rounded-lg border border-line bg-panel-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-2">#{i + 1}</span>
            <div className="flex gap-1">
              <button type="button" className="ketuk rounded-md px-2 py-0.5 text-ink-2 hover:bg-panel-3 disabled:opacity-40" disabled={i === 0}
                onClick={() => geser(i, -1)} aria-label={`Naikkan butir ${i + 1}`} title="Naik"><span aria-hidden>↑</span></button>
              <button type="button" className="ketuk rounded-md px-2 py-0.5 text-ink-2 hover:bg-panel-3 disabled:opacity-40" disabled={i === nilai.length - 1}
                onClick={() => geser(i, 1)} aria-label={`Turunkan butir ${i + 1}`} title="Turun"><span aria-hidden>↓</span></button>
              <button type="button" className="ketuk rounded-md px-2 py-0.5 text-xs font-semibold text-bahaya hover:bg-bahaya-soft"
                onClick={() => ubah(nilai.filter((_, j) => j !== i))} aria-label={`Hapus butir ${i + 1}`}>
                Hapus
              </button>
            </div>
          </div>
          <Objek s={itemS} akar={akar} nilai={item} ubah={(v) => ubah(nilai.map((x, j) => (j === i ? v : x)))} saran={saran} />
        </div>
      ))}
      <button
        type="button"
        className="ketuk w-full rounded-lg border border-dashed border-isian py-2 text-sm font-semibold text-ink-2 hover:border-brand hover:text-brand-tinta"
        onClick={() => ubah([...nilai, nilaiBawaan(itemS, akar)])}
      >
        Tambah butir
      </button>
    </div>
  );
}

function Objek({ s, akar, nilai, ubah, saran }: { s: S; akar: S; nilai: any; ubah: (v: any) => void; saran?: Record<string, string[]> }) {
  const entri = Object.entries(s.properties ?? {}) as [string, S][];
  const idDasar = useId();
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {entri.map(([k, ks0]) => {
        const { s: ks } = bukaNullable(ks0, akar);
        const lebar = ks.type === "array" || k === "aturan" || ks.type === "object" || ks.format === "textarea";
        const v = nilai?.[k];
        const set = (x: any) => ubah({ ...nilai, [k]: x });
        const id = `${idDasar}-${k}`;
        const kelompok = (ks.type === "array" && selesaikan(ks.items, akar).type === "object") || ks.type === "object";
        return (
          <div key={k} className={lebar ? "sm:col-span-2" : ""}>
            {ks.type === "boolean" && !bukaNullable(ks0, akar).nullable ? (
              <label className="flex items-center gap-2 pt-1 text-sm text-ink-2">
                <Kontrol s={ks0} akar={akar} nilai={v} ubah={set} kunci={k} />
                {ks.title ?? k}
              </label>
            ) : kelompok ? (
              <>
                <div className="label">{ks.title ?? k}</div>
                {ks.type === "object" ? (
                  <Objek s={ks} akar={akar} nilai={v ?? {}} ubah={set} saran={saran} />
                ) : (
                  <DaftarObjek s={ks} akar={akar} nilai={v ?? []} ubah={set} saran={saran} />
                )}
              </>
            ) : (
              <>
                <label className="label" htmlFor={id}>{ks.title ?? k}</label>
                <Kontrol s={ks0} akar={akar} nilai={v} ubah={set} kunci={k} saran={saran?.[k]} id={id} />
              </>
            )}
            {ks.description && <p className="mt-1 text-xs text-ink-2">{ks.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- akar: tiap bagian profil jadi kartu yang bisa dilipat ---------------- */

/** Daftar bagian tingkat atas (kunci + judul) untuk navigasi samping editor. */
export function daftarBagian(skema: S, sembunyikan: string[] = []): [string, string][] {
  return (Object.entries(skema.properties ?? {}) as [string, S][])
    .filter(([k]) => !sembunyikan.includes(k))
    .map(([k, ks0]) => [k, bukaNullable(ks0, skema).s.title ?? k]);
}

export const BAGIAN_TERBUKA_AWAL: Record<string, boolean> = { scope: true, tata_letak: true, format: true, struktur: true };

export default function SchemaForm({ skema, nilai, ubah, sembunyikan = [], hanyaBaca, buka, setBuka }: {
  skema: S; nilai: any; ubah: (v: any) => void; sembunyikan?: string[]; hanyaBaca?: boolean;
  buka: Record<string, boolean>; setBuka: (b: Record<string, boolean>) => void;
}) {
  const bagianJudul: string[] = (nilai?.struktur?.bagian ?? []).map((b: any) => b.judul).filter(Boolean);
  const saran = { bagian: ["Abstrak", "Seluruh naskah", ...bagianJudul] };
  return (
    <div className="space-y-4">
      {(Object.entries(skema.properties ?? {}) as [string, S][])
        .filter(([k]) => !sembunyikan.includes(k))
        .map(([k, ks0]) => {
          const x = bukaNullable(ks0, skema).s;
          const terbuka = !!buka[k];
          const v = nilai?.[k];
          const set = (b: any) => ubah({ ...nilai, [k]: b });
          return (
            <section key={k} id={`sek-${k}`} className="kartu scroll-mt-6 overflow-hidden">
              <h2>
                <button
                  type="button"
                  onClick={() => setBuka({ ...buka, [k]: !terbuka })}
                  aria-expanded={terbuka}
                  aria-controls={`bagian-${k}`}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-panel-2"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink">{x.title ?? k}</span>
                    {x.description && <span className="mt-0.5 block text-[13px] text-ink-2">{x.description}</span>}
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-ink-3 transition-transform ${terbuka ? "rotate-180" : ""}`} aria-hidden />
                </button>
              </h2>
              {terbuka && (
                <fieldset id={`bagian-${k}`} disabled={hanyaBaca} className="min-w-0 border-t border-line px-5 py-5">
                  {x.type === "array" ? (
                    <DaftarObjek s={x} akar={skema} nilai={v ?? []} ubah={set} saran={saran} />
                  ) : adalahMatriks(x, skema) ? (
                    <Matriks s={x} akar={skema} nilai={v ?? {}} ubah={set} />
                  ) : (
                    <Objek s={x} akar={skema} nilai={v ?? {}} ubah={set} saran={saran} />
                  )}
                </fieldset>
              )}
            </section>
          );
        })}
    </div>
  );
}
