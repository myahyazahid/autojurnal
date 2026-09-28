import {
  BadgeCheck, BookMarked, ChevronDown, Download, FileText, Files, Heading, Layers, LayoutTemplate, ListTree, MessageSquareText,
  OctagonAlert, Pilcrow, ShieldCheck, ShieldX, Shrink, Table2, Tags, TriangleAlert, Type, UserRound, X, type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, tanggal, type Cek, type HasilScope, type Ringkasan, type Temuan } from "../lib/api";
import { useToast } from "../lib/toast";
import { IkonBerkas, Kartu, Lencana, Pesan, TautanTombol, Tombol } from "./ui";

type Saring = "semua" | "wajib" | "saran" | "ai";

const IKON_KATEGORI: Record<string, LucideIcon> = {
  "Tata Letak": LayoutTemplate, Format: Type, Struktur: ListTree, Judul: Heading, Penulis: UserRound, Abstrak: FileText, "Kata Kunci": Tags,
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
      latar: "border-ok/25 bg-ok-soft", warna: "text-ok", ikon: BadgeCheck,
      judul: saran ? "Siap dikirim" : "Sesuai template",
      sub: saran ? `Tidak ada pelanggaran wajib. Ada ${saran} saran yang sebaiknya dicek.` : "Tidak ada temuan sama sekali.",
    };
  if (wajib <= 5)
    return { latar: "border-waspada/25 bg-waspada-soft", warna: "text-waspada", ikon: TriangleAlert, judul: "Revisi minor", sub: `${wajib} jenis pelanggaran wajib perlu diperbaiki sebelum dikirim.` };
  return { latar: "border-bahaya/20 bg-bahaya-soft", warna: "text-bahaya", ikon: OctagonAlert, judul: "Perlu revisi", sub: `${wajib} jenis pelanggaran wajib. Naskah belum sesuai template.` };
}

/** Putusan kesesuaian Focus & Scope: putusan paling menonjol di halaman hasil. */
function PutusanScope({ sc, jurnalId }: { sc: HasilScope | null | undefined; jurnalId: number | null }) {
  const label = <p className="text-xs font-medium text-ink-2">Kesesuaian Focus &amp; Scope</p>;
  if (!sc || sc.alasan_tidak_dinilai || (!sc.keputusan && !sc.galat)) {
    return (
      <section className="flex flex-col rounded-xl border border-dashed border-line-2 bg-panel-2 p-4 sm:p-5">
        {label}
        <h3 className="mt-1 text-lg font-bold text-ink-2">Scope belum dinilai</h3>
        <p className="mt-1 text-sm text-ink-2">{sc?.alasan_tidak_dinilai ?? "Pengecekan ini dibuat sebelum penilaian scope tersedia."}</p>
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
      <section className="rounded-xl border border-waspada/25 bg-waspada-soft p-4 sm:p-5">
        {label}
        <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-ink">
          <TriangleAlert className="h-5 w-5 shrink-0 text-waspada" aria-hidden /> Scope gagal dinilai
        </h3>
        <p className="mt-1 text-sm break-words text-ink-2">{sc.galat}</p>
      </section>
    );
  }
  const sesuai = sc.keputusan === "terima";
  const Ikon = sesuai ? ShieldCheck : ShieldX;
  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${sesuai ? "border-ok/25 bg-ok-soft" : "border-bahaya/20 bg-bahaya-soft"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-2">Kesesuaian Focus &amp; Scope · dinilai AI</p>
          <h3 className={`mt-1 flex items-center gap-2 text-xl font-bold sm:text-2xl ${sesuai ? "text-ok" : "text-bahaya"}`}>
            <Ikon className="h-6 w-6 shrink-0" aria-hidden /> {sesuai ? "Sesuai scope" : "Tidak sesuai scope"}
          </h3>
          <p className="mt-1 text-sm font-semibold text-ink">Rekomendasi: {sesuai ? "terima" : "tolak"}</p>
        </div>
        {sc.skor != null && (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold text-ink tabular-nums">{sc.skor}<span className="text-sm font-medium text-ink-2">/100</span></div>
            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-panel" role="img" aria-label={`Skor kesesuaian ${sc.skor} dari 100`}>
              <div className={`h-full rounded-full ${sesuai ? "bg-ok" : "bg-bahaya"}`} style={{ width: `${sc.skor}%` }} />
            </div>
          </div>
        )}
      </div>
      {sc.alasan && <p className="mt-3 text-sm leading-relaxed text-ink">{sc.alasan}</p>}
      {!!sc.bidang_cocok?.length && (
        <p className="mt-2 text-xs text-ink-2"><span className="font-semibold text-ink">Bidang yang cocok: </span>{sc.bidang_cocok.join(", ")}</p>
      )}
    </section>
  );
}

/** Putusan format & struktur dari bot. */
function PutusanFormat({ wajib, saran }: { wajib: number; saran: number }) {
  const v = vonis(wajib, saran);
  const Ikon = v.ikon;
  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${v.latar}`}>
      <p className="text-xs font-medium text-ink-2">Format &amp; struktur · dicek bot</p>
      <h3 className={`mt-1 flex items-center gap-2 text-xl font-bold sm:text-2xl ${v.warna}`}>
        <Ikon className="h-6 w-6 shrink-0" aria-hidden /> {v.judul}
      </h3>
      <p className="mt-1 text-sm text-ink-2">{v.sub}</p>
    </section>
  );
}

/** Angka utama hasil, 2×2. */
function AngkaHasil({ r, pakaiAI }: { r: Ringkasan; pakaiAI: boolean }) {
  const butir: [string, number | string, boolean][] = [
    ["Wajib diperbaiki", r.wajib, r.wajib > 0],
    ["Saran / cek manual", r.saran, false],
    ["Saran AI", pakaiAI ? r.ai : "tidak dipakai", false],
    ["Komentar di naskah", r.di_word ?? r.kemunculan, false],
  ];
  return (
    <dl className="grid grid-cols-2">
      {butir.map(([label, nilai, merah], i) => (
        <div key={label} className={`px-4 py-3.5 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line" : ""}`}>
          <dt className="text-xs font-medium text-ink-2">{label}</dt>
          <dd className={`mt-0.5 tabular-nums ${typeof nilai === "string" ? "text-sm leading-8 text-ink-2" : `text-2xl font-bold ${merah ? "text-bahaya" : "text-ink"}`}`}>{nilai}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Jenis masalah per kategori, terbanyak di atas. Setiap batang sekaligus penyaring daftar temuan. */
function BatangKategori({ grup, aktif, pilih }: { grup: Map<string, Masalah[]>; aktif: string | null; pilih: (k: string | null) => void }) {
  const baris = [...grup.entries()].map(([k, d]) => [k, d.length] as const).sort((a, b) => b[1] - a[1]);
  const maks = Math.max(1, ...baris.map(([, n]) => n));
  return (
    <ul className="space-y-0.5 p-2">
      {baris.map(([k, n]) => (
        <li key={k}>
          <button
            type="button"
            aria-pressed={aktif === k}
            onClick={() => pilih(aktif === k ? null : k)}
            className={`grid w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_1.75rem] items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
              aktif === k ? "bg-brand-soft" : "hover:bg-panel-3"
            }`}
          >
            <span className={`truncate ${aktif === k ? "font-semibold text-brand-tinta" : "text-ink-2"}`}>{k}</span>
            <span className="h-1.5 rounded-full bg-panel-3" aria-hidden>
              <span className="block h-full rounded-full bg-grafik" style={{ width: `${(n / maks) * 100}%` }} />
            </span>
            <span className="text-right font-semibold text-ink tabular-nums">{n}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function BarisMasalah({ m }: { m: Masalah }) {
  const [buka, setBuka] = useState(false);
  const id = useId();
  const t = m.contoh;
  const banyak = m.lokasi.length > 1;
  const jenis = t.sumber === "ai" ? "ai" : t.tingkat;
  return (
    <li className="flex gap-3 px-4 py-3.5 sm:px-5">
      <span className="w-12 shrink-0 pt-0.5">
        <Lencana jenis={jenis}>{t.sumber === "ai" ? "AI" : t.tingkat === "wajib" ? "Wajib" : "Saran"}</Lencana>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-ink">{t.pesan}</p>
        {!banyak && t.cuplikan && <p className="mt-1 truncate font-serif text-[13px] text-ink-2">“{t.cuplikan}”</p>}
        {banyak && (
          <button
            type="button"
            onClick={() => setBuka(!buka)}
            aria-expanded={buka}
            aria-controls={id}
            className="ketuk mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-tinta hover:underline"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden />
            {buka ? "Sembunyikan" : "Lihat"} {m.lokasi.length} lokasi
          </button>
        )}
        {buka && (
          <ul id={id} className="mt-2 space-y-1.5 rounded-md bg-panel-2 px-3 py-2">
            {m.lokasi.map((l, i) => (
              <li key={i} className="truncate text-xs text-ink-2">
                {l.pesan !== t.pesan && <span className="text-ink">{l.pesan}: </span>}
                <span className="font-serif">“{l.cuplikan ?? "tingkat dokumen"}”</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function BagianKategori({ kategori, daftar, bukaAwal }: { kategori: string; daftar: Masalah[]; bukaAwal: boolean }) {
  const [buka, setBuka] = useState(bukaAwal);
  const id = useId();
  const Ikon = ikonKategori(kategori);
  const wajib = daftar.filter((m) => m.contoh.tingkat === "wajib" && m.contoh.sumber === "bot").length;
  return (
    <div>
      <h3>
        <button
          type="button"
          onClick={() => setBuka(!buka)}
          aria-expanded={buka}
          aria-controls={id}
          className="flex w-full items-center gap-3 bg-panel-2 px-4 py-2.5 text-left transition-colors hover:bg-panel-3 sm:px-5"
        >
          <Ikon className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{kategori}</span>
          {wajib > 0 && <Lencana jenis="wajib">{wajib} wajib</Lencana>}
          <span className="text-xs text-ink-2 tabular-nums">{daftar.length}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-3 transition-transform ${buka ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h3>
      {buka && (
        <ul id={id} className="divide-y divide-line border-t border-line">
          {daftar.map((m) => <BarisMasalah key={m.kunci} m={m} />)}
        </ul>
      )}
    </div>
  );
}

const kb = (n: number) => `${n.toLocaleString("id-ID")} KB`;

/** Peringatan berkas terlalu besar + tombol untuk mengecilkan hasil berkomentar di bawah batas profil jurnal. */
function UkuranBerkas({ cek }: { cek: Cek }) {
  const toast = useToast();
  const [kecil, setKecil] = useState(cek.kecil ?? null);
  const [tersedia, setTersedia] = useState(!!cek.file_kecil_tersedia);
  const [sibuk, setSibuk] = useState(false);
  const u = cek.ukuran;
  if (!u?.maks_kb || !cek.file_tersedia) return null;
  if (u.total_kb <= u.maks_kb && !kecil) return null;

  async function jalankan() {
    setSibuk(true);
    try {
      const d = await api.kecilkan(cek.id);
      setKecil(d.kecil ?? null);
      setTersedia(!!d.file_kecil_tersedia);
    } catch (e) {
      toast("galat", "Berkas gagal dikecilkan", (e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (kecil && tersedia)
    return (
      <Pesan
        jenis={kecil.tercapai ? "sukses" : "peringatan"}
        judul={kecil.tercapai ? `Berkas dikecilkan: ${kb(kecil.awal_kb)} → ${kb(kecil.akhir_kb)}` : `Berkas dikecilkan ke ${kb(kecil.akhir_kb)}, masih di atas ${kb(kecil.target_kb)}`}
        aksi={<TautanTombol href={api.urlUnduh(cek.id, true)} varian="utama" ikon={Download}>Unduh versi kecil</TautanTombol>}
      >
        {kecil.tercapai
          ? "Teks, format, dan komentar tidak berubah. " + (kecil.langkah.length > 1 ? "Gambar dikompres seperlunya agar tetap tajam saat dicetak." : "Cukup dengan membuang font yang disematkan, jadi tampilan sama persis.")
          : "Sisa ukurannya berasal dari teks dan objek lain yang tidak bisa dikompres lagi tanpa mengubah isi naskah."}
      </Pesan>
    );

  const rincian = ([["Font yang disematkan", u.font_kb], ["Gambar", u.gambar_kb], ["Teks dan lainnya", u.lain_kb]] as const)
    .filter(([, n]) => n > 0)
    .map(([nama, n]) => `${nama} ${kb(n)}`)
    .join(" · ");
  return (
    <Pesan
      jenis="peringatan"
      judul={`Ukuran berkas ${kb(u.total_kb)}, di atas batas ${kb(u.maks_kb)}`}
      aksi={<Tombol ikon={Shrink} onClick={jalankan} memuat={sibuk}>{sibuk ? "Mengecilkan…" : "Kecilkan ukuran"}</Tombol>}
    >
      {rincian}. {u.font_kb > u.gambar_kb
        ? "Sebagian besar berasal dari font yang ikut disematkan ke berkas; membuangnya tidak mengubah tampilan."
        : "Gambar akan dikompres seperlunya sampai berkas di bawah batas."}
    </Pesan>
  );
}

export default function HasilCek({ cek }: { cek: Cek }) {
  const [saring, setSaring] = useState<Saring>("semua");
  const [kategori, setKategori] = useState<string | null>(null);
  const temuan = useMemo(() => cek.temuan ?? [], [cek.temuan]);
  const tersaring = useMemo(
    () => temuan.filter((t) =>
      (saring === "semua" ? true : saring === "ai" ? t.sumber === "ai" : t.sumber === "bot" && t.tingkat === saring) &&
      (!kategori || t.kategori === kategori)),
    [temuan, saring, kategori],
  );
  const grup = useMemo(() => kelompokkan(tersaring), [tersaring]);
  const semuaGrup = useMemo(() => kelompokkan(temuan), [temuan]);
  const r = cek.ringkasan;
  const st = cek.statistik;
  const saranWeb = temuan.filter((t) => t.tingkat === "saran" && t.sumber === "bot" && t.ditulis === false).length;

  if (cek.status === "gagal") return <Pesan jenis="galat" judul={`Gagal memeriksa ${cek.nama_file}`}>{cek.pesan_galat}</Pesan>;

  const hitung = { semua: r?.masalah ?? 0, wajib: r?.wajib ?? 0, saran: r?.saran ?? 0, ai: r?.ai ?? 0 };
  const opsiSaring = (["semua", "wajib", "saran", "ai"] as Saring[]).filter((s) => s !== "ai" || cek.pakai_ai);
  const jumlahJenis = [...semuaGrup.values()].reduce((a, d) => a + d.length, 0);
  const fakta: [string, string][] = st
    ? ([
        ["Jumlah kata", `±${st.kata_naskah.toLocaleString("id-ID")}`],
        st.halaman != null ? ["Halaman", String(st.halaman)] : null,
        st.kata_abstrak != null ? ["Kata abstrak", String(st.kata_abstrak)] : null,
        ["Referensi", String(st.jumlah_referensi)],
        ["Tabel", String(st.jumlah_tabel)],
        ["Gambar", String(st.jumlah_gambar)],
        st.gaya_sitasi_terdeteksi ? ["Gaya sitasi", st.gaya_sitasi_terdeteksi === "numerik" ? "Numerik [1]" : "Nama-tahun"] : null,
      ].filter(Boolean) as [string, string][])
    : [];

  return (
    <div className="space-y-5">
      {/* ------------ kepala & putusan ------------ */}
      <Kartu className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <IkonBerkas ukuran={40} redup={!cek.file_tersedia} />
          <div className="min-w-0 flex-1 basis-60">
            <h2 className="text-lg leading-snug font-bold break-words text-ink">{cek.nama_file}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
              <span>{cek.jurnal_nama}</span>
              <span aria-hidden>·</span>
              <span>{tanggal(cek.dibuat)}</span>
              {cek.pakai_ai && <Lencana jenis="ai">dengan AI</Lencana>}
            </p>
          </div>
          {cek.file_tersedia ? (
            <TautanTombol href={api.urlUnduh(cek.id)} varian="utama" ikon={Download}>Unduh .docx berkomentar</TautanTombol>
          ) : (
            <p className="max-w-56 text-xs text-ink-2">Berkas hasil sudah dihapus otomatis. Ringkasannya tetap tersimpan.</p>
          )}
        </div>
        {r && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <PutusanScope sc={cek.scope} jurnalId={cek.jurnal_id} />
            <PutusanFormat wajib={r.wajib} saran={r.saran} />
          </div>
        )}
        <div className="mt-3 empty:hidden"><UkuranBerkas key={cek.id} cek={cek} /></div>
        {cek.galat_ai && <div className="mt-3"><Pesan jenis="peringatan" judul="Pengecekan AI gagal, hasil bot tetap lengkap">{cek.galat_ai}</Pesan></div>}
      </Kartu>

      {r && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* ------------ ringkasan (kanan di layar lebar, di atas di layar kecil) ------------ */}
          <aside className="grid gap-5 md:grid-cols-2 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1 xl:grid-cols-1" aria-label="Ringkasan hasil">
            <Kartu className="overflow-hidden">
              <AngkaHasil r={r} pakaiAI={cek.pakai_ai} />
            </Kartu>
            {jumlahJenis > 0 && (
              <Kartu className="overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <h3 className="text-sm font-semibold">Masalah per kategori</h3>
                  {kategori && (
                    <button type="button" onClick={() => setKategori(null)} className="ketuk text-xs font-semibold text-brand-tinta hover:underline">Tampilkan semua</button>
                  )}
                </div>
                <BatangKategori grup={semuaGrup} aktif={kategori} pilih={setKategori} />
              </Kartu>
            )}
            {(fakta.length > 0 || saranWeb > 0 || cek.penulis_komentar) && (
              <Kartu className="overflow-hidden md:col-span-2 xl:col-span-1">
                {fakta.length > 0 && (
                  <>
                    <h3 className="border-b border-line px-4 py-3 text-sm font-semibold">Tentang naskah</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-sm">
                      {fakta.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs text-ink-2">{k}</dt>
                          <dd className="font-semibold text-ink tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {st && st.judul_bagian.length > 0 && (
                      <div className="border-t border-line px-4 py-3">
                        <div className="text-xs text-ink-2">Struktur terbaca</div>
                        <ol className="mt-1.5 space-y-1 text-xs text-ink">
                          {st.judul_bagian.map((b, i) => <li key={b + i} className="truncate"><span className="text-ink-3 tabular-nums">{i + 1}.</span> {b}</li>)}
                        </ol>
                      </div>
                    )}
                  </>
                )}
                {(saranWeb > 0 || cek.penulis_komentar) && (
                  <div className="space-y-2 border-t border-line p-3 first:border-t-0">
                    {saranWeb > 0 && (
                      <p className="rounded-md bg-waspada-soft px-3 py-2 text-xs text-waspada">
                        {saranWeb} temuan saran hanya tampil di sini sebagai catatan, tidak ditulis ke naskah Word.
                      </p>
                    )}
                    {cek.penulis_komentar && (
                      <p className="rounded-md bg-panel-2 px-3 py-2 text-xs text-ink-2">
                        Komentar ditulis atas nama <b className="text-ink">{cek.penulis_komentar}</b>.
                      </p>
                    )}
                  </div>
                )}
              </Kartu>
            )}
          </aside>

          {/* ------------ daftar temuan ------------ */}
          <Kartu as="section" className="overflow-hidden xl:col-start-1 xl:row-start-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <h2 className="text-[15px] font-semibold">Temuan</h2>
              <div role="group" aria-label="Saring menurut tingkat" className="inline-flex rounded-lg bg-panel-3 p-1">
                {opsiSaring.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={saring === s}
                    onClick={() => setSaring(s)}
                    className={`ketuk inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      saring === s ? "bg-panel text-ink shadow-[0_1px_2px_rgba(15,23,41,0.12)]" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {{ semua: "Semua", wajib: "Wajib", saran: "Saran", ai: "AI" }[s]}
                    <span className="text-ink-3 tabular-nums">{hitung[s]}</span>
                  </button>
                ))}
              </div>
            </div>
            {kategori && (
              <div className="flex items-center gap-2 border-b border-line bg-brand-soft/60 px-4 py-2 text-xs sm:px-5">
                <span className="text-ink-2">Kategori:</span>
                <span className="font-semibold text-ink">{kategori}</span>
                <button type="button" onClick={() => setKategori(null)} aria-label="Hapus saringan kategori" className="ketuk ml-auto inline-flex items-center justify-center rounded-md p-1 text-ink-2 hover:bg-panel hover:text-ink">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}
            {grup.size === 0 ? (
              <div className="px-5 py-12 text-center">
                <BadgeCheck className="mx-auto h-8 w-8 text-ok" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-ink">{saring === "semua" && !kategori ? "Tidak ada temuan." : "Tidak ada temuan pada saringan ini."}</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {[...grup.entries()].map(([k, daftar], i) => (
                  <BagianKategori key={k + saring + (kategori ?? "")} kategori={k} daftar={daftar} bukaAwal={!!kategori || jumlahJenis <= 12 || i < 3} />
                ))}
              </div>
            )}
          </Kartu>
        </div>
      )}
    </div>
  );
}
