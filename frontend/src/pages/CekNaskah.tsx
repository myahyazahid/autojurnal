import { CircleCheck, CircleX, FileText, FolderDown, Plus, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
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

/** Angka dari /api/statistik, ditulis sebaris agar tidak bersaing dengan area unggah. */
function StatistikRingkas({ stat, galat }: { stat: StatistikDasbor | null; galat: boolean }) {
  if (galat) return <p className="text-sm text-ink-2">Statistik pengecekan belum bisa dimuat.</p>;
  if (!stat) return <Kerangka className="h-11 w-72" />;
  const butir: [string, ReactNode][] = [
    ["total pengecekan", stat.total_cek],
    ["minggu ini", stat.cek_minggu_ini],
    ["rata-rata masalah", stat.rata_masalah?.toLocaleString("id-ID") ?? "belum ada"],
    ["siap dikirim", stat.siap_kirim],
  ];
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3">
      {butir.map(([label, nilai]) => (
        <div key={label}>
          <dt className="text-xs text-ink-2">{label}</dt>
          <dd className="font-serif text-xl leading-tight font-semibold text-ink tabular-nums">{nilai}</dd>
        </div>
      ))}
    </dl>
  );
}

function Langkah({ n, judul, id, children }: { n: number; judul: string; id?: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
      <span className="font-serif text-lg leading-6 font-semibold text-ink-3" aria-hidden>{n}</span>
      <div className="min-w-0">
        {id ? (
          <label htmlFor={id} className="mb-2.5 block text-sm leading-6 font-semibold text-ink">{judul}</label>
        ) : (
          <h2 className="mb-2.5 text-sm leading-6 font-semibold text-ink">{judul}</h2>
        )}
        {children}
      </div>
    </li>
  );
}

export default function CekNaskah() {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  const [jurnal, setJurnal] = useState<JurnalRingkas[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [stat, setStat] = useState<StatistikDasbor | null>(null);
  const [galatStat, setGalatStat] = useState(false);
  const [pilihan, setPilihan] = useState<number | "">("");
  const [pakaiAI, setPakaiAI] = useState(false);
  const [antrian, setAntrian] = useState<Antrian[]>([]);
  const [jalan, setJalan] = useState(false);
  const [dibuka, setDibuka] = useState(0);
  const [galat, setGalat] = useState("");
  const idJurnal = useId();

  const muatJurnal = () => {
    setGalat("");
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
  };
  const muatStat = () => api.statistik().then((s) => { setStat(s); setGalatStat(false); }).catch(() => setGalatStat(true));

  useEffect(() => {
    muatJurnal();
    api.status().then(setStatus).catch(() => undefined);
    muatStat();
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
    muatStat();
  }

  function hapus(i: number) {
    setAntrian((q) => q.filter((_, j) => j !== i));
    setDibuka((d) => (d > i ? d - 1 : d === i ? 0 : d));
  }

  const selesai = antrian.filter((a) => a.hasil?.status === "selesai");
  const menunggu = antrian.filter((a) => a.status !== "selesai").length;
  const aktif = antrian[dibuka];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 sm:mb-8">
        <div className="min-w-0">
          <p className="text-sm text-ink-2">{sapaan()}, {namaDepan(pengguna)}</p>
          <h1 className="mt-1 font-serif text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]">Cek naskah</h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-2">
            Pilih jurnal tujuan, unggah naskah .docx, lalu unduh salinan yang berisi komentar Word di setiap bagian yang belum sesuai template.
          </p>
        </div>
        <StatistikRingkas stat={stat} galat={galatStat} />
      </div>

      {galat && (
        <div className="mb-4">
          <Pesan jenis="galat" judul="Daftar jurnal tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muatJurnal}>Coba lagi</Tombol>}>{galat}</Pesan>
        </div>
      )}

      {jurnal && jurnal.length === 0 ? (
        <Kosong
          judul="Belum ada profil aturan jurnal"
          sub={admin ? "Tambahkan jurnal dengan mengunggah template-nya. Sistem membaca aturannya dari berkas itu." : "Minta admin menambahkan profil jurnal terlebih dahulu."}
          aksi={admin && <TautanTombol ke="/jurnal/baru" varian="utama" ikon={Plus}>Tambah jurnal dari template</TautanTombol>}
        />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Kartu className="p-5">
              <ol className="space-y-6">
                <Langkah n={1} judul="Pilih jurnal tujuan" id={idJurnal}>
                  {jurnal === null && !galat ? (
                    <Kerangka className="h-11" />
                  ) : (
                    <select id={idJurnal} className="input" value={pilihan} disabled={!jurnal} onChange={(e) => setPilihan(Number(e.target.value))}>
                      {(jurnal ?? []).map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
                    </select>
                  )}
                  {jurnalDipilih && jurnalDipilih.bagian.length > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-ink-2">
                      <span className="font-semibold text-ink">Struktur: </span>
                      {jurnalDipilih.bagian.join(" · ")}
                    </p>
                  )}
                </Langkah>

                <Langkah n={2} judul="Unggah naskah">
                  <ZonaUnggah
                    ganda
                    ringkas={antrian.length > 0}
                    label={antrian.length ? "Tambah naskah lain" : "Seret naskah .docx ke sini"}
                    sub="atau klik untuk memilih, bisa beberapa sekaligus"
                    pilih={(f) => setAntrian((q) => [...q, ...f.map((berkas) => ({ berkas, status: "menunggu" as const }))])}
                  />
                </Langkah>

                <Langkah n={3} judul="Opsi pemeriksaan">
                  <div className="rounded-lg border border-line bg-panel-2 p-3.5">
                    <Sakelar
                      nyala={pakaiAI && aiBisa}
                      ubah={setPakaiAI}
                      nonaktif={!aiBisa}
                      label="Nilai substansi & scope dengan AI"
                      keterangan={
                        !status?.ai_aktif
                          ? admin
                            ? <>AI belum diatur. Isi di <Link className="font-semibold text-brand-tinta underline" to="/pengaturan">Pengaturan</Link>.</>
                            : "AI belum diaktifkan oleh admin."
                          : !aiBisa
                            ? "Profil ini belum punya aturan naratif maupun Focus & Scope."
                            : [jurnalDipilih?.punya_scope && "kesesuaian scope (terima/tolak)",
                               jurnalDipilih?.jumlah_naratif ? `${jurnalDipilih.jumlah_naratif} aturan isi` : ""]
                                .filter(Boolean).join(" + ") + `, dinilai ${status.ai_model}.`
                      }
                    />
                    {pakaiAI && aiBisa && (
                      <p className="mt-3 rounded-md bg-waspada-soft px-2.5 py-2 text-xs text-waspada">
                        Isi naskah akan dikirim ke layanan AI. Pastikan sesuai kebijakan kerahasiaan jurnal.
                      </p>
                    )}
                  </div>
                </Langkah>
              </ol>

              <Tombol varian="utama" ukuran="besar" className="mt-6 w-full" onClick={mulai} memuat={jalan} disabled={!menunggu || !pilihan}>
                {jalan ? "Memeriksa…" : menunggu ? `Periksa ${menunggu} naskah` : "Unggah naskah dulu"}
              </Tombol>
            </Kartu>

            {antrian.length > 0 && (
              <Kartu className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <h2 className="text-sm font-semibold">Antrean <span className="font-normal text-ink-2">({antrian.length})</span></h2>
                  {selesai.length > 1 && (
                    <TautanTombol href={api.urlZip(selesai.map((a) => a.hasil!.id))} ukuran="kecil" varian="lembut" ikon={FolderDown}>
                      Unduh semua (.zip)
                    </TautanTombol>
                  )}
                </div>
                <ul className="divide-y divide-line">
                  {antrian.map((a, i) => (
                    <li key={i} className={`flex items-center ${dibuka === i ? "bg-panel-2" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setDibuka(i)}
                        aria-current={dibuka === i ? "true" : undefined}
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-panel-2"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                          {a.status === "proses" ? <Putar /> : a.status === "gagal" ? <CircleX className="h-5 w-5 text-brand-tinta" /> : a.status === "selesai" ? <CircleCheck className="h-5 w-5 text-ok" /> : <FileText className="h-5 w-5 text-ink-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate ${dibuka === i ? "font-semibold" : "font-medium"} text-ink`}>{a.berkas.name}</span>
                          <span className="text-xs text-ink-2">
                            {a.status === "menunggu" && "menunggu"}
                            {a.status === "proses" && "sedang diperiksa…"}
                            {a.status === "gagal" && "gagal diperiksa"}
                            {a.status === "selesai" && a.hasil?.ringkasan && `${a.hasil.ringkasan.masalah} masalah, ${a.hasil.ringkasan.wajib} wajib`}
                          </span>
                        </span>
                        <LencanaScope keputusan={a.hasil?.scope?.keputusan} />
                        {a.status === "selesai" && a.hasil?.ringkasan && (
                          <Lencana jenis={a.hasil.ringkasan.wajib === 0 ? "sukses" : a.hasil.ringkasan.wajib <= 5 ? "saran" : "wajib"}>
                            {a.hasil.ringkasan.wajib === 0 ? "siap" : a.hasil.ringkasan.wajib <= 5 ? "minor" : "revisi"}
                          </Lencana>
                        )}
                      </button>
                      {!jalan && a.status !== "proses" && (
                        <button
                          type="button"
                          aria-label={`Hapus ${a.berkas.name} dari antrean`}
                          onClick={() => hapus(i)}
                          className="ketuk mr-2 inline-flex shrink-0 items-center justify-center rounded-md p-2 text-ink-2 hover:bg-panel-3 hover:text-brand-tinta"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Kartu>
            )}
          </div>

          <section aria-label="Hasil pengecekan" className="min-w-0">
            {aktif?.hasil ? (
              <HasilCek cek={aktif.hasil} />
            ) : aktif?.status === "gagal" ? (
              <Pesan jenis="galat" judul={`Gagal memeriksa ${aktif.berkas.name}`}>
                {aktif.galat || "Tidak ada keterangan dari server."} Periksa berkasnya lalu tekan Periksa lagi.
              </Pesan>
            ) : aktif?.status === "proses" ? (
              <Kartu className="flex items-center gap-4 px-6 py-10">
                <Putar besar />
                <div role="status" className="min-w-0">
                  <div className="truncate font-semibold text-ink">Memeriksa {aktif.berkas.name}</div>
                  <div className="mt-0.5 text-sm text-ink-2">Membaca format, struktur, dan referensi{pakaiAI && aiBisa ? ", lalu menilai substansi dengan AI" : ""}.</div>
                </div>
              </Kartu>
            ) : (
              <Kosong
                judul={antrian.length ? "Naskah siap diperiksa" : "Hasil pengecekan tampil di sini"}
                sub={
                  antrian.length
                    ? `Tekan "Periksa ${menunggu} naskah" untuk memulai.`
                    : "Setiap temuan juga ditulis sebagai komentar Word atas nama akun Anda, jadi penulis tinggal membuka berkasnya."
                }
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
