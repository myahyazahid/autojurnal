import {
  BadgeCheck, BookMarked, ChevronDown, Download, FileText, Files, Heading, Layers, LayoutTemplate, ListTree, MessageSquareText,
  OctagonAlert, Pilcrow, ShieldCheck, ShieldX, Table2, Tags, TriangleAlert, Type, type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, tanggal, type Cek, type HasilScope, type Ringkasan, type Temuan } from "../lib/api";
import { Kartu, Lencana, Pesan, TautanTombol } from "./ui";

type Saring = "semua" | "wajib" | "saran" | "ai";

const IKON_KATEGORI: Record<string, LucideIcon> = {
  "Tata Letak": LayoutTemplate, Format: Type, Struktur: ListTree, Judul: Heading, Abstrak: FileText, "Kata Kunci": Tags,
  Paragraf: Pilcrow, "Tabel & Gambar": Table2, Referensi: BookMarked, Naskah: Files,
};
const ikonKategori = (k: string) => IKON_KATEGORI[k] ?? (k.startsWith("Naratif") ? MessageSquareText : Layers);

interface Masalah {
  kunci: string;
  contoh: Temuan;
  lokasi: Temuan[];
}

function kelompokkan(temuan: Temuan[]): Map<string, Masalah[]> {
  const perKategori = new Map<string, Masalah[]>();
  const indeks = new Map<string, Masalah>();
  temuan.forEach((t, i) => {
    const kunci = t.kelompok ?? `#${i}`;
    let m = indeks.get(kunci);
    if (!m) {
      m = { kunci, contoh: t, lokasi: [] };
      indeks.set(kunci, m);
      perKategori.set(t.kategori, [...(perKategori.get(t.kategori) ?? []), m]);
    }
    m.lokasi.push(t);
  });
  return perKategori;
}

function vonis(wajib: number, saran: number) {
  if (wajib === 0)
    return {
      latar: "bg-ok-soft", warna: "text-ok", ikon: BadgeCheck,
      judul: saran ? "Siap dikirim" : "Sesuai template",
      sub: saran ? `Tidak ada pelanggaran wajib. Ada ${saran} saran yang sebaiknya dicek.` : "Tidak ada temuan sama sekali.",
    };
  if (wajib <= 5)
    return { latar: "bg-waspada-soft", warna: "text-waspada", ikon: TriangleAlert, judul: "Revisi minor", sub: `${wajib} jenis pelanggaran wajib perlu diperbaiki sebelum dikirim.` };
  return { latar: "bg-brand-soft", warna: "text-brand-tinta", ikon: OctagonAlert, judul: "Perlu revisi", sub: `${wajib} jenis pelanggaran wajib. Naskah belum sesuai template.` };
}

/** Putusan kesesuaian Focus & Scope: elemen paling menonjol di halaman hasil. */
function PutusanScope({ sc, jurnalId }: { sc: HasilScope | null | undefined; jurnalId: number | null }) {
  const label = <p className="text-xs font-semibold text-ink-2">Kesesuaian Focus &amp; Scope</p>;
  if (!sc || sc.alasan_tidak_dinilai || (!sc.keputusan && !sc.galat)) {
    return (
      <section className="flex h-full flex-col justify-center rounded-xl border border-dashed border-isian bg-panel p-5">
        {label}
        <h2 className="mt-1 font-serif text-2xl leading-tight font-semibold text-ink">Scope belum dinilai</h2>
        <p className="mt-1.5 text-sm text-ink-2">{sc?.alasan_tidak_dinilai ?? "Pengecekan ini dibuat sebelum penilaian scope tersedia."}</p>
        {jurnalId != null && sc?.alasan_tidak_dinilai?.includes("belum berisi") && (
          <Link to={`/jurnal/${jurnalId}`} className="mt-3 w-fit text-sm font-semibold text-brand-tinta underline underline-offset-2">
            Isi Focus &amp; Scope di profil jurnal
          </Link>
        )}
      </section>
    );
  }
  if (sc.galat) {
    return (
      <section className="flex h-full flex-col justify-center rounded-xl border border-waspada/30 bg-waspada-soft p-5">
        {label}
        <h2 className="mt-1 flex items-center gap-2 font-serif text-2xl leading-tight font-semibold text-ink">
          <TriangleAlert className="h-5 w-5 shrink-0 text-waspada" aria-hidden /> Scope gagal dinilai
        </h2>
        <p className="mt-1.5 text-sm break-words text-ink-2">{sc.galat}</p>
      </section>
    );
  }
  const sesuai = sc.keputusan === "terima";
  const Ikon = sesuai ? ShieldCheck : ShieldX;
  return (
    <section className={`h-full rounded-xl border p-5 sm:p-6 ${sesuai ? "border-ok/30 bg-ok-soft" : "border-brand-garis bg-brand-soft"}`}>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-xs font-semibold text-ink-2">Kesesuaian Focus &amp; Scope, dinilai AI</p>
          <h2 className={`mt-1 flex items-center gap-2.5 font-serif text-[30px] leading-tight font-semibold sm:text-4xl ${sesuai ? "text-ok" : "text-brand-tinta"}`}>
            <Ikon className="h-8 w-8 shrink-0" aria-hidden />
            {sesuai ? "Sesuai scope" : "Tidak sesuai scope"}
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-ink">Rekomendasi: {sesuai ? "terima" : "tolak"}</p>
        </div>
        {sc.skor != null && (
          <div className="w-32 shrink-0">
            <div className="font-serif text-3xl font-semibold text-ink tabular-nums">{sc.skor}<span className="text-base text-ink-2">/100</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel" role="img" aria-label={`Skor kesesuaian ${sc.skor} dari 100`}>
              <div className={`h-full rounded-full ${sesuai ? "bg-ok" : "bg-brand-kuat"}`} style={{ width: `${sc.skor}%` }} />
            </div>
            <div className="mt-1 text-xs text-ink-2">skor kesesuaian</div>
          </div>
        )}
      </div>
      {sc.alasan && <p className="mt-4 text-[15px] leading-relaxed text-ink">{sc.alasan}</p>}
      {!!sc.bidang_cocok?.length && (
        <p className="mt-2.5 text-xs text-ink-2"><span className="font-semibold text-ink">Bidang yang cocok: </span>{sc.bidang_cocok.join(", ")}</p>
      )}
    </section>
  );
}

/** Putusan format & struktur dari bot, berdampingan dengan putusan scope. */
function PutusanFormat({ wajib, saran }: { wajib: number; saran: number }) {
  const v = vonis(wajib, saran);
  const Ikon = v.ikon;
  return (
    <section className={`flex h-full flex-col justify-center rounded-xl border border-line p-5 ${v.latar}`}>
      <p className="text-xs font-semibold text-ink-2">Format &amp; struktur, dicek bot</p>
      <h2 className="mt-1 flex items-center gap-2 font-serif text-2xl leading-tight font-semibold text-ink">
        <Ikon className={`h-6 w-6 shrink-0 ${v.warna}`} aria-hidden /> {v.judul}
      </h2>
      <p className="mt-1.5 text-sm text-ink-2">{v.sub}</p>
    </section>
  );
}

/** Menjawab satu pertanyaan: kategori mana yang paling banyak masalahnya. Diurutkan dari terbanyak. */
function BatangKategori({ grup }: { grup: Map<string, Masalah[]> }) {
  const baris = [...grup.entries()].map(([k, d]) => [k, d.length] as const).sort((a, b) => b[1] - a[1]);
  const maks = Math.max(1, ...baris.map(([, n]) => n));
  if (!baris.length) return null;
  return (
    <figure>
      <figcaption className="mb-3 text-sm font-semibold text-ink">Jenis masalah per kategori</figcaption>
      <ul className="space-y-2">
        {baris.map(([k, n]) => (
          <li key={k} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2rem] items-center gap-3 text-xs sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2rem]">
            <span className="truncate text-ink-2">{k}</span>
            <span className="h-2 rounded-full bg-panel-3" aria-hidden>
              <span className="block h-full rounded-full bg-brand-kuat" style={{ width: `${(n / maks) * 100}%` }} />
            </span>
            <span className="text-right font-semibold text-ink tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Ringkasan({ cek, r, grup, saranWeb }: { cek: Cek; r: Ringkasan; grup: Map<string, Masalah[]>; saranWeb: number }) {
  const st = cek.statistik;
  const angka: [string, number | string, boolean][] = [
    ["wajib diperbaiki", r.wajib, true],
    ["saran / cek manual", r.saran, false],
    ["saran AI", cek.pakai_ai ? r.ai : "tidak dipakai", false],
    ["ditandai di naskah", r.di_word ?? r.kemunculan, false],
  ];
  const fakta = st
    ? [
        `±${st.kata_naskah.toLocaleString("id-ID")} kata`,
        st.halaman != null ? `${st.halaman} halaman` : null,
        st.kata_abstrak != null ? `abstrak ${st.kata_abstrak} kata` : null,
        `${st.jumlah_referensi} referensi`,
        `${st.jumlah_tabel} tabel`,
        `${st.jumlah_gambar} gambar`,
        st.gaya_sitasi_terdeteksi ? `sitasi ${st.gaya_sitasi_terdeteksi === "numerik" ? "numerik [1]" : "nama-tahun"}` : null,
      ].filter(Boolean)
    : [];
  return (
    <Kartu className="overflow-hidden">
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {angka.map(([label, nilai, utama]) => (
          <div key={label} className="bg-panel px-5 py-3.5">
            <dt className="text-xs text-ink-2">{label}</dt>
            <dd className={`mt-0.5 font-serif font-semibold tabular-nums ${
              typeof nilai === "string" ? "text-sm leading-8 text-ink-2" : utama && r.wajib > 0 ? "text-2xl text-brand-tinta" : "text-2xl text-ink"
            }`}>
              {nilai}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-5 p-5">
        <BatangKategori grup={grup} />
        {fakta.length > 0 && (
          <div className="border-t border-line pt-4 text-xs leading-relaxed text-ink-2">
            <p><span className="font-semibold text-ink">Naskah: </span>{fakta.join(" · ")}</p>
            {st && st.judul_bagian.length > 0 && <p className="mt-1"><span className="font-semibold text-ink">Struktur: </span>{st.judul_bagian.join(" → ")}</p>}
          </div>
        )}
        {(saranWeb > 0 || cek.penulis_komentar) && (
          <div className="space-y-2">
            {saranWeb > 0 && (
              <p className="rounded-md bg-waspada-soft px-3.5 py-2.5 text-xs text-waspada">
                {saranWeb} temuan saran hanya tampil di sini sebagai catatan Anda, tidak ditulis ke naskah Word.
              </p>
            )}
            {cek.penulis_komentar && (
              <p className="rounded-md bg-panel-2 px-3.5 py-2.5 text-xs text-ink-2">
                Komentar di Word ditulis atas nama <b className="text-ink">{cek.penulis_komentar}</b>.
              </p>
            )}
          </div>
        )}
      </div>
    </Kartu>
  );
}

function BarisMasalah({ m }: { m: Masalah }) {
  const [buka, setBuka] = useState(false);
  const id = useId();
  const t = m.contoh;
  const banyak = m.lokasi.length > 1;
  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-ink">{t.pesan}</p>
          {!banyak && t.cuplikan && <p className="mt-1 truncate font-serif text-[13px] text-ink-2">“{t.cuplikan}”</p>}
          {banyak && (
            <button
              type="button"
              onClick={() => setBuka(!buka)}
              aria-expanded={buka}
              aria-controls={id}
              className="ketuk mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-tinta underline-offset-2 hover:underline"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden />
              {buka ? "Sembunyikan" : "Lihat"} {m.lokasi.length} lokasi
            </button>
          )}
          {buka && (
            <ul id={id} className="mt-2 space-y-1.5">
              {m.lokasi.map((l, i) => (
                <li key={i} className="truncate text-xs text-ink-2">
                  {l.pesan !== t.pesan && <span className="text-ink">{l.pesan}: </span>}
                  <span className="font-serif">“{l.cuplikan ?? "tingkat dokumen"}”</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {banyak && <span className="text-xs font-semibold text-ink-2 tabular-nums">{m.lokasi.length}×</span>}
          <Lencana jenis={t.sumber === "ai" ? "ai" : t.tingkat}>{t.sumber === "ai" ? "AI" : t.tingkat === "wajib" ? "Wajib" : "Saran"}</Lencana>
        </div>
      </div>
    </li>
  );
}

function KartuKategori({ kategori, daftar, bukaAwal }: { kategori: string; daftar: Masalah[]; bukaAwal: boolean }) {
  const [buka, setBuka] = useState(bukaAwal);
  const id = useId();
  const Ikon = ikonKategori(kategori);
  const wajib = daftar.filter((m) => m.contoh.tingkat === "wajib" && m.contoh.sumber === "bot").length;
  return (
    <Kartu className="overflow-hidden">
      <h3>
        <button
          type="button"
          onClick={() => setBuka(!buka)}
          aria-expanded={buka}
          aria-controls={id}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-panel-2"
        >
          <Ikon className="h-[18px] w-[18px] shrink-0 text-ink-2" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{kategori}</span>
          {wajib > 0 && <Lencana jenis="wajib">{wajib} wajib</Lencana>}
          <span className="hidden text-xs text-ink-2 sm:inline">{daftar.length} masalah</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-2 transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h3>
      {buka && (
        <ul id={id} className="divide-y divide-line border-t border-line px-4">
          {daftar.map((m) => <BarisMasalah key={m.kunci} m={m} />)}
        </ul>
      )}
    </Kartu>
  );
}

export default function HasilCek({ cek }: { cek: Cek }) {
  const [saring, setSaring] = useState<Saring>("semua");
  const temuan = useMemo(() => cek.temuan ?? [], [cek.temuan]);
  const tersaring = useMemo(
    () => temuan.filter((t) => (saring === "semua" ? true : saring === "ai" ? t.sumber === "ai" : t.sumber === "bot" && t.tingkat === saring)),
    [temuan, saring],
  );
  const grup = useMemo(() => kelompokkan(tersaring), [tersaring]);
  const semuaGrup = useMemo(() => kelompokkan(temuan), [temuan]);
  const r = cek.ringkasan;
  const saranWeb = temuan.filter((t) => t.tingkat === "saran" && t.sumber === "bot" && t.ditulis === false).length;

  if (cek.status === "gagal") return <Pesan jenis="galat" judul={`Gagal memeriksa ${cek.nama_file}`}>{cek.pesan_galat}</Pesan>;

  const hitung = { semua: r?.masalah ?? 0, wajib: r?.wajib ?? 0, saran: r?.saran ?? 0, ai: r?.ai ?? 0 };
  const opsiSaring = (["semua", "wajib", "saran", "ai"] as Saring[]).filter((s) => s !== "ai" || cek.pakai_ai);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold break-words text-ink">{cek.nama_file}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
            <span>{cek.jurnal_nama}</span>
            <span aria-hidden>·</span>
            <span>{tanggal(cek.dibuat)}</span>
            {cek.pakai_ai && <Lencana jenis="ai">dengan AI</Lencana>}
          </div>
        </div>
        {cek.file_tersedia ? (
          <TautanTombol href={api.urlUnduh(cek.id)} varian="utama" ikon={Download}>Unduh .docx berkomentar</TautanTombol>
        ) : (
          <p className="text-xs text-ink-2">Berkas hasil sudah dihapus otomatis. Ringkasannya tetap di sini.</p>
        )}
      </div>

      {r && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <PutusanScope sc={cek.scope} jurnalId={cek.jurnal_id} />
          <PutusanFormat wajib={r.wajib} saran={r.saran} />
        </div>
      )}
      {cek.galat_ai && <Pesan jenis="peringatan" judul="Pengecekan AI gagal, hasil bot tetap lengkap">{cek.galat_ai}</Pesan>}
      {r && <Ringkasan cek={cek} r={r} grup={semuaGrup} saranWeb={saranWeb} />}

      <div role="group" aria-label="Saring temuan" className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1">
        {opsiSaring.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={saring === s}
            onClick={() => setSaring(s)}
            className={`ketuk inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              saring === s ? "bg-ink text-canvas" : "text-ink-2 hover:bg-panel-3 hover:text-ink"
            }`}
          >
            {{ semua: "Semua", wajib: "Wajib", saran: "Saran", ai: "AI" }[s]}
            <span className="tabular-nums opacity-80">{hitung[s]}</span>
          </button>
        ))}
      </div>

      {grup.size === 0 ? (
        <Pesan jenis="sukses" judul={saring === "semua" ? "Tidak ada temuan." : "Tidak ada temuan pada saringan ini."} />
      ) : (
        <div className="space-y-3">
          {[...grup.entries()].map(([kategori, daftar], i) => (
            <KartuKategori key={kategori + saring} kategori={kategori} daftar={daftar} bukaAwal={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
