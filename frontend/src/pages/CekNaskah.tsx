import { BadgeCheck, BookOpen, CalendarDays, CircleCheck, CircleX, Clock, FileText, FolderDown, Gauge, Rocket, ScanSearch, Sparkles, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Cek, type JurnalRingkas, type StatistikDasbor, type Status } from "../lib/api";
import { namaDepan, useAuth } from "../lib/auth";
import HasilCek from "../components/HasilCek";
import { Kartu, Kerangka, Kosong, Lencana, LencanaScope, Pesan, Putar, Sakelar, TautanTombol, Tombol, ZonaUnggah } from "../components/ui";

interface Antrian {
  berkas: File;
  status: "menunggu" | "proses" | "selesai" | "gagal";
  hasil?: Cek;
  galat?: string;
}

function sapaan(): string {
  const j = new Date().getHours();
  return j < 11 ? "Selamat pagi" : j < 15 ? "Selamat siang" : j < 19 ? "Selamat sore" : "Selamat malam";
}

function Chip({ ikon: Ikon, nilai, label }: { ikon: LucideIcon; nilai: string | number; label: string }) {
  return (
    <div className="kaca flex items-center gap-3 rounded-2xl px-4 py-3">
      <Ikon className="h-5 w-5 text-white/80" />
      <div>
        <div className="text-lg leading-none font-extrabold text-white tabular-nums">{nilai}</div>
        <div className="mt-1 text-[11px] font-medium text-white/70">{label}</div>
      </div>
    </div>
  );
}

function Langkah({ n, judul, children }: { n: number; judul: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="bg-merek flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white">{n}</span>
        <span className="text-sm font-bold text-ink">{judul}</span>
      </div>
      {children}
    </div>
  );
}

export default function CekNaskah() {
  const { pengguna } = useAuth();
  const [jurnal, setJurnal] = useState<JurnalRingkas[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [stat, setStat] = useState<StatistikDasbor | null>(null);
  const [pilihan, setPilihan] = useState<number | "">("");
  const [pakaiAI, setPakaiAI] = useState(false);
  const [antrian, setAntrian] = useState<Antrian[]>([]);
  const [jalan, setJalan] = useState(false);
  const [dibuka, setDibuka] = useState(0);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    api.daftarJurnal().then((d) => {
      setJurnal(d);
      let simpan = NaN;
      try {
        simpan = Number(localStorage.getItem("aj_jurnal"));
      } catch {
        /* abaikan */
      }
      setPilihan(d.find((j) => j.id === simpan)?.id ?? d[0]?.id ?? "");
    }).catch((e) => setGalat(e.message));
    api.status().then(setStatus).catch(() => undefined);
    api.statistik().then(setStat).catch(() => undefined);
  }, []);

  const jurnalDipilih = jurnal?.find((j) => j.id === pilihan);
  const aiBisa = !!status?.ai_aktif && ((jurnalDipilih?.jumlah_naratif ?? 0) > 0 || !!jurnalDipilih?.punya_scope);

  async function mulai() {
    if (!pilihan) return;
    try {
      localStorage.setItem("aj_jurnal", String(pilihan));
    } catch {
      /* abaikan */
    }
    setJalan(true);
    const daftar = antrian.map((a) => (a.status === "selesai" ? a : { ...a, status: "menunggu" as const, galat: undefined }));
    setAntrian(daftar);
    for (let i = 0; i < daftar.length; i++) {
      if (daftar[i].status === "selesai") continue;
      setDibuka(i);
      setAntrian((q) => q.map((a, j) => (j === i ? { ...a, status: "proses" } : a)));
      try {
        const hasil = await api.cek(daftar[i].berkas, Number(pilihan), pakaiAI && aiBisa);
        setAntrian((q) => q.map((a, j) => (j === i ? { ...a, status: hasil.status === "gagal" ? "gagal" : "selesai", hasil, galat: hasil.pesan_galat } : a)));
      } catch (e) {
        setAntrian((q) => q.map((a, j) => (j === i ? { ...a, status: "gagal", galat: (e as Error).message } : a)));
      }
    }
    setJalan(false);
    api.statistik().then(setStat).catch(() => undefined);
  }

  const selesai = antrian.filter((a) => a.hasil?.status === "selesai");
  const menunggu = antrian.filter((a) => a.status !== "selesai").length;
  const aktif = antrian[dibuka];

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <div className="bg-merek relative mb-7 overflow-hidden rounded-3xl p-6 shadow-xl shadow-indigo-500/20 sm:p-8">
        <div className="animasi-melayang absolute -top-24 -right-16 h-72 w-72 rounded-full bg-fuchsia-400/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-sm font-medium text-white/75">{sapaan()},</div>
            <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{namaDepan(pengguna)} 👋</h1>
            <p className="mt-2 max-w-lg text-sm text-white/80">
              Unggah naskah .docx, pilih jurnal tujuan, dan dapatkan salinan berkomentar Word di setiap bagian yang belum sesuai template.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stat ? (
              <>
                <Chip ikon={ScanSearch} nilai={stat.total_cek} label="total pengecekan" />
                <Chip ikon={CalendarDays} nilai={stat.cek_minggu_ini} label="minggu ini" />
                <Chip ikon={Gauge} nilai={stat.rata_masalah?.toLocaleString("id-ID") ?? "–"} label="rata-rata masalah" />
                <Chip ikon={BadgeCheck} nilai={stat.siap_kirim} label="siap dikirim" />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => <div key={i} className="kaca h-[62px] w-36 animate-pulse rounded-2xl" />)
            )}
          </div>
        </div>
      </div>

      {galat && <div className="mb-4"><Pesan jenis="galat">{galat}</Pesan></div>}

      {jurnal && jurnal.length === 0 ? (
        <Kosong
          ikon={BookOpen}
          judul="Belum ada profil aturan jurnal"
          sub={pengguna?.peran === "admin" ? "Tambahkan jurnal dengan mengunggah template-nya. Sistem akan membaca aturannya secara otomatis." : "Minta admin menambahkan profil jurnal terlebih dahulu."}
          aksi={pengguna?.peran === "admin" && <Link to="/jurnal/baru"><Tombol varian="utama" ikon={Rocket}>Tambah jurnal dari template</Tombol></Link>}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Kartu className="space-y-6 p-5">
              <Langkah n={1} judul="Pilih jurnal tujuan">
                {jurnal === null ? (
                  <Kerangka className="h-11" />
                ) : (
                  <select className="input" value={pilihan} onChange={(e) => setPilihan(Number(e.target.value))}>
                    {jurnal.map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
                  </select>
                )}
                {jurnalDipilih && jurnalDipilih.bagian.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {jurnalDipilih.bagian.map((b) => <Lencana key={b}>{b}</Lencana>)}
                  </div>
                )}
              </Langkah>

              <Langkah n={2} judul="Unggah naskah">
                <ZonaUnggah
                  ganda
                  ringkas={antrian.length > 0}
                  label={antrian.length ? "Tambah naskah lain" : "Seret naskah .docx ke sini"}
                  sub="atau klik untuk memilih · bisa banyak sekaligus"
                  pilih={(f) => setAntrian((q) => [...q, ...f.map((berkas) => ({ berkas, status: "menunggu" as const }))])}
                />
              </Langkah>

              <Langkah n={3} judul="Opsi pemeriksaan">
                <div className="rounded-xl border border-line bg-panel-2 p-3.5">
                  <Sakelar
                    nyala={pakaiAI && aiBisa}
                    ubah={setPakaiAI}
                    nonaktif={!aiBisa}
                    label={<span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-violet-500" /> Cek substansi & scope dengan AI</span>}
                    keterangan={
                      !status?.ai_aktif
                        ? pengguna?.peran === "admin"
                          ? <>AI belum diatur — isi di <Link className="font-semibold text-brand underline" to="/pengaturan">Pengaturan</Link>.</>
                          : "AI belum diaktifkan oleh admin."
                        : !aiBisa
                          ? "Profil ini belum punya aturan naratif maupun Focus & Scope."
                          : [jurnalDipilih?.punya_scope && "kesesuaian scope (terima/tolak)",
                             jurnalDipilih?.jumlah_naratif ? `${jurnalDipilih.jumlah_naratif} aturan isi` : ""]
                              .filter(Boolean).join(" + ") + ` dinilai ${status.ai_model}.`
                    }
                  />
                  {pakaiAI && aiBisa && (
                    <p className="mt-2.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                      Isi naskah akan dikirim ke layanan AI. Pastikan sesuai kebijakan kerahasiaan jurnal.
                    </p>
                  )}
                </div>
              </Langkah>

              <Tombol varian="utama" ukuran="besar" className="w-full" ikon={ScanSearch} onClick={mulai} memuat={jalan} disabled={!menunggu || !pilihan}>
                {jalan ? "Memeriksa…" : menunggu ? `Periksa ${menunggu} naskah` : "Pilih naskah dulu"}
              </Tombol>
            </Kartu>

            {antrian.length > 0 && (
              <Kartu className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="text-sm font-bold">Antrean</span>
                  {selesai.length > 1 && (
                    <TautanTombol href={api.urlZip(selesai.map((a) => a.hasil!.id))} ukuran="kecil" varian="lembut" ikon={FolderDown}>
                      Unduh semua (.zip)
                    </TautanTombol>
                  )}
                </div>
                <div className="divide-y divide-line">
                  {antrian.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDibuka(i)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${dibuka === i ? "bg-brand-soft/60" : "hover:bg-panel-2"}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.status === "gagal" ? "bg-rose-500/10 text-rose-500" : "bg-brand-soft text-brand"}`}>
                        {a.status === "proses" ? <Putar /> : a.status === "gagal" ? <CircleX className="h-4 w-4" /> : a.status === "selesai" ? <CircleCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{a.berkas.name}</span>
                        <span className="text-[11px] text-ink-3">
                          {a.status === "menunggu" && "menunggu"}
                          {a.status === "proses" && "sedang diperiksa…"}
                          {a.status === "gagal" && "gagal"}
                          {a.status === "selesai" && a.hasil?.ringkasan && `${a.hasil.ringkasan.masalah} masalah · ${a.hasil.ringkasan.wajib} wajib`}
                        </span>
                      </span>
                      <LencanaScope keputusan={a.hasil?.scope?.keputusan} />
                      {a.status === "selesai" && a.hasil?.ringkasan && (
                        <Lencana jenis={a.hasil.ringkasan.wajib === 0 ? "sukses" : a.hasil.ringkasan.wajib <= 5 ? "saran" : "wajib"}>
                          {a.hasil.ringkasan.wajib === 0 ? "siap" : a.hasil.ringkasan.wajib <= 5 ? "minor" : "revisi"}
                        </Lencana>
                      )}
                      {!jalan && a.status !== "proses" && (
                        <span role="button" aria-label="Hapus dari antrean" className="rounded p-1 text-ink-3 hover:bg-panel-3 hover:text-rose-500"
                          onClick={(e) => { e.stopPropagation(); setAntrian((q) => q.filter((_, j) => j !== i)); }}>
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </Kartu>
            )}
          </div>

          <div className="min-w-0">
            {aktif?.hasil ? (
              <HasilCek cek={aktif.hasil} />
            ) : aktif?.status === "gagal" ? (
              <Pesan jenis="galat" judul={`Gagal memeriksa ${aktif.berkas.name}`}>{aktif.galat}</Pesan>
            ) : aktif?.status === "proses" ? (
              <Kartu className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
                <div className="relative">
                  <div className="bg-merek absolute inset-0 animate-ping rounded-2xl opacity-30" />
                  <div className="bg-merek relative flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg"><ScanSearch className="h-8 w-8" /></div>
                </div>
                <div>
                  <div className="font-bold text-ink">Memeriksa {aktif.berkas.name}</div>
                  <div className="mt-1 text-sm text-ink-3">Membaca format, struktur, referensi{pakaiAI && aiBisa ? ", lalu menilai substansi dengan AI" : ""}…</div>
                </div>
              </Kartu>
            ) : (
              <Kosong
                ikon={Clock}
                judul="Hasil pengecekan akan tampil di sini"
                sub="Setiap temuan juga ditulis sebagai komentar Word atas nama akun Anda, jadi penulis tinggal membuka berkasnya."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
