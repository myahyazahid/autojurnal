import { CircleAlert, Download, FolderDown, RotateCcw, Shrink, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import IkonJenis, { type JenisBerkas } from "../components/IkonJenis";
import Membaca from "../components/Membaca";
import ProgresUnggah from "../components/ProgresUnggah";
import { JudulHalaman, Kartu, Lencana, Pesan, Sakelar, TautanTombol, Tombol, ZonaUnggah } from "../components/ui";
import { api, type HasilResizer, type OpsiResizer, type Progres } from "../lib/api";

const MAKS_MB = 40;

const INFO: Record<JenisBerkas, { nama: string; judul: string; terima: string; format: string; ket: string; langkah: string[] }> = {
  pdf: {
    nama: "PDF", judul: "Kecilkan PDF", terima: ".pdf", format: ".pdf",
    ket: "Kompres gambar di dalam PDF dan rapikan strukturnya. Teks tetap tajam dan bisa dicari.",
    langkah: ["Membaca struktur PDF", "Mengompres gambar di setiap halaman", "Membuang objek yang tidak terpakai", "Menyusun ulang berkas"],
  },
  word: {
    nama: "Word", judul: "Kecilkan dokumen Word", terima: ".docx,.docm,.dotx", format: ".docx",
    ket: "Buang font yang disematkan dan kompres gambar. Teks, format, dan komentar tetap utuh.",
    langkah: ["Membuang font yang disematkan", "Mengompres gambar sesuai ukuran tampilnya", "Menyusun ulang berkas"],
  },
  excel: {
    nama: "Excel", judul: "Kecilkan buku kerja Excel", terima: ".xlsx,.xlsm", format: ".xlsx",
    ket: "Kompres gambar dan susun ulang isi berkas. Data, rumus, dan format sel tetap utuh.",
    langkah: ["Membaca isi buku kerja", "Mengompres gambar", "Menyusun ulang berkas"],
  },
  gambar: {
    nama: "Gambar", judul: "Kecilkan gambar", terima: ".jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff", format: "JPG, PNG, WebP, BMP, TIFF",
    ket: "Perkecil dimensi, kompres, atau ubah ke JPEG/WebP. Metadata kamera ikut dibuang.",
    langkah: ["Membaca gambar", "Menyesuaikan dimensi", "Mengompres"],
  },
};
const URUTAN: JenisBerkas[] = ["pdf", "word", "excel", "gambar"];

const RINGAN: Record<JenisBerkas, string> = {
  pdf: "Kualitas tetap. Hanya merapikan struktur PDF; gambar tidak disentuh.",
  word: "Kualitas tetap. Membuang font sematan dan thumbnail; tampilan sama persis.",
  excel: "Kualitas tetap. Menyusun ulang berkas tanpa menyentuh gambar.",
  gambar: "Dimensi tetap. Kompresi ringan yang tidak terlihat mata.",
};
const LEVEL: { nilai: OpsiResizer["level"]; label: string; ket: string }[] = [
  { nilai: "ringan", label: "Ringan", ket: "" },
  { nilai: "seimbang", label: "Seimbang", ket: "Gambar dikompres secukupnya dan tetap tajam saat dicetak." },
  { nilai: "kuat", label: "Kuat", ket: "Ukuran sekecil mungkin. Gambar bisa sedikit lebih lembut." },
];

export function ukuranTeks(kb: number): string {
  return kb >= 1024
    ? `${(kb / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(kb)).toLocaleString("id-ID")} KB`;
}

/** Beranda Resizer: pilih jenis berkas. */
export function BerandaResizer() {
  return (
    <>
      <JudulHalaman
        judul="Resizer"
        sub="Kecilkan ukuran berkas sebelum diunggah ke OJS atau dikirim lewat email. Berkas diproses di server AutoJurnal dan hasilnya terhapus otomatis setelah 6 jam."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {URUTAN.map((j) => (
          <li key={j}>
            <Link
              to={`/resizer/${j}`}
              className="kartu group flex h-full flex-col p-5 transition-colors hover:border-brand-garis hover:bg-panel-2"
            >
              <IkonJenis jenis={j} ukuran={52} />
              <span className="mt-4 text-base font-semibold text-ink group-hover:text-brand-tinta">{INFO[j].nama}</span>
              <span className="mt-1 flex-1 text-sm leading-relaxed text-ink-2">{INFO[j].ket}</span>
              <span className="mt-4 text-xs font-medium text-ink-3">{INFO[j].format}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-ink-2">Satu berkas maksimal {MAKS_MB} MB. Berkas diproses satu per satu.</p>
    </>
  );
}

interface Baris {
  id: number;
  berkas: File;
  status: "menunggu" | "proses" | "selesai" | "gagal";
  hasil?: HasilResizer;
  galat?: string;
  progres?: Progres | null;
}

function StatusBaris({ b }: { b: Baris }) {
  if (b.status === "proses") return <div className="mt-1 max-w-sm"><ProgresUnggah ringkas progres={b.progres ?? null} labelProses="Mengecilkan di server" /></div>;
  if (b.status === "gagal") return <span className="flex items-start gap-1 text-xs text-bahaya"><CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{b.galat}</span>;
  if (b.status === "selesai" && b.hasil) {
    const h = b.hasil;
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
        <span>{ukuranTeks(h.awal_kb)} → <b className="font-semibold text-ink">{ukuranTeks(h.akhir_kb)}</b></span>
        {h.sudah_optimal ? <Lencana>Sudah optimal</Lencana> : <Lencana jenis="sukses">−{h.hemat_persen}%</Lencana>}
        {h.tercapai === false && <Lencana jenis="saran">Target belum tercapai</Lencana>}
        {h.format_berubah && <span>disimpan sebagai {h.nama.split(".").pop()?.toUpperCase()}</span>}
      </span>
    );
  }
  return <span className="text-xs text-ink-2">{ukuranTeks(b.berkas.size / 1024)}</span>;
}

/** Halaman alat Resizer untuk satu jenis berkas. */
export function AlatResizer() {
  const { jenis } = useParams();
  const [baris, setBaris] = useState<Baris[]>([]);
  const [level, setLevel] = useState<OpsiResizer["level"]>("seimbang");
  const [pakaiTarget, setPakaiTarget] = useState(false);
  const [target, setTarget] = useState("1900");
  const [format, setFormat] = useState<NonNullable<OpsiResizer["format_keluar"]>>("sama");
  const [sisi, setSisi] = useState("");
  const [jalan, setJalan] = useState(false);
  const [ke, setKe] = useState(0);
  const idTarget = useId();
  const idFormat = useId();
  const idSisi = useId();
  const idLevel = useId();

  useEffect(() => setBaris([]), [jenis]);
  useEffect(() => {
    if (!jalan) return;
    const tahan = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", tahan);
    return () => window.removeEventListener("beforeunload", tahan);
  }, [jalan]);

  if (!jenis || !(jenis in INFO)) return <Navigate to="/resizer" replace />;
  const j = jenis as JenisBerkas;
  const info = INFO[j];
  const ekst = info.terima.split(",");

  function tambah(daftar: File[]) {
    const baru = daftar.map((berkas, i): Baris => {
      const cocok = ekst.some((e) => berkas.name.toLowerCase().endsWith(e));
      const besar = berkas.size > MAKS_MB * 1024 * 1024;
      return {
        id: Date.now() + i,
        berkas,
        status: cocok && !besar ? "menunggu" : "gagal",
        galat: !cocok ? `Bukan berkas ${info.format}.` : besar ? `Melebihi ${MAKS_MB} MB.` : undefined,
      };
    });
    setBaris((b) => [...b, ...baru]);
  }

  const menunggu = baris.filter((b) => b.status === "menunggu").length;
  const selesai = baris.filter((b) => b.status === "selesai" && b.hasil);
  const targetKb = pakaiTarget ? Math.max(10, Number(target) || 0) : undefined;

  async function mulai(ulang = false) {
    const opsi: OpsiResizer = {
      level, target_kb: targetKb,
      ...(j === "gambar" ? { format_keluar: format, maks_sisi: sisi ? Number(sisi) : undefined } : {}),
    };
    const antre = ulang
      ? baris.map((b) => (b.status === "selesai" ? { ...b, status: "menunggu" as const, hasil: undefined } : b))
      : baris;
    setBaris(antre);
    setJalan(true);
    const daftar = antre.filter((b) => b.status === "menunggu");
    for (let i = 0; i < daftar.length; i++) {
      const b = daftar[i];
      setKe(i + 1);
      setBaris((q) => q.map((x) => (x.id === b.id ? { ...x, status: "proses", progres: null } : x)));
      try {
        const catat = (p: Progres) => setBaris((q) => q.map((x) => (x.id === b.id ? { ...x, progres: p } : x)));
        const h = await api.resizer(j, b.berkas, opsi, catat);
        setBaris((q) => q.map((x) => (x.id === b.id ? { ...x, status: "selesai", hasil: h } : x)));
      } catch (e) {
        setBaris((q) => q.map((x) => (x.id === b.id ? { ...x, status: "gagal", galat: (e as Error).message } : x)));
      }
    }
    setJalan(false);
  }

  const totalAwal = selesai.reduce((a, b) => a + b.hasil!.awal_kb, 0);
  const totalAkhir = selesai.reduce((a, b) => a + b.hasil!.akhir_kb, 0);
  const jumlahProses = baris.filter((b) => b.status === "menunggu" || b.status === "proses").length;
  const tahap = baris.find((b) => b.status === "proses")?.progres?.tahap;

  return (
    <>
      <JudulHalaman
        kembali={{ ke: "/resizer", label: "Resizer" }}
        judul={<span className="flex items-center gap-3"><IkonJenis jenis={j} ukuran={34} />{info.judul}</span>}
        sub={info.ket}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Kartu className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <ZonaUnggah
              ganda
              ringkas={baris.length > 0}
              terima={info.terima}
              label={baris.length ? "Tambah berkas lagi" : `Seret berkas ${info.nama} ke sini`}
              sub={`${info.format} · maksimal ${MAKS_MB} MB per berkas`}
              pilih={tambah}
            />
          </div>
          {jalan && (
            <div className="border-t border-line bg-panel-2 px-4 py-4 sm:px-5">
              <Membaca
                mendatar
                ukuran="kecil"
                judul={`${tahap === "proses" ? "Mengecilkan" : "Mengunggah"} berkas ${ke} dari ${ke + jumlahProses - 1}…`}
                langkah={tahap === "proses" ? info.langkah : undefined}
              />
            </div>
          )}
          {baris.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {baris.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <IkonJenis jenis={j} ukuran={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink" title={b.berkas.name}>{b.berkas.name}</div>
                    <div className="mt-0.5"><StatusBaris b={b} /></div>
                  </div>
                  {b.status === "selesai" && b.hasil ? (
                    <TautanTombol href={api.urlResizer(b.hasil.token)} ukuran="kecil" ikon={Download} aria-label={`Unduh ${b.hasil.nama}`}>Unduh</TautanTombol>
                  ) : b.status !== "proses" && !jalan ? (
                    <button
                      type="button"
                      onClick={() => setBaris((q) => q.filter((x) => x.id !== b.id))}
                      className="ketuk inline-flex items-center justify-center rounded-md p-1.5 text-ink-2 hover:bg-panel-3 hover:text-ink"
                      aria-label={`Hapus ${b.berkas.name} dari daftar`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {selesai.length > 0 && !jalan && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel-2 px-4 py-3 sm:px-5">
              <span className="text-sm text-ink-2">
                {selesai.length} berkas: {ukuranTeks(totalAwal)} → <b className="font-semibold text-ink">{ukuranTeks(totalAkhir)}</b>
                {totalAwal > totalAkhir && <> (hemat {Math.round(((totalAwal - totalAkhir) * 100) / totalAwal)}%)</>}
              </span>
              {selesai.length > 1 && (
                <TautanTombol href={api.urlResizerZip(selesai.map((b) => b.hasil!.token))} ukuran="kecil" ikon={FolderDown}>Unduh semua (.zip)</TautanTombol>
              )}
            </div>
          )}
        </Kartu>

        <Kartu as="section" className="p-4 sm:p-5 lg:sticky lg:top-6">
          <h2 id={idLevel} className="text-[15px] font-semibold text-ink">Tingkat kompresi</h2>
          <div role="radiogroup" aria-labelledby={idLevel} className="mt-3 space-y-2">
            {LEVEL.map((l) => (
              <button
                key={l.nilai}
                type="button"
                role="radio"
                aria-checked={level === l.nilai}
                disabled={jalan}
                onClick={() => setLevel(l.nilai)}
                className={`ketuk block w-full rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                  level === l.nilai ? "border-brand bg-brand-soft" : "border-line-2 bg-panel hover:border-isian"
                }`}
              >
                <span className={`block text-sm font-semibold ${level === l.nilai ? "text-brand-tinta" : "text-ink"}`}>{l.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">{l.nilai === "ringan" ? RINGAN[j] : l.ket}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <Sakelar
              nyala={pakaiTarget}
              ubah={setPakaiTarget}
              nonaktif={jalan}
              label="Target ukuran"
              keterangan="Kompresi dinaikkan bertahap sampai berkas di bawah target."
            />
            {pakaiTarget && (
              <div className="mt-3">
                <label htmlFor={idTarget} className="label">Ukuran maksimal</label>
                <div className="relative">
                  <input id={idTarget} type="number" min={10} inputMode="numeric" className="input pr-12" value={target} disabled={jalan} onChange={(e) => setTarget(e.target.value)} />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-2">KB</span>
                </div>
              </div>
            )}
          </div>

          {j === "gambar" && (
            <div className="mt-5 grid gap-4 border-t border-line pt-4">
              <div>
                <label htmlFor={idFormat} className="label">Format hasil</label>
                <select id={idFormat} className="input" value={format} disabled={jalan} onChange={(e) => setFormat(e.target.value as typeof format)}>
                  <option value="sama">Sama seperti asli</option>
                  <option value="jpeg">JPEG (foto)</option>
                  <option value="webp">WebP (paling kecil)</option>
                  <option value="png">PNG (grafik, transparan)</option>
                </select>
              </div>
              <div>
                <label htmlFor={idSisi} className="label">Sisi terpanjang</label>
                <select id={idSisi} className="input" value={sisi} disabled={jalan} onChange={(e) => setSisi(e.target.value)}>
                  <option value="">Ikuti tingkat kompresi</option>
                  {[3840, 2560, 1920, 1280, 1024, 800].map((n) => <option key={n} value={n}>{n.toLocaleString("id-ID")} px</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-2">
            {!menunggu && selesai.length > 0 && !jalan ? (
              <Tombol varian="utama" ukuran="besar" ikon={RotateCcw} className="w-full" onClick={() => mulai(true)}>Ulangi dengan pengaturan ini</Tombol>
            ) : (
              <Tombol varian="utama" ukuran="besar" ikon={Shrink} className="w-full" memuat={jalan} disabled={!menunggu || jalan} onClick={() => mulai()}>
                {jalan ? "Mengecilkan…" : menunggu ? `Kecilkan ${menunggu} berkas` : "Pilih berkas dulu"}
              </Tombol>
            )}
          </div>
          {j === "pdf" && (
            <div className="mt-4">
              <Pesan jenis="info">PDF yang berisi teks dan sedikit gambar biasanya hanya berkurang sedikit, karena sisanya teks dan font yang tidak bisa dikompres tanpa merusak.</Pesan>
            </div>
          )}
        </Kartu>
      </div>
    </>
  );
}
