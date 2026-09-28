import { BookOpen, MessageSquareText, RotateCcw, Save, Search } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type EntriKomentar, type JurnalRingkas, type KatalogKomentar } from "../lib/api";
import { useToast } from "../lib/toast";
import { JudulHalaman, Kartu, KepalaKartu, Kerangka, Kosong, Lencana, Pesan, Sakelar, TautanTombol, Tombol } from "../components/ui";

type Saring = "semua" | "diubah" | "mati";

/* Sama dengan idpattern string.Template di backend: $nama atau ${nama}, nama tidak diawali angka. $$ = tanda $ biasa. */
const RX_VAR = /\$(?:\{([_a-zA-Z]\w*)\}|([_a-zA-Z]\w*))/g;
const RX_PRATINJAU = /\$\$|\$(?:\{([_a-zA-Z]\w*)\}|([_a-zA-Z]\w*))/g;

function galatKalimat(e: EntriKomentar, teks: string, maks: number): string | null {
  if (!teks.trim()) return "Kalimat tidak boleh kosong. Tekan Kembalikan bawaan untuk memakai kalimat awal.";
  if (teks.length > maks) return `Kalimat terlalu panjang: ${teks.length} karakter, maksimal ${maks}.`;
  const boleh = new Set(e.variabel.map((v) => v.nama));
  const dipakai = [...teks.replaceAll("$$", "").matchAll(RX_VAR)].map((m) => m[1] ?? m[2]);
  const asing = [...new Set(dipakai)].filter((n) => !boleh.has(n));
  if (!asing.length) return null;
  const daftar = asing.map((a) => `$${a}`).join(", ");
  return boleh.size
    ? `${daftar} tidak dikenal. Pakai variabel yang tersedia di bawah.`
    : `${daftar} tidak dikenal. Kalimat ini tidak punya variabel; tulis sebagai teks biasa atau ketik $$ untuk tanda $.`;
}

/** Kalimat dengan variabel diganti nilai contoh; variabel tak dikenal ditandai merah. */
function Pratinjau({ e, teks }: { e: EntriKomentar; teks: string }) {
  const contoh = new Map(e.variabel.map((v) => [v.nama, v.contoh]));
  const isi: ReactNode[] = [];
  let posisi = 0;
  for (const m of teks.matchAll(RX_PRATINJAU)) {
    isi.push(teks.slice(posisi, m.index));
    const nama = m[1] ?? m[2];
    if (m[0] === "$$") isi.push("$");
    else if (contoh.has(nama)) isi.push(<span key={m.index} className="font-semibold text-ink">{contoh.get(nama)}</span>);
    else isi.push(<span key={m.index} className="font-semibold text-bahaya underline decoration-wavy underline-offset-2">{m[0]}</span>);
    posisi = m.index + m[0].length;
  }
  isi.push(teks.slice(posisi));
  return <>{isi}</>;
}

function BarisKomentar({ e, nilai, asli, ubah, maks, aktif, aktifAsli, setAktif }: {
  e: EntriKomentar; nilai: string; asli: string; ubah: (v: string) => void; maks: number;
  aktif: boolean; aktifAsli: boolean; setAktif: (v: boolean) => void;
}) {
  const id = useId();
  const ta = useRef<HTMLTextAreaElement>(null);
  const pernahFokus = useRef(false);
  const kursor = useRef<number | null>(null);
  const galat = galatKalimat(e, nilai, maks);
  const diubah = nilai.trim() !== e.bawaan;
  const belumDisimpan = nilai !== asli || aktif !== aktifAsli;

  function sisip(nama: string) {
    const el = ta.current;
    // sebelum kotak pernah disentuh, variabel ditambahkan di akhir kalimat
    const diKursor = el !== null && pernahFokus.current;
    const awal = diKursor ? el.selectionStart : nilai.length;
    const akhir = diKursor ? el.selectionEnd : nilai.length;
    const spasi = !diKursor && nilai && !/\s$/.test(nilai) ? " " : "";
    // ${nama} bila langsung disambung huruf/angka, agar tidak terbaca sebagai variabel lain
    const token = spasi + (/^\w/.test(nilai.slice(akhir)) ? `\${${nama}}` : `$${nama}`);
    kursor.current = awal + token.length;
    ubah(nilai.slice(0, awal) + token + nilai.slice(akhir));
  }

  // kembalikan fokus ke kotak setelah variabel disisipkan, agar ketikan berikutnya tidak menekan tombol variabel lagi
  useLayoutEffect(() => {
    const el = ta.current;
    if (kursor.current === null || !el) return;
    el.focus();
    el.setSelectionRange(kursor.current, kursor.current);
    kursor.current = null;
  }, [nilai]);

  return (
    <div className={`px-4 py-4 sm:px-5 ${aktif ? "" : "bg-panel-2"}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <label htmlFor={id} className={`text-sm font-semibold ${aktif ? "text-ink" : "text-ink-2"}`}>{e.judul}</label>
          {!aktif && <Lencana>Nonaktif</Lencana>}
          {diubah && <Lencana jenis="ai">Diubah</Lencana>}
          {e.tingkat === "saran" && <Lencana jenis="saran">Saran</Lencana>}
          {belumDisimpan && <span className="text-xs font-medium text-waspada">Belum disimpan</span>}
          <code className="w-full text-xs break-all text-ink-3">{e.kode}</code>
        </div>
        <Sakelar nyala={aktif} ubah={setAktif} label={aktif ? "Aktif" : "Nonaktif"} labelAria={`Aktifkan komentar ${e.judul}`} />
      </div>
      {!aktif && <p className="mt-2 text-xs text-ink-2">Temuan ini tidak dilaporkan di hasil cek maupun di naskah Word untuk jurnal ini.</p>}
      <textarea
        ref={ta}
        id={id}
        rows={2}
        value={nilai}
        onChange={(ev) => ubah(ev.target.value)}
        onFocus={() => (pernahFokus.current = true)}
        aria-invalid={galat ? true : undefined}
        aria-describedby={`${id}-contoh${galat ? ` ${id}-galat` : ""}`}
        className={`input mt-2 resize-y [field-sizing:content] ${galat ? "border-bahaya hover:border-bahaya" : ""} ${aktif ? "" : "text-ink-2"}`}
      />
      {galat && <p id={`${id}-galat`} className="mt-1.5 text-xs font-medium text-bahaya">{galat}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {e.variabel.length > 0 ? (
          <>
            <span className="mr-0.5 text-xs text-ink-2">Sisipkan:</span>
            {e.variabel.map((v) => (
              <button
                key={v.nama}
                type="button"
                onClick={() => sisip(v.nama)}
                aria-label={`Sisipkan $${v.nama}, ${v.arti}`}
                className="ketuk inline-flex items-center gap-1.5 rounded-md border border-line-2 bg-panel px-2 py-1 text-left text-xs transition-colors hover:border-isian hover:bg-panel-2"
              >
                <code className="font-semibold text-brand-tinta">${v.nama}</code>
                <span className="text-ink-2">{v.arti}</span>
              </button>
            ))}
          </>
        ) : (
          <span className="text-xs text-ink-2">Kalimat ini tanpa variabel.</span>
        )}
        {diubah && (
          <Tombol varian="hantu" ukuran="kecil" ikon={RotateCcw} className="ml-auto" onClick={() => ubah(e.bawaan)}>
            Kembalikan bawaan
          </Tombol>
        )}
      </div>
      <p id={`${id}-contoh`} className="mt-2.5 rounded-lg bg-panel-2 px-3 py-2 text-[13px] leading-relaxed break-words text-ink-2">
        <span className="mr-2 text-xs font-semibold text-ink-3">Contoh</span>
        <Pratinjau e={e} teks={nilai} />
      </p>
    </div>
  );
}

const idGrup = (g: string) => `grup-${g.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export default function Komentar() {
  const toast = useToast();
  const [param, setParam] = useSearchParams();
  const [katalog, setKatalog] = useState<KatalogKomentar | null>(null);
  const [jurnal, setJurnal] = useState<JurnalRingkas[] | null>(null);
  const [galatAwal, setGalatAwal] = useState("");
  const [tersimpan, setTersimpan] = useState<Record<string, string> | null>(null);
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [matiTersimpan, setMatiTersimpan] = useState<Set<string>>(new Set());
  const [matiDraf, setMatiDraf] = useState<Set<string>>(new Set());
  const [galatJurnal, setGalatJurnal] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<Saring>("semua");
  const [muatUlang, setMuatUlang] = useState(0);
  const idJurnal = useId();
  const idCari = useId();

  function muatAwal() {
    setGalatAwal("");
    Promise.all([api.katalogKomentar(), api.daftarJurnal()])
      .then(([k, j]) => {
        setKatalog(k);
        setJurnal(j);
      })
      .catch((e) => setGalatAwal(e.message));
  }
  useEffect(muatAwal, []);

  const jidParam = Number(param.get("jurnal"));
  const jid = jurnal?.some((j) => j.id === jidParam) ? jidParam : jurnal?.[0]?.id;
  const jurnalAktif = jurnal?.find((j) => j.id === jid);

  useEffect(() => {
    if (!jid || !katalog) return;
    let batal = false;
    setTersimpan(null);
    setGalatJurnal("");
    api.komentarJurnal(jid)
      .then((d) => {
        if (batal) return;
        setTersimpan(d.teks);
        setDraf(Object.fromEntries(katalog.entri.map((e) => [e.kode, d.teks[e.kode] ?? e.bawaan])));
        setMatiTersimpan(new Set(d.mati));
        setMatiDraf(new Set(d.mati));
      })
      .catch((e) => !batal && setGalatJurnal(e.message));
    return () => {
      batal = true;
    };
  }, [jid, katalog, muatUlang]);

  const asli = (e: EntriKomentar) => tersimpan?.[e.kode] ?? e.bawaan;
  const entri = katalog?.entri ?? [];
  const berubah = tersimpan ? entri.filter((e) => draf[e.kode] !== asli(e) || matiDraf.has(e.kode) !== matiTersimpan.has(e.kode)) : [];
  const jumlahMati = entri.filter((e) => matiDraf.has(e.kode)).length;
  const bergalat = tersimpan ? entri.filter((e) => galatKalimat(e, draf[e.kode] ?? "", katalog!.maks_panjang)) : [];
  const jumlahDiubah = tersimpan ? entri.filter((e) => (draf[e.kode] ?? "").trim() !== e.bawaan).length : 0;

  useEffect(() => {
    if (!berubah.length) return;
    const tahan = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", tahan);
    return () => window.removeEventListener("beforeunload", tahan);
  }, [berubah.length]);

  const perGrup = useMemo(() => {
    if (!katalog) return [];
    const kata = cari.toLowerCase().split(/\s+/).filter(Boolean);
    return katalog.grup
      .map((g) => ({
        grup: g,
        semua: katalog.entri.filter((e) => e.grup === g),
        tampil: katalog.entri.filter((e) => {
          if (e.grup !== g) return false;
          // cocokkan dengan kalimat tersimpan, bukan yang sedang diketik, agar baris tidak hilang saat disunting
          const simpanan = tersimpan?.[e.kode] ?? e.bawaan;
          if (saring === "diubah" && (draf[e.kode] ?? e.bawaan).trim() === e.bawaan && simpanan === e.bawaan) return false;
          // baris yang baru dinyalakan tetap tampil sampai disimpan, agar tidak hilang saat diklik
          if (saring === "mati" && !matiDraf.has(e.kode) && !matiTersimpan.has(e.kode)) return false;
          const bahan = `${e.judul} ${e.kode} ${e.bawaan} ${simpanan}`.toLowerCase();
          return kata.every((k) => bahan.includes(k));
        }),
      }))
      .filter((g) => g.semua.length > 0);
  }, [katalog, tersimpan, draf, cari, saring, matiDraf, matiTersimpan]);
  const jumlahTampil = perGrup.reduce((n, g) => n + g.tampil.length, 0);

  function pilihJurnal(id: number) {
    if (berubah.length && !confirm(`Ada ${berubah.length} kalimat yang belum disimpan untuk ${jurnalAktif?.nama}. Buang perubahan itu dan pindah jurnal?`)) return;
    setParam({ jurnal: String(id) }, { replace: true });
  }

  function lompat(g: string) {
    const halus = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(idGrup(g))?.scrollIntoView({ behavior: halus ? "smooth" : "auto", block: "start" });
  }

  function batal() {
    setDraf(Object.fromEntries(entri.map((e) => [e.kode, asli(e)])));
    setMatiDraf(new Set(matiTersimpan));
  }

  function setAktif(kode: string, aktif: boolean) {
    setMatiDraf((m) => {
      const baru = new Set(m);
      if (aktif) baru.delete(kode);
      else baru.add(kode);
      return baru;
    });
  }

  async function simpan() {
    if (!jid || !katalog || bergalat.length) return;
    setMenyimpan(true);
    try {
      const kirim = Object.fromEntries(
        entri.filter((e) => draf[e.kode].trim() !== e.bawaan).map((e) => [e.kode, draf[e.kode].trim()]),
      );
      const d = await api.simpanKomentar(jid, kirim, [...matiDraf]);
      setTersimpan(d.teks);
      setDraf(Object.fromEntries(entri.map((e) => [e.kode, d.teks[e.kode] ?? e.bawaan])));
      setMatiTersimpan(new Set(d.mati));
      setMatiDraf(new Set(d.mati));
      toast("sukses", "Kalimat komentar tersimpan", `Berlaku untuk pengecekan berikutnya di ${jurnalAktif?.nama}.`);
    } catch (e) {
      toast("galat", "Gagal menyimpan", (e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  }

  const judul = (
    <JudulHalaman
      judul="Komentar"
      sub={<>Kalimat yang ditulis ke naskah Word dan tampil di hasil cek. Ubah kata-katanya atau matikan yang tidak perlu, per profil jurnal. Bagian berawalan <code className="font-semibold text-ink">$</code> diisi otomatis saat pengecekan, misalnya <code className="font-semibold text-ink">$jumlah</code> menjadi 18.</>}
    />
  );

  if (galatAwal)
    return (
      <>
        {judul}
        <Pesan jenis="galat" judul="Katalog komentar tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muatAwal}>Coba lagi</Tombol>}>{galatAwal}</Pesan>
      </>
    );
  if (!katalog || !jurnal)
    return (
      <>
        {judul}
        <div className="space-y-3" role="status" aria-label="Memuat katalog komentar">
          <Kerangka className="h-20" />
          {[0, 1, 2].map((i) => <Kerangka key={i} className="h-40" />)}
        </div>
      </>
    );
  if (!jurnal.length)
    return (
      <>
        {judul}
        <Kosong
          ikon={BookOpen}
          judul="Belum ada profil jurnal"
          sub="Kalimat komentar diatur per profil jurnal. Buat profil dari template jurnal terlebih dahulu."
          aksi={<TautanTombol ke="/jurnal/baru" varian="utama">Buat profil jurnal</TautanTombol>}
        />
      </>
    );

  return (
    <>
      {judul}
      <Kartu className="mb-6 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div>
            <label htmlFor={idJurnal} className="label">Profil jurnal</label>
            <select id={idJurnal} className="input" value={jid} onChange={(e) => pilihJurnal(Number(e.target.value))}>
              {jurnal.map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={idCari} className="label">Cari kalimat</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input id={idCari} type="search" className="input pl-9" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="mis. judul, margin, sitasi" />
            </div>
          </div>
          <div role="group" aria-label="Tampilkan" className="grid grid-cols-3 gap-1 rounded-lg bg-panel-3 p-1">
            {([["semua", `Semua (${entri.length})`], ["diubah", `Diubah (${jumlahDiubah})`], ["mati", `Nonaktif (${jumlahMati})`]] as const).map(([nilai, label]) => (
              <button
                key={nilai}
                type="button"
                aria-pressed={saring === nilai}
                onClick={() => setSaring(nilai)}
                className={`ketuk rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  saring === nilai ? "bg-panel text-ink shadow-[0_1px_2px_rgba(15,23,41,0.12)]" : "text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-2">
          Kalimat bertanda <b className="font-semibold text-waspada">Saran</b> hanya ditulis ke Word bila pengaturan profil “Tulis temuan SARAN ke naskah Word” dinyalakan. Di halaman hasil cek, kalimat ini selalu tampil.
        </p>
      </Kartu>

      {galatJurnal ? (
        <Pesan jenis="galat" judul="Kalimat komentar jurnal ini tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={() => setMuatUlang((n) => n + 1)}>Coba lagi</Tombol>}>
          {galatJurnal}
        </Pesan>
      ) : !tersimpan ? (
        <div className="space-y-3" role="status" aria-label="Memuat kalimat komentar">{[0, 1, 2].map((i) => <Kerangka key={i} className="h-40" />)}</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8">
          <nav aria-label="Kelompok komentar" className="lg:sticky lg:top-6">
            <div className="mb-2 hidden px-3 text-xs font-medium text-ink-3 lg:block">Kelompok</div>
            <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
              {perGrup.map((g) => {
                const diubah = g.semua.filter((e) => (draf[e.kode] ?? "").trim() !== e.bawaan).length;
                return (
                  <li key={g.grup} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => lompat(g.grup)}
                      disabled={!g.tampil.length}
                      className="ketuk flex w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap text-ink-2 transition-colors hover:bg-panel-3 hover:text-ink disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent lg:border-0 lg:bg-transparent lg:whitespace-normal"
                    >
                      <span className="flex-1">{g.grup}</span>
                      {diubah > 0 && <span className="text-xs font-semibold text-brand-tinta" aria-label={`${diubah} diubah`}>{diubah}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 space-y-4">
            {jumlahTampil === 0 ? (
              <Kosong
                ringkas
                ikon={MessageSquareText}
                judul={saring === "diubah" && !cari ? "Belum ada kalimat yang diubah" : saring === "mati" && !cari ? "Semua komentar aktif" : "Tidak ada kalimat yang cocok"}
                sub={saring === "diubah" && !cari ? `Semua komentar ${jurnalAktif?.nama} masih memakai kalimat bawaan.` : saring === "mati" && !cari ? `Belum ada komentar yang dimatikan untuk ${jurnalAktif?.nama}.` : `Tidak ada kalimat yang memuat “${cari}”.`}
                aksi={<Tombol onClick={() => { setCari(""); setSaring("semua"); }}>Tampilkan semua kalimat</Tombol>}
              />
            ) : (
              perGrup.filter((g) => g.tampil.length).map((g) => (
                <Kartu key={g.grup} as="section" className="scroll-mt-6 overflow-hidden">
                  <div id={idGrup(g.grup)} className="scroll-mt-6">
                    <KepalaKartu judul={g.grup} sub={`${g.tampil.length} kalimat${g.tampil.length < g.semua.length ? ` dari ${g.semua.length}` : ""}`} />
                  </div>
                  <div className="divide-y divide-line">
                    {g.tampil.map((e) => (
                      <BarisKomentar
                        key={e.kode}
                        e={e}
                        nilai={draf[e.kode] ?? e.bawaan}
                        asli={asli(e)}
                        maks={katalog.maks_panjang}
                        ubah={(v) => setDraf((d) => ({ ...d, [e.kode]: v }))}
                        aktif={!matiDraf.has(e.kode)}
                        aktifAsli={!matiTersimpan.has(e.kode)}
                        setAktif={(v) => setAktif(e.kode, v)}
                      />
                    ))}
                  </div>
                </Kartu>
              ))
            )}

            <div className="sticky bottom-4 z-10">
              <div className="melayang flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span role="status" className={`flex items-center gap-2 text-sm ${berubah.length ? "font-semibold text-ink" : "text-ink-2"}`}>
                  <span className={`h-2 w-2 rounded-full ${bergalat.length ? "bg-bahaya" : berubah.length ? "bg-waspada" : "bg-ok"}`} aria-hidden />
                  {bergalat.length
                    ? `${bergalat.length} kalimat perlu diperbaiki sebelum disimpan`
                    : berubah.length
                      ? `${berubah.length} kalimat belum disimpan`
                      : "Semua perubahan tersimpan"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {berubah.length > 0 && <Tombol onClick={batal} disabled={menyimpan}>Batalkan perubahan</Tombol>}
                  <Tombol varian="utama" ikon={Save} onClick={simpan} memuat={menyimpan} disabled={!berubah.length || bergalat.length > 0}>
                    Simpan kalimat
                  </Tombol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
