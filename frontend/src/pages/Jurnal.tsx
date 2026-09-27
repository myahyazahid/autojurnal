import { ArrowLeft, Check, Download, FileJson, FileText, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, relatif, type HasilEkstrak, type JurnalRingkas, type Profil, type Status } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import EditorProfil, { PetaTemplate } from "../components/EditorProfil";
import { JudulHalaman, Kartu, Kerangka, Kosong, Lencana, MemuatHalaman, Pesan, Putar, Sakelar, TautanTombol, Tombol, ZonaUnggah } from "../components/ui";

const bayanganMengambang = "shadow-[0_8px_24px_-8px_rgba(34,27,28,0.45)]";

function KembaliKeDaftar() {
  return (
    <Link to="/jurnal" className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Profil jurnal
    </Link>
  );
}

/* ------------------------------------------------------------------ daftar */

export function DaftarJurnal() {
  const { pengguna } = useAuth();
  const toast = useToast();
  const admin = pengguna?.peran === "admin";
  const [data, setData] = useState<JurnalRingkas[] | null>(null);
  const [galat, setGalat] = useState("");
  const impor = useRef<HTMLInputElement>(null);
  const muat = () => {
    setGalat("");
    api.daftarJurnal().then(setData).catch((e) => setGalat(e.message));
  };
  useEffect(() => {
    muat();
  }, []);

  return (
    <>
      <JudulHalaman
        judul="Profil jurnal"
        sub={admin ? "Setiap jurnal punya profil aturan yang dibaca dari template-nya. Anda bisa menambah dan menyunting." : "Aturan setiap jurnal, dibaca dari template-nya."}
        aksi={admin && (
          <>
            <Tombol ikon={FileJson} onClick={() => impor.current?.click()}>Impor .json</Tombol>
            <TautanTombol ke="/jurnal/baru" varian="utama" ikon={Plus}>Tambah dari template</TautanTombol>
          </>
        )}
      />
      <input ref={impor} type="file" accept=".json" className="hidden" tabIndex={-1} onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        try {
          const j = await api.imporJurnal(f);
          toast("sukses", "Profil diimpor", j.nama);
          muat();
        } catch (err) {
          toast("galat", "Impor gagal", (err as Error).message);
        }
      }} />
      {galat ? (
        <Pesan jenis="galat" judul="Daftar jurnal tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muat}>Coba lagi</Tombol>}>{galat}</Pesan>
      ) : data === null ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" role="status" aria-label="Memuat daftar jurnal">
          {[0, 1, 2].map((i) => <Kerangka key={i} className="h-52" />)}
        </div>
      ) : data.length === 0 ? (
        <Kosong
          judul="Belum ada jurnal"
          sub={admin ? "Unggah template .docx jurnal Anda. Sistem membaca tata letak, format, struktur, dan ketentuan tertulisnya." : "Admin belum menambahkan profil jurnal."}
          aksi={admin && <TautanTombol ke="/jurnal/baru" varian="utama" ikon={Plus}>Tambah dari template</TautanTombol>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((j) => (
            <li key={j.id}>
              <Kartu className="flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/jurnal/${j.id}`} className="block font-serif text-lg leading-snug font-semibold break-words text-ink underline-offset-2 hover:text-brand-tinta hover:underline">
                      {j.nama}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-ink-2">{j.deskripsi || j.template_nama || "tanpa keterangan"}</div>
                  </div>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {j.punya_scope && <Lencana jenis="info">Scope</Lencana>}
                    {j.jumlah_naratif > 0 && <Lencana jenis="ai">{j.jumlah_naratif} aturan isi</Lencana>}
                  </span>
                </div>
                {j.bagian.length > 0 && (
                  <ol className="mt-4 flex flex-wrap gap-1.5">
                    {j.bagian.map((b, i) => (
                      <li key={b} className="rounded-md bg-panel-3 px-2 py-1 text-[11px] font-medium text-ink-2">
                        <span className="text-ink-3">{i + 1}.</span> {b}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
                  <TautanTombol ke={`/jurnal/${j.id}`} ukuran="kecil" varian={admin ? "biasa" : "lembut"}>{admin ? "Sunting aturan" : "Lihat aturan"}</TautanTombol>
                  <TautanTombol ukuran="kecil" varian="hantu" ikon={Download} href={`/api/jurnal/${j.id}/ekspor`}>Ekspor</TautanTombol>
                  {j.punya_template && <TautanTombol ukuran="kecil" varian="hantu" ikon={FileText} href={`/api/jurnal/${j.id}/template`}>Template</TautanTombol>}
                  {admin && (
                    <Tombol ukuran="kecil" varian="hantu" ikon={Trash2} className="ml-auto hover:!text-brand-tinta" aria-label={`Hapus profil ${j.nama}`} title="Hapus profil" onClick={async () => {
                      if (!confirm(`Hapus profil "${j.nama}"?`)) return;
                      try {
                        await api.hapusJurnal(j.id);
                        toast("sukses", "Profil dihapus", j.nama);
                        muat();
                      } catch (err) {
                        toast("galat", "Gagal menghapus", (err as Error).message);
                      }
                    }} />
                  )}
                </div>
                <div className="mt-3 text-xs text-ink-2">diperbarui {relatif(j.diubah)}</div>
              </Kartu>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------------------------------------------------------- baca template */

function PanelBaca({ status, onBaca, memuat, labelTombol, adaBerkas = true, children }: {
  status: Status | null; onBaca: (pakaiAI: boolean, panduan: string) => void; memuat: boolean; labelTombol: string; adaBerkas?: boolean; children?: ReactNode;
}) {
  const [pakaiAI, setPakaiAI] = useState(false);
  const [panduan, setPanduan] = useState("");
  const idPanduan = useId();
  return (
    <Kartu className="space-y-4 p-5">
      {children}
      <div className="rounded-lg border border-line bg-panel-2 p-3.5">
        <Sakelar
          nyala={pakaiAI && !!status?.ai_aktif}
          ubah={setPakaiAI}
          nonaktif={!status?.ai_aktif}
          label="Minta AI membaca petunjuk"
          keterangan={
            status?.ai_aktif
              ? `Lebih lengkap untuk aturan berbentuk kalimat dan untuk menyusun aturan naratif (${status.ai_model}). Template adalah dokumen publik.`
              : <>AI belum diatur. Isi di <Link to="/pengaturan" className="font-semibold text-brand-tinta underline">Pengaturan</Link>. Bot tetap membaca format &amp; aturan umum.</>
          }
        />
      </div>
      {pakaiAI && status?.ai_aktif && (
        <div>
          <label className="label" htmlFor={idPanduan}>Panduan penulis tambahan (opsional)</label>
          <textarea id={idPanduan} className="input" rows={4} value={panduan} onChange={(e) => setPanduan(e.target.value)}
            placeholder="Tempel teks Author Guidelines dari situs jurnal bila ada ketentuan yang tidak tertulis di template." />
        </div>
      )}
      <Tombol varian="utama" className="w-full" onClick={() => onBaca(pakaiAI && !!status?.ai_aktif, panduan)} memuat={memuat} disabled={!adaBerkas}>
        {memuat ? (pakaiAI ? "Membaca (bot + AI)…" : "Membaca template…") : labelTombol}
      </Tombol>
    </Kartu>
  );
}

function InfoAI({ h }: { h: HasilEkstrak | null }) {
  if (!h) return null;
  if (h.ai.galat) return <Pesan jenis="peringatan" judul="AI gagal membaca template. Yang tampil adalah hasil bot.">{h.ai.galat}</Pesan>;
  if (h.ai.dipakai) return <Pesan jenis="sukses" judul={`AI selesai meninjau: ${h.ai.perubahan.length} nilai diperbaiki atau dilengkapi.`} />;
  return null;
}

function Stepper({ aktif }: { aktif: number }) {
  const langkah = ["Unggah template", "Tinjau aturan", "Simpan profil"];
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Langkah">
      {langkah.map((l, i) => (
        <li key={l} className="flex items-center gap-2" aria-current={i === aktif ? "step" : undefined}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            i < aktif ? "bg-ok-soft text-ok" : i === aktif ? "bg-ink text-canvas" : "border border-isian text-ink-2"}`}>
            {i < aktif ? <Check className="h-3.5 w-3.5" aria-label="selesai" /> : i + 1}
          </span>
          <span className={`text-sm font-semibold whitespace-nowrap ${i === aktif ? "text-ink" : "text-ink-2"}`}>{l}</span>
          {i < langkah.length - 1 && <span className="mx-1 hidden h-px w-8 bg-line-2 sm:block" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function JurnalBaru() {
  const nav = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [hasil, setHasil] = useState<HasilEkstrak | null>(null);
  const [profil, setProfil] = useState<Profil>({});
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    api.status().then(setStatus).catch(() => undefined);
  }, []);

  async function baca(pakaiAI: boolean, panduan: string) {
    if (!berkas) return;
    setMemuat(true);
    try {
      const h = await api.ekstrak(berkas, pakaiAI, panduan);
      setHasil(h);
      setProfil(h.profil);
      if (!nama) setNama(berkas.name.replace(/\.docx$/i, "").replace(/template/i, "").replace(/[_-]+/g, " ").trim() || "Jurnal baru");
      toast("sukses", "Template terbaca", `${h.profil.struktur?.bagian?.length ?? 0} bagian, ${h.peta.length} paragraf dikenali`);
    } catch (e) {
      toast("galat", "Template tidak bisa dibaca", (e as Error).message);
    } finally {
      setMemuat(false);
    }
  }

  async function simpan() {
    setMenyimpan(true);
    try {
      await api.buatJurnal({ nama, deskripsi, profil, token_template: hasil?.token, template_nama: hasil?.template_nama });
      toast("sukses", "Profil jurnal tersimpan", nama);
      nav("/jurnal");
    } catch (e) {
      toast("galat", "Gagal menyimpan", (e as Error).message);
      setMenyimpan(false);
    }
  }

  return (
    <>
      <JudulHalaman
        kecil={<KembaliKeDaftar />}
        judul="Tambah jurnal dari template"
        sub="Tata letak dan format dibaca dari pengaturan Word di template. Ketentuan tertulis dibaca dari teks petunjuknya."
        aksi={hasil && <Tombol varian="utama" ikon={Save} onClick={simpan} memuat={menyimpan} disabled={!nama.trim()}>Simpan profil</Tombol>}
      />
      <Stepper aktif={hasil ? 1 : 0} />
      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <PanelBaca status={status} onBaca={baca} memuat={memuat} labelTombol={hasil ? "Baca ulang" : "Baca template"} adaBerkas={!!berkas}>
            {berkas ? (
              <div className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{berkas.name}</span>
                <button type="button" className="ketuk text-xs font-semibold text-brand-tinta underline-offset-2 hover:underline" onClick={() => { setBerkas(null); setHasil(null); }}>
                  Ganti berkas
                </button>
              </div>
            ) : (
              <ZonaUnggah terima=".docx,.dotx" ringkas label="Unggah template jurnal (.docx)" sub="Template resmi dari situs jurnal" pilih={(f) => setBerkas(f[0])} />
            )}
          </PanelBaca>
          {hasil && <PetaTemplate peta={hasil.peta} />}
        </div>
        <div className="min-w-0 space-y-4">
          <InfoAI h={hasil} />
          {hasil ? (
            <>
              <EditorProfil nama={nama} setNama={setNama} deskripsi={deskripsi} setDeskripsi={setDeskripsi} profil={profil} setProfil={setProfil} />
              <div className="sticky bottom-4 z-10 flex justify-end">
                <Tombol varian="utama" ukuran="besar" ikon={Save} className={bayanganMengambang} onClick={simpan} memuat={menyimpan} disabled={!nama.trim()}>Simpan profil</Tombol>
              </div>
            </>
          ) : memuat ? (
            <Kartu className="flex items-center gap-3 p-8 text-sm text-ink-2" ><Putar /> <span role="status">Membaca template…</span></Kartu>
          ) : (
            <Kosong judul="Aturan yang terbaca akan tampil di sini"
              sub="Margin, font, struktur bagian, jumlah kata abstrak, gaya sitasi, dan minimal referensi diubah menjadi aturan yang bisa Anda sunting." />
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- edit */

export function EditJurnal() {
  const { id } = useParams();
  const jid = Number(id);
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [data, setData] = useState<(JurnalRingkas & { profil: Profil }) | null>(null);
  const [profil, setProfil] = useState<Profil>({});
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [hasil, setHasil] = useState<HasilEkstrak | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    if (admin) api.status().then(setStatus).catch(() => undefined);
    api.jurnal(jid).then((d) => {
      setData(d);
      setProfil(d.profil);
      setNama(d.nama);
      setDeskripsi(d.deskripsi);
    }).catch((e) => setGalat(e.message));
  }, [jid, admin]);

  async function simpan() {
    setMenyimpan(true);
    try {
      await api.ubahJurnal(jid, { nama, deskripsi, profil });
      toast("sukses", "Profil tersimpan", nama);
    } catch (e) {
      toast("galat", "Gagal menyimpan", (e as Error).message);
    } finally {
      setMenyimpan(false);
    }
  }

  async function bacaUlang(pakaiAI: boolean, panduan: string) {
    if (!confirm("Isi editor akan diganti hasil pembacaan ulang template (belum tersimpan sampai Anda menekan Simpan). Lanjutkan?")) return;
    setMemuat(true);
    try {
      const h = await api.ekstrakUlang(jid, pakaiAI, panduan);
      setHasil(h);
      setProfil({ ...h.profil, scope: profil.scope }); // scope diisi manual, jangan ditimpa
      toast("info", "Template dibaca ulang", "Tinjau lalu tekan Simpan.");
    } catch (e) {
      toast("galat", "Gagal membaca ulang", (e as Error).message);
    } finally {
      setMemuat(false);
    }
  }

  if (galat)
    return (
      <>
        <div className="mb-5 text-sm font-semibold"><KembaliKeDaftar /></div>
        <Pesan jenis="galat" judul="Profil jurnal tidak bisa dimuat">{galat}</Pesan>
      </>
    );
  if (!data) return <MemuatHalaman teks="Memuat profil jurnal…" />;
  return (
    <>
      <JudulHalaman
        kecil={<KembaliKeDaftar />}
        judul={data.nama}
        sub={admin ? "Sunting aturan lalu simpan. Perubahan berlaku untuk pengecekan berikutnya." : "Aturan yang dipakai untuk memeriksa naskah di jurnal ini."}
        aksi={
          <>
            <TautanTombol href={`/api/jurnal/${jid}/ekspor`} ikon={Download}>Ekspor .json</TautanTombol>
            {admin && <Tombol varian="utama" ikon={Save} onClick={simpan} memuat={menyimpan}>Simpan</Tombol>}
          </>
        }
      />
      <div className={admin ? "grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]" : ""}>
        {admin && (
          <div className="space-y-4">
            {data.punya_template ? (
              <PanelBaca status={status} onBaca={bacaUlang} memuat={memuat} labelTombol="Baca ulang template">
                <div className="flex items-center gap-2 text-sm text-ink-2">
                  <RefreshCw className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
                  <a className="truncate font-semibold text-brand-tinta underline-offset-2 hover:underline" href={`/api/jurnal/${jid}/template`}>{data.template_nama || "template tersimpan"}</a>
                </div>
              </PanelBaca>
            ) : (
              <Pesan jenis="info">Profil ini tidak menyimpan berkas template (mis. hasil impor), jadi tidak bisa dibaca ulang.</Pesan>
            )}
            {hasil && <PetaTemplate peta={hasil.peta} />}
          </div>
        )}
        <div className="min-w-0 space-y-4">
          <InfoAI h={hasil} />
          <EditorProfil nama={nama} setNama={setNama} deskripsi={deskripsi} setDeskripsi={setDeskripsi} profil={profil} setProfil={setProfil} hanyaBaca={!admin} />
          {admin && (
            <div className="sticky bottom-4 z-10 flex justify-end">
              <Tombol varian="utama" ukuran="besar" ikon={Save} className={bayanganMengambang} onClick={simpan} memuat={menyimpan}>Simpan perubahan</Tombol>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
