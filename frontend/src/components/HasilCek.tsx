import {
  BadgeCheck, BookMarked, ChevronDown, Download, FileText, Files, Heading, Layers, LayoutTemplate, Lightbulb, ListTree,
  MessageSquareText, OctagonAlert, Pilcrow, Sparkles, Table2, Tags, Target, TriangleAlert, Type, type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { api, tanggal, type Cek, type HasilScope, type Temuan } from "../lib/api";
import Donat, { PALET } from "./Donat";
import { Kartu, Lencana, Pesan, TautanTombol } from "./ui";

type Saring = "semua" | "wajib" | "saran" | "ai";

const IKON_KATEGORI: Record<string, LucideIcon> = {
  "Tata Letak": LayoutTemplate, Format: Type, Struktur: ListTree, Judul: Heading, Abstrak: FileText, "Kata Kunci": Tags,
  Paragraf: Pilcrow, "Tabel & Gambar": Table2, Referensi: BookMarked, Naskah: Files,
};
const ikonKategori = (k: string) => IKON_KATEGORI[k] ?? (k.startsWith("Naratif") ? Sparkles : Layers);

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

function Vonis({ wajib, saran }: { wajib: number; saran: number }) {
  const v =
    wajib === 0
      ? { g: "from-emerald-500 to-teal-500", i: BadgeCheck, j: saran ? "Siap dikirim" : "Sempurna — sesuai template", s: saran ? `Tidak ada pelanggaran wajib. Ada ${saran} saran yang sebaiknya dicek.` : "Tidak ada temuan sama sekali." }
      : wajib <= 5
        ? { g: "from-amber-500 to-orange-500", i: TriangleAlert, j: "Revisi minor", s: `${wajib} jenis pelanggaran wajib perlu diperbaiki sebelum dikirim.` }
        : { g: "from-rose-500 to-pink-600", i: OctagonAlert, j: "Perlu revisi", s: `${wajib} jenis pelanggaran wajib — naskah belum sesuai template.` };
  const Ikon = v.i;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${v.g} p-5 text-white shadow-lg`}>
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30"><Ikon className="h-6 w-6" /></span>
        <div>
          <div className="text-lg font-extrabold tracking-tight">{v.j}</div>
          <div className="text-sm text-white/85">{v.s}</div>
        </div>
      </div>
    </div>
  );
}

function KartuScope({ sc }: { sc: HasilScope }) {
  if (sc.galat) return <Pesan jenis="peringatan" judul="Kesesuaian scope belum bisa dinilai">{sc.galat}</Pesan>;
  const terima = sc.keputusan === "terima";
  const warna = terima ? "#10b981" : "#f43f5e";
  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 p-5 ${terima ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-rose-500/40 bg-rose-500/[0.06]"}`}>
      <div className="flex flex-wrap items-start gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${terima ? "bg-emerald-500 shadow-emerald-500/30" : "bg-rose-500 shadow-rose-500/30"}`}>
          <Target className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-wide text-ink-3 uppercase">Kesesuaian Focus &amp; Scope · penilaian AI</div>
          <div className={`mt-0.5 text-xl font-extrabold tracking-tight ${terima ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {terima ? "DITERIMA — sesuai scope jurnal" : "DITOLAK — di luar scope jurnal"}
          </div>
          {sc.alasan && <p className="mt-1.5 text-sm leading-relaxed text-ink">{sc.alasan}</p>}
          {!!sc.bidang_cocok?.length && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {sc.bidang_cocok.map((b) => <span key={b} className="rounded-lg bg-panel px-2 py-1 text-[11px] font-semibold text-ink-2 ring-1 ring-line">{b}</span>)}
            </div>
          )}
        </div>
        {sc.skor != null && (
          <div className="w-28 shrink-0 text-right">
            <div className="text-3xl font-extrabold tabular-nums" style={{ color: warna }}>{sc.skor}<span className="text-sm text-ink-3">/100</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-3">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sc.skor}%`, background: warna }} />
            </div>
            <div className="mt-1 text-[10px] text-ink-3">skor kesesuaian</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Angka({ nilai, label, ikon: Ikon, warna }: { nilai: number | string; label: string; ikon: LucideIcon; warna: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3.5 py-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${warna}`}><Ikon className="h-[18px] w-[18px]" /></span>
      <div>
        <div className="text-xl leading-none font-extrabold tabular-nums">{nilai}</div>
        <div className="mt-1 text-[11px] font-medium text-ink-3">{label}</div>
      </div>
    </div>
  );
}

function BarisMasalah({ m }: { m: Masalah }) {
  const [buka, setBuka] = useState(false);
  const t = m.contoh;
  const banyak = m.lokasi.length > 1;
  return (
    <li className="group py-3.5">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.sumber === "ai" ? "bg-violet-500" : t.tingkat === "wajib" ? "bg-rose-500" : "bg-amber-500"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-ink">{t.pesan}</p>
          {!banyak && t.cuplikan && <p className="mt-1 truncate text-xs text-ink-3 italic">“{t.cuplikan}”</p>}
          {banyak && (
            <button type="button" onClick={() => setBuka(!buka)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              <ChevronDown className={`h-3.5 w-3.5 transition ${buka ? "rotate-180" : ""}`} />
              {buka ? "Sembunyikan" : "Lihat"} {m.lokasi.length} lokasi
            </button>
          )}
          {buka && (
            <ul className="animasi-muncul mt-2 space-y-1.5 border-l-2 border-line-2 pl-3">
              {m.lokasi.map((l, i) => (
                <li key={i} className="truncate text-xs text-ink-3">
                  {l.pesan !== t.pesan && <span className="text-ink-2">{l.pesan} — </span>}“{l.cuplikan ?? "tingkat dokumen"}”
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {banyak && <span className="rounded-full bg-panel-3 px-2 py-0.5 text-[11px] font-bold text-ink-2 tabular-nums">×{m.lokasi.length}</span>}
          <Lencana jenis={t.sumber === "ai" ? "ai" : t.tingkat}>{t.sumber === "ai" ? "AI" : t.tingkat === "wajib" ? "Wajib" : "Saran"}</Lencana>
        </div>
      </div>
    </li>
  );
}

function KartuKategori({ kategori, daftar, warna, bukaAwal }: { kategori: string; daftar: Masalah[]; warna: string; bukaAwal: boolean }) {
  const [buka, setBuka] = useState(bukaAwal);
  const Ikon = ikonKategori(kategori);
  const wajib = daftar.filter((m) => m.contoh.tingkat === "wajib" && m.contoh.sumber === "bot").length;
  return (
    <Kartu className="overflow-hidden">
      <button type="button" onClick={() => setBuka(!buka)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-panel-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${warna}1f`, color: warna }}>
          <Ikon className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1 font-bold text-ink">{kategori}</span>
        {wajib > 0 && <Lencana jenis="wajib">{wajib} wajib</Lencana>}
        <span className="text-xs font-medium text-ink-3">{daftar.length} masalah</span>
        <ChevronDown className={`h-4 w-4 text-ink-3 transition ${buka ? "rotate-180" : ""}`} />
      </button>
      {buka && (
        <ul className="divide-y divide-line border-t border-line px-4">
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
  const warnaKategori = useMemo(() => {
    const w: Record<string, string> = {};
    [...semuaGrup.keys()].forEach((k, i) => (w[k] = PALET[i % PALET.length]));
    return w;
  }, [semuaGrup]);
  const r = cek.ringkasan;
  const st = cek.statistik;
  const saranWeb = temuan.filter((t) => t.tingkat === "saran" && t.sumber === "bot" && t.ditulis === false).length;

  if (cek.status === "gagal") return <Pesan jenis="galat" judul={`Gagal memeriksa ${cek.nama_file}`}>{cek.pesan_galat}</Pesan>;

  const hitung = { semua: r?.masalah ?? 0, wajib: r?.wajib ?? 0, saran: r?.saran ?? 0, ai: r?.ai ?? 0 };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">{cek.nama_file}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
            <span>{cek.jurnal_nama}</span>·<span>{tanggal(cek.dibuat)}</span>
            {cek.pakai_ai && <Lencana jenis="ai" ikon={Sparkles}>dengan AI</Lencana>}
          </div>
        </div>
        {cek.file_tersedia ? (
          <TautanTombol href={api.urlUnduh(cek.id)} varian="utama" ikon={Download}>Unduh .docx berkomentar</TautanTombol>
        ) : (
          <Lencana>Berkas hasil sudah dihapus otomatis</Lencana>
        )}
      </div>

      {cek.scope && <KartuScope sc={cek.scope} />}
      {r && <Vonis wajib={r.wajib} saran={r.saran} />}
      {cek.galat_ai && <Pesan jenis="peringatan" judul="Pengecekan AI gagal — hasil bot tetap lengkap">{cek.galat_ai}</Pesan>}

      {r && (
        <Kartu className="p-5">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <Donat data={[...semuaGrup.entries()].map(([label, d]) => ({ label, nilai: d.length }))} tengah={r.masalah} sub="jenis masalah" />
            <div className="min-w-0 flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                <Angka nilai={r.wajib} label="wajib diperbaiki" ikon={OctagonAlert} warna="bg-rose-500/12 text-rose-500" />
                <Angka nilai={r.saran} label="saran / cek manual" ikon={Lightbulb} warna="bg-amber-500/12 text-amber-500" />
                <Angka nilai={r.ai} label="saran AI" ikon={Sparkles} warna="bg-violet-500/12 text-violet-500" />
                <Angka nilai={r.di_word ?? r.kemunculan} label="ditandai di naskah" ikon={MessageSquareText} warna="bg-brand-soft text-brand" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {[...semuaGrup.entries()].map(([k, d]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: warnaKategori[k] }} /> {k} <b className="text-ink">{d.length}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
          {st && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              {[
                `±${st.kata_naskah.toLocaleString("id-ID")} kata`,
                st.halaman != null ? `${st.halaman} halaman` : null,
                st.kata_abstrak != null ? `abstrak ${st.kata_abstrak} kata` : null,
                `${st.jumlah_referensi} referensi`,
                `${st.jumlah_tabel} tabel`,
                `${st.jumlah_gambar} gambar`,
                st.gaya_sitasi_terdeteksi ? `sitasi ${st.gaya_sitasi_terdeteksi === "numerik" ? "numerik [1]" : "nama-tahun"}` : null,
              ].filter(Boolean).map((x) => (
                <span key={x} className="rounded-lg bg-panel-3 px-2.5 py-1 text-xs font-medium text-ink-2">{x}</span>
              ))}
              {st.judul_bagian.length > 0 && (
                <div className="mt-1 w-full truncate text-xs text-ink-3">Struktur: {st.judul_bagian.join(" → ")}</div>
              )}
            </div>
          )}
          {saranWeb > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
              {saranWeb} temuan saran hanya tampil di sini sebagai catatan Anda — tidak ditulis ke naskah Word.
            </div>
          )}
          {cek.penulis_komentar && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-soft/60 px-3.5 py-2.5 text-xs text-ink-2">
              <MessageSquareText className="h-4 w-4 text-brand" />
              Komentar di Word ditulis atas nama <b className="text-ink">{cek.penulis_komentar}</b>
            </div>
          )}
        </Kartu>
      )}

      <div className="flex flex-wrap gap-2">
        {(["semua", "wajib", "saran", "ai"] as Saring[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSaring(s)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              saring === s ? "bg-ink text-canvas shadow" : "bg-panel text-ink-2 ring-1 ring-line hover:ring-line-2"
            }`}
          >
            {{ semua: "Semua", wajib: "Wajib", saran: "Saran", ai: "AI" }[s]}
            <span className={`rounded-full px-1.5 tabular-nums ${saring === s ? "bg-canvas/20" : "bg-panel-3"}`}>{hitung[s]}</span>
          </button>
        ))}
      </div>

      {grup.size === 0 ? (
        <Pesan jenis="sukses" judul="Tidak ada temuan pada filter ini." />
      ) : (
        <div className="space-y-3">
          {[...grup.entries()].map(([kategori, daftar], i) => (
            <KartuKategori key={kategori + saring} kategori={kategori} daftar={daftar} warna={warnaKategori[kategori]} bukaAwal={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
