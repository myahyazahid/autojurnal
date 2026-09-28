import { ChevronRight, CircleCheck, CircleX, FolderDown, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, relatif, type Cek, type JurnalRingkas, type Status } from "../lib/api";
import { namaDepan, useAuth } from "../lib/auth";
import HasilCek from "../components/HasilCek";
import Membaca, { minimal } from "../components/Membaca";
import {
  IkonBerkas, JudulHalaman, Kartu, Kerangka, Kosong, Lencana, LencanaScope, Pesan, Sakelar, TautanTombol, Tombol, ZonaUnggah,
} from "../components/ui";

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

const ukuran = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`);

function LencanaFormat({ wajib }: { wajib: number }) {
  return (
    <Lencana jenis={wajib === 0 ? "sukses" : wajib <= 5 ? "saran" : "wajib"}>
      {wajib === 0 ? "Siap dikirim" : wajib <= 5 ? "Revisi minor" : "Perlu revisi"}
    </Lencana>
  );
}

/** Lima pengecekan terakhir milik pengguna: jalan pintas ke hasil yang baru saja dibuat. */
function TerakhirDiperiksa({ muatUlang }: { muatUlang: number }) {
  const [data, setData] = useState<Cek[] | null>(null);
  const [galat, setGalat] = useState(false);
  useEffect(() => {
    api.riwayat().then((d) => { setData(d.slice(0, 5)); setGalat(false); }).catch(() => setGalat(true));
  }, [muatUlang]);
  if (galat) return <p className="text-sm text-ink-2">Riwayat terakhir belum bisa dimuat.</p>;
  if (data === null) return <Membaca ukuran="kecil" mendatar judul="Memuat pengecekan terakhir…" className="py-4" />;
  if (data.length === 0) return null;
  return (
    <section aria-labelledby="judul-terakhir">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="judul-terakhir" className="text-[15px] font-semibold">Terakhir diperiksa</h2>
        <Link to="/riwayat" className="text-sm font-semibold text-brand-tinta hover:underline">Lihat semua riwayat</Link>
      </div>
      <Kartu>
        <ul className="divide-y divide-line">
          {data.map((c) => (
            <li key={c.id}>
              <Link to={`/riwayat/${c.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel-2 sm:px-5">
                <IkonBerkas ukuran={28} redup={!c.file_tersedia} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{c.nama_file}</span>
                  <span className="block truncate text-xs text-ink-2">{c.jurnal_nama} · {relatif(c.dibuat)}</span>
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  <LencanaScope keputusan={c.scope?.keputusan} />
                  {c.status === "gagal" ? <Lencana jenis="wajib">Gagal diperiksa</Lencana> : c.ringkasan && <LencanaFormat wajib={c.ringkasan.wajib} />}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Kartu>
    </section>
  );
}

export default function CekNaskah() {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  const [jurnal, setJurnal] = useState<JurnalRingkas[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [pilihan, setPilihan] = useState<number | "">("");
  const [pakaiAI, setPakaiAI] = useState(false);
  const [antrian, setAntrian] = useState<Antrian[]>([]);
  const [jalan, setJalan] = useState(false);
  const [dibuka, setDibuka] = useState(0);
  const [galat, setGalat] = useState("");
  const [putaran, setPutaran] = useState(0);
  const idJurnal = useId();
  const refHasil = useRef<HTMLElement>(null);

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

  useEffect(() => {
    muatJurnal();
    api.status().then(setStatus).catch(() => undefined);
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
    let pertama = true;
    for (let i = 0; i < daftar.length; i++) {
      if (daftar[i].status === "selesai") continue;
      setDibuka(i);
      setAntrian((q) => q.map((a, j) => (j === i ? { ...a, status: "proses" } : a)));
      if (pertama) {
        pertama = false;
        const halus = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        requestAnimationFrame(() => refHasil.current?.scrollIntoView({ behavior: halus ? "smooth" : "auto", block: "start" }));
      }
      try {
        const hasil = await minimal(api.cek(daftar[i].berkas, Number(pilihan), pakaiAI && aiBisa));
        setAntrian((q) => q.map((a, j) => (j === i ? { ...a, status: hasil.status === "gagal" ? "gagal" : "selesai", hasil, galat: hasil.pesan_galat } : a)));
      } catch (e) {
        setAntrian((q) => q.map((a, j) => (j === i ? { ...a, status: "gagal", galat: (e as Error).message } : a)));
      }
    }
    setJalan(false);
    setPutaran((p) => p + 1);
  }

  function hapus(i: number) {
    setAntrian((q) => q.filter((_, j) => j !== i));
    setDibuka((d) => (d > i ? d - 1 : d === i ? 0 : d));
  }

  const selesai = antrian.filter((a) => a.hasil?.status === "selesai");
  const menunggu = antrian.filter((a) => a.status !== "selesai").length;
  const aktif = antrian[dibuka];
  const adaHasil = antrian.some((a) => a.status !== "menunggu");

  return (
    <>
      <JudulHalaman
        judul="Cek naskah"
        sub={`${sapaan()}, ${namaDepan(pengguna)}. Unggah naskah .docx dan pilih jurnal tujuan. Hasilnya berupa salinan naskah yang berisi komentar Word.`}
      />

      {galat && (
        <div className="mb-5">
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
        <div className="space-y-8">
          <Kartu className="grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* ------------ unggah ------------ */}
            <div className="flex flex-col p-4 sm:p-6">
              <ZonaUnggah
                ganda
                className={antrian.length ? "" : "flex-1"}
                ringkas={antrian.length > 0}
                label={antrian.length ? "Tambah naskah lain" : "Seret naskah .docx ke sini"}
                sub={antrian.length ? "Seret ke sini atau klik untuk memilih" : "Bisa beberapa naskah sekaligus"}
                pilih={(f) => setAntrian((q) => [...q, ...f.map((berkas) => ({ berkas, status: "menunggu" as const }))])}
              />
              {antrian.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold">Naskah <span className="font-normal text-ink-2">({antrian.length})</span></h2>
                    {selesai.length > 1 && (
                      <TautanTombol href={api.urlZip(selesai.map((a) => a.hasil!.id))} ukuran="kecil" varian="lembut" ikon={FolderDown}>
                        Unduh semua (.zip)
                      </TautanTombol>
                    )}
                  </div>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {antrian.map((a, i) => {
                      const r = a.hasil?.ringkasan;
                      return (
                        <li key={i} className={`flex items-center ${dibuka === i && adaHasil ? "bg-brand-soft/60" : ""}`}>
                          <button
                            type="button"
                            onClick={() => setDibuka(i)}
                            aria-current={dibuka === i ? "true" : undefined}
                            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm"
                          >
                            <IkonBerkas ukuran={28} redup={a.status === "menunggu"} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-ink">{a.berkas.name}</span>
                              <span className="flex items-center gap-1.5 text-xs text-ink-2">
                                {a.status === "menunggu" && `${ukuran(a.berkas.size)} · menunggu`}
                                {a.status === "proses" && <><LoaderCircle className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden /> sedang diperiksa…</>}
                                {a.status === "gagal" && <><CircleX className="h-3.5 w-3.5 text-bahaya" aria-hidden /> gagal diperiksa</>}
                                {a.status === "selesai" && r && <><CircleCheck className="h-3.5 w-3.5 text-ok" aria-hidden /> {r.masalah} masalah, {r.wajib} wajib</>}
                              </span>
                            </span>
                            <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                              <LencanaScope keputusan={a.hasil?.scope?.keputusan} />
                              {a.status === "selesai" && r && <LencanaFormat wajib={r.wajib} />}
                            </span>
                          </button>
                          {!jalan && a.status !== "proses" && (
                            <button
                              type="button"
                              aria-label={`Hapus ${a.berkas.name} dari daftar`}
                              onClick={() => hapus(i)}
                              className="ketuk mr-1.5 inline-flex shrink-0 items-center justify-center rounded-md p-2 text-ink-3 hover:bg-panel-3 hover:text-bahaya"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* ------------ pengaturan ------------ */}
            <div className="flex flex-col gap-5 border-t border-line bg-panel-2 p-4 sm:p-6 lg:border-t-0 lg:border-l">
              <div>
                <label htmlFor={idJurnal} className="label">Jurnal tujuan</label>
                {jurnal === null && !galat ? (
                  <Kerangka className="h-10" />
                ) : (
                  <select id={idJurnal} className="input" value={pilihan} disabled={!jurnal} onChange={(e) => setPilihan(Number(e.target.value))}>
                    {(jurnal ?? []).map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
                  </select>
                )}
                {jurnalDipilih && jurnalDipilih.bagian.length > 0 && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-2">
                    <span className="font-medium text-ink">Struktur: </span>
                    {jurnalDipilih.bagian.join(" · ")}
                  </p>
                )}
              </div>

              <div className="border-t border-line pt-5">
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
                        : [jurnalDipilih?.punya_scope && "Kesesuaian scope",
                           jurnalDipilih?.jumlah_naratif ? `${jurnalDipilih.jumlah_naratif} aturan isi` : ""]
                            .filter(Boolean).join(" dan ") + `, dinilai ${status.ai_model}.`
                  }
                />
                {pakaiAI && aiBisa && (
                  <p className="mt-3 rounded-md bg-waspada-soft px-3 py-2 text-xs text-waspada">
                    Isi naskah akan dikirim ke layanan AI. Pastikan sesuai kebijakan kerahasiaan jurnal.
                  </p>
                )}
              </div>

              <div className="mt-auto space-y-3 border-t border-line pt-5">
                <Tombol varian="utama" ukuran="besar" className="w-full" onClick={mulai} memuat={jalan} disabled={!menunggu || !pilihan}>
                  {jalan ? "Memeriksa…" : menunggu ? `Periksa ${menunggu} naskah` : antrian.length ? "Semua naskah sudah diperiksa" : "Unggah naskah dulu"}
                </Tombol>
                <p className="flex items-start gap-2 text-xs text-ink-2">
                  <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  Naskah unggahan langsung dihapus setelah diperiksa. Salinan berkomentar disimpan sementara.
                </p>
              </div>
            </div>
          </Kartu>

          <section ref={refHasil} aria-label="Hasil pengecekan" className="scroll-mt-20">
            {aktif?.hasil ? (
              <HasilCek cek={aktif.hasil} />
            ) : aktif?.status === "gagal" ? (
              <Pesan jenis="galat" judul={`Gagal memeriksa ${aktif.berkas.name}`}>
                {aktif.galat || "Tidak ada keterangan dari server."} Periksa berkasnya lalu tekan Periksa lagi.
              </Pesan>
            ) : aktif?.status === "proses" ? (
              <Kartu className="px-6 py-10">
                <Membaca
                  ukuran="besar"
                  judul={`Memeriksa ${aktif.berkas.name}`}
                  sub={`Bot membaca naskah sesuai aturan template${pakaiAI && aiBisa ? ", lalu AI menilai substansinya" : ""}.`}
                  langkah={pakaiAI && aiBisa ? [...["Membaca tata letak dan format", "Memeriksa struktur dan judul bagian", "Menghitung kata, halaman, dan kata kunci", "Mencocokkan sitasi dengan daftar pustaka", "Memeriksa tabel dan gambar", "Menulis komentar ke naskah"], "AI menilai aturan isi dan Focus & Scope"] : ["Membaca tata letak dan format", "Memeriksa struktur dan judul bagian", "Menghitung kata, halaman, dan kata kunci", "Mencocokkan sitasi dengan daftar pustaka", "Memeriksa tabel dan gambar", "Menulis komentar ke naskah"]}
                />
              </Kartu>
            ) : (
              <TerakhirDiperiksa muatUlang={putaran} />
            )}
          </section>
        </div>
      )}
    </>
  );
}
