/* Form yang dibangkitkan dari JSON Schema profil (Pydantic). Tambah jenis aturan di backend -> form ikut. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";

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

function Kontrol({ s: s0, akar, nilai, ubah, kecil, kunci, saran }: {
  s: S; akar: S; nilai: any; ubah: (v: any) => void; kecil?: boolean; kunci?: string; saran?: string[];
}) {
  const { s, nullable } = bukaNullable(s0, akar);
  const cls = kecil ? "input-sm" : "input";
  if (s.enum) {
    return (
      <select className={cls} value={nilai ?? ""} onChange={(e) => ubah(e.target.value === "" ? null : e.target.value)}>
        {nullable && <option value="">{kecil ? "–" : "— tidak dicek —"}</option>}
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
          className={cls}
          value={nilai === null || nilai === undefined ? "" : nilai ? "1" : "0"}
          onChange={(e) => ubah(e.target.value === "" ? null : e.target.value === "1")}
        >
          <option value="">{kecil ? "–" : "— tidak dicek —"}</option>
          <option value="1">Ya</option>
          <option value="0">Tidak</option>
        </select>
      );
    }
    return (
      <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={!!nilai} onChange={(e) => ubah(e.target.checked)} />
    );
  }
  if (s.type === "number" || s.type === "integer") {
    return (
      <input
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
    return <InputTag nilai={nilai ?? []} ubah={ubah} />;
  }
  const listId = kunci === "font" ? "daftar-font" : saran?.length ? `saran-${kunci}` : undefined;
  if (kunci === "aturan" || s.format === "textarea") {
    return (
      <textarea className={cls} rows={s.format === "textarea" ? 10 : 2} value={nilai ?? ""} onChange={(e) => ubah(e.target.value)}
        placeholder={s.format === "textarea" ? "Tempel teks Focus and Scope dari situs jurnal…" : undefined} />
    );
  }
  return (
    <>
      <input
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

function InputTag({ nilai, ubah }: { nilai: string[]; ubah: (v: string[]) => void }) {
  const [teks, setTeks] = useState("");
  const tambah = () => {
    const baru = teks.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    if (baru.length) ubah([...nilai, ...baru.filter((b) => !nilai.includes(b))]);
    setTeks("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line-2 bg-panel px-2 py-1.5">
      {nilai.map((t, i) => (
        <span key={t + i} className="inline-flex items-center gap-1 rounded-md bg-panel-3 px-2 py-0.5 text-xs text-ink-2">
          {t}
          <button type="button" className="text-ink-3 hover:text-rose-500" onClick={() => ubah(nilai.filter((_, j) => j !== i))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
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
            <th className="sticky left-0 z-10 bg-panel px-2 py-2 text-left font-semibold text-ink-2">Elemen</th>
            {kolom.map(([k, ks]) => (
              <th key={k} className="px-1 py-2 text-left font-semibold text-ink-2" title={ks.description}>
                {ks.title ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map(([bk, bs]) => (
            <tr key={bk} className="odd:bg-panel-2">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-2 py-1.5 font-medium text-ink-2">
                {selesaikan(bs, akar).title ?? bs.title ?? bk}
              </td>
              {kolom.map(([k, ks]) => (
                <td key={k} className={`px-1 py-1 ${k === "font" ? "min-w-36" : k === "perataan" ? "min-w-32" : "min-w-20"}`}>
                  <Kontrol
                    s={ks}
                    akar={akar}
                    kecil
                    kunci={k}
                    nilai={nilai?.[bk]?.[k]}
                    ubah={(v) => ubah({ ...nilai, [bk]: { ...(nilai?.[bk] ?? {}), [k]: v } })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="daftar-font">
        {FONT_UMUM.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <p className="mt-2 px-1 text-xs text-ink-3">“–” artinya properti itu tidak dicek untuk elemen tersebut.</p>
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
            <span className="text-xs font-semibold text-ink-3">#{i + 1}</span>
            <div className="flex gap-1">
              <button type="button" className="rounded px-1.5 text-ink-3 hover:bg-panel-3" onClick={() => geser(i, -1)} title="Naik">↑</button>
              <button type="button" className="rounded px-1.5 text-ink-3 hover:bg-panel-3" onClick={() => geser(i, 1)} title="Turun">↓</button>
              <button type="button" className="rounded px-1.5 text-rose-500 hover:bg-rose-500/10" onClick={() => ubah(nilai.filter((_, j) => j !== i))} title="Hapus">
                Hapus
              </button>
            </div>
          </div>
          <Objek s={itemS} akar={akar} nilai={item} ubah={(v) => ubah(nilai.map((x, j) => (j === i ? v : x)))} saran={saran} />
        </div>
      ))}
      <button
        type="button"
        className="w-full rounded-lg border border-dashed border-line-2 py-2 text-sm text-ink-2 hover:border-brand hover:text-brand"
        onClick={() => ubah([...nilai, nilaiBawaan(itemS, akar)])}
      >
        + Tambah
      </button>
    </div>
  );
}

function Objek({ s, akar, nilai, ubah, saran }: { s: S; akar: S; nilai: any; ubah: (v: any) => void; saran?: Record<string, string[]> }) {
  const entri = Object.entries(s.properties ?? {}) as [string, S][];
  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {entri.map(([k, ks0]) => {
        const { s: ks } = bukaNullable(ks0, akar);
        const lebar = ks.type === "array" || k === "aturan" || ks.type === "object" || ks.format === "textarea";
        const v = nilai?.[k];
        const set = (x: any) => ubah({ ...nilai, [k]: x });
        return (
          <div key={k} className={lebar ? "sm:col-span-2" : ""}>
            {ks.type === "boolean" && !bukaNullable(ks0, akar).nullable ? (
              <label className="flex items-center gap-2 pt-1 text-sm text-ink-2">
                <Kontrol s={ks0} akar={akar} nilai={v} ubah={set} kunci={k} />
                {ks.title ?? k}
              </label>
            ) : (
              <>
                <label className="label">{ks.title ?? k}</label>
                {ks.type === "array" && selesaikan(ks.items, akar).type === "object" ? (
                  <DaftarObjek s={ks} akar={akar} nilai={v ?? []} ubah={set} saran={saran} />
                ) : ks.type === "object" ? (
                  <Objek s={ks} akar={akar} nilai={v ?? {}} ubah={set} saran={saran} />
                ) : (
                  <Kontrol s={ks0} akar={akar} nilai={v} ubah={set} kunci={k} saran={saran?.[k]} />
                )}
              </>
            )}
            {ks.description && <p className="mt-1 text-xs text-ink-3">{ks.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- akar: tiap bagian profil jadi kartu yang bisa dilipat ---------------- */

export default function SchemaForm({ skema, nilai, ubah, sembunyikan = [], hanyaBaca }: {
  skema: S; nilai: any; ubah: (v: any) => void; sembunyikan?: string[]; hanyaBaca?: boolean;
}) {
  const [buka, setBuka] = useState<Record<string, boolean>>({ scope: true, tata_letak: true, format: true, struktur: true });
  const bagianJudul: string[] = (nilai?.struktur?.bagian ?? []).map((b: any) => b.judul).filter(Boolean);
  const saran = { bagian: ["Abstrak", "Seluruh naskah", ...bagianJudul] };
  return (
    <div className="space-y-3">
      {(Object.entries(skema.properties ?? {}) as [string, S][])
        .filter(([k]) => !sembunyikan.includes(k))
        .map(([k, ks0]) => {
          const x = bukaNullable(ks0, skema).s;
          const terbuka = !!buka[k];
          const v = nilai?.[k];
          const set = (b: any) => ubah({ ...nilai, [k]: b });
          return (
            <div key={k} className="kartu overflow-hidden">
              <button
                type="button"
                onClick={() => setBuka({ ...buka, [k]: !terbuka })}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-panel-2"
              >
                <span>
                  <span className="font-bold text-ink">{x.title ?? k}</span>
                  {x.description && <span className="ml-2 text-xs text-ink-3">{x.description}</span>}
                </span>
                <span className={`text-ink-3 transition ${terbuka ? "rotate-180" : ""}`}>▾</span>
              </button>
              {terbuka && (
                <fieldset disabled={hanyaBaca} className="border-t border-line px-4 py-4">
                  {x.type === "array" ? (
                    <DaftarObjek s={x} akar={skema} nilai={v ?? []} ubah={set} saran={saran} />
                  ) : adalahMatriks(x, skema) ? (
                    <Matriks s={x} akar={skema} nilai={v ?? {}} ubah={set} />
                  ) : (
                    <Objek s={x} akar={skema} nilai={v ?? {}} ubah={set} saran={saran} />
                  )}
                </fieldset>
              )}
            </div>
          );
        })}
    </div>
  );
}
