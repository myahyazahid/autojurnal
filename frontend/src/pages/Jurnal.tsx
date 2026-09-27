import {
  ArrowLeft, BookOpen, Check, Download, Eye, FileJson, FileText, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, Upload, WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, relatif, type HasilEkstrak, type JurnalRingkas, type Profil, type Status } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import EditorProfil, { PetaTemplate } from "../components/EditorProfil";
import { JudulHalaman, Kartu, Kerangka, Kosong, Lencana, MemuatHalaman, Pesan, Putar, Sakelar, TautanTombol, Tombol, ZonaUnggah } from "../components/ui";

/* ------------------------------------------------------------------ daftar */

export function DaftarJurnal() {
  const { pengguna } = useAuth();
  const toast = useToast();
  const admin = pengguna?.peran === "admin";
  const [data, setData] = useState<JurnalRingkas[] | null>(null);
  const impor = useRef<HTMLInputElement>(null);
  const muat = () => api.daftarJurnal().then(setData).catch((e) => toast("galat", "Gagal memuat", e.message));
  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <JudulHalaman
        ikon={BookOpen}
        judul="Profil Jurnal"
        sub="Setiap jurnal punya profil aturan yang dibaca dari template-nya. Admin bisa menambah & menyunting."
        aksi={admin && (
          <>
            <Tombol ikon={FileJson} onClick={() => impor.current?.click()}>Impor .json</Tombol>
            <Link to="/jurnal/baru"><Tombol varian="utama" ikon={Plus}>Tambah dari template</Tombol></Link>
          </>
        )}
      />
      <input ref={impor} type="file" accept=".json" className="hidden" onChange={async (e) => {
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
      {data === null ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2].map((i) => <Kerangka key={i} className="h-52" />)}</div>
      ) : data.length === 0 ? (
        <Kosong
          ikon={BookOpen}
          judul="Belum ada jurnal"
          sub={admin ? "Unggah template .docx jurnal Anda. Sistem membaca tata letak, format, struktur, dan ketentuan tertulisnya." : "Admin belum menambahkan profil jurnal."}
          aksi={admin && <Link to="/jurnal/baru"><Tombol varian="utama" ikon={Plus}>Tambah dari template</Tombol></Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((j) => (
            <Kartu key={j.id} className="group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-xl">
              <div className="bg-merek h-1.5" />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><FileText className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/jurnal/${j.id}`} className="block truncate text-base font-bold text-ink hover:text-brand">{j.nama}</Link>
                    <div className="truncate text-xs text-ink-3">{j.deskripsi || j.template_nama || "tanpa keterangan"}</div>
                  </div>
                  {j.jumlah_naratif > 0 && <Lencana jenis="ai" ikon={Sparkles}>{j.jumlah_naratif}</Lencana>}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {j.bagian.map((b, i) => (
                    <span key={b} className="inline-flex items-center gap-1 rounded-lg bg-panel-3 px-2 py-1 text-[11px] font-semibold text-ink-2">
                      <span className="text-ink-3">{i + 1}</span> {b}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
                  <Link to={`/jurnal/${j.id}`}>
                    <Tombol ukuran="kecil" varian={admin ? "utama" : "lembut"} ikon={admin ? Pencil : Eye}>{admin ? "Sunting" : "Lihat aturan"}</Tombol>
                  </Link>
                  <TautanTombol ukuran="kecil" varian="hantu" ikon={Download} href={`/api/jurnal/${j.id}/ekspor`}>Ekspor</TautanTombol>
                  {j.punya_template && <TautanTombol ukuran="kecil" varian="hantu" ikon={FileText} href={`/api/jurnal/${j.id}/template`}>Template</TautanTombol>}
                  {admin && (
                    <Tombol ukuran="kecil" varian="hantu" ikon={Trash2} className="ml-auto hover:!text-rose-500" onClick={async () => {
                      if (!confirm(`Hapus profil “${j.nama}”?`)) return;
                      await api.hapusJurnal(j.id);
                      toast("sukses", "Profil dihapus", j.nama);
                      muat();
                    }} aria-label="Hapus" />
                  )}
                </div>
                <div className="mt-3 text-[11px] text-ink-3">diperbarui {relatif(j.diubah)}</div>
              </div>
            </Kartu>
          ))}
        </div>
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
  return (
    <Kartu className="space-y-4 p-5">
      {children}
      <div className="rounded-xl border border-line bg-panel-2 p-3.5">
        <Sakelar
          nyala={pakaiAI && !!status?.ai_aktif}
          ubah={setPakaiAI}
          nonaktif={!status?.ai_aktif}
          label={<span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-violet-500" /> Minta AI membaca petunjuk</span>}
          keterangan={
            status?.ai_aktif
              ? `Lebih lengkap untuk aturan berbentuk kalimat & menyusun aturan naratif (${status.ai_model}). Template adalah dokumen publik.`
              : <>AI belum diatur — isi di <Link to="/pengaturan" className="font-semibold text-brand underline">Pengaturan</Link>. Bot tetap membaca format & aturan umum.</>
          }
        />
      </div>
      {pakaiAI && status?.ai_aktif && (
        <div>
          <label className="label">Panduan penulis tambahan (opsional)</label>
          <textarea className="input" rows={4} value={panduan} onChange={(e) => setPanduan(e.target.value)}
            placeholder="Tempel teks Author Guidelines dari situs jurnal bila ada ketentuan yang tidak tertulis di template." />
        </div>
      )}
      <Tombol varian="utama" className="w-full" ikon={WandSparkles} onClick={() => onBaca(pakaiAI && !!status?.ai_aktif, panduan)} memuat={memuat} disabled={!adaBerkas}>
        {memuat ? (pakaiAI ? "Membaca (bot + AI)…" : "Membaca template…") : labelTombol}
      </Tombol>
    </Kartu>
  );
}

function InfoAI({ h }: { h: HasilEkstrak | null }) {
  if (!h) return null;
  if (h.ai.galat) return <Pesan jenis="peringatan" judul="AI gagal membaca template — yang tampil adalah hasil bot">{h.ai.galat}</Pesan>;
  if (h.ai.dipakai) return <Pesan jenis="sukses" judul={`AI selesai meninjau: ${h.ai.perubahan.length} nilai diperbaiki/dilengkapi.`} />;
  return null;
}

function Stepper({ aktif }: { aktif: number }) {
  const langkah = ["Unggah template", "Tinjau aturan", "Simpan profil"];
  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto">
      {langkah.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
            i < aktif ? "bg-emerald-500 text-white" : i === aktif ? "bg-merek text-white shadow-md shadow-indigo-500/30" : "bg-panel-3 text-ink-3"}`}>
            {i < aktif ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={`text-sm font-semibold whitespace-nowrap ${i === aktif ? "text-ink" : "text-ink-3"}`}>{l}</span>
          {i < langkah.length - 1 && <span className={`mx-1 h-px w-10 ${i < aktif ? "bg-emerald-500" : "bg-line-2"}`} />}
        </div>
      ))}
    </div>
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
        ikon={Upload}
        kecil={<Link to="/jurnal" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-3 w-3" /> Profil jurnal</Link>}
        judul="Tambah Jurnal dari Template"
        sub="Sistem membaca tata letak & format dari pengaturan Word di template, dan ketentuan tertulis dari teks petunjuknya."
        aksi={hasil && <Tombol varian="utama" ikon={Save} onClick={simpan} memuat={menyimpan} disabled={!nama.trim()}>Simpan profil</Tombol>}
      />
      <Stepper aktif={hasil ? 1 : 0} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <PanelBaca status={status} onBaca={baca} memuat={memuat} labelTombol={hasil ? "Baca ulang" : "Baca template"} adaBerkas={!!berkas}>
            {berkas ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3.5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"><FileText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{berkas.name}</span>
                <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => { setBerkas(null); setHasil(null); }}>ganti</button>
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
                <Tombol varian="utama" ukuran="besar" ikon={Save} onClick={simpan} memuat={menyimpan} disabled={!nama.trim()}>Simpan profil</Tombol>
              </div>
            </>
          ) : memuat ? (
            <Kartu className="flex items-center gap-3 p-8 text-sm text-ink-2"><Putar /> Membaca template…</Kartu>
          ) : (
            <Kosong ikon={WandSparkles} judul="Aturan yang terbaca akan tampil di sini"
              sub="Margin, font, struktur bagian, jumlah kata abstrak, gaya sitasi, minimal referensi — semua diubah menjadi aturan yang bisa Anda sunting." />
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
      setProfil(h.profil);
      toast("info", "Template dibaca ulang", "Tinjau lalu tekan Simpan.");
    } catch (e) {
      toast("galat", "Gagal membaca ulang", (e as Error).message);
    } finally {
      setMemuat(false);
    }
  }

  if (galat) return <Pesan jenis="galat">{galat}</Pesan>;
  if (!data) return <MemuatHalaman />;
  return (
    <>
      <JudulHalaman
        ikon={admin ? Pencil : Eye}
        kecil={<Link to="/jurnal" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-3 w-3" /> Profil jurnal</Link>}
        judul={data.nama}
        sub={admin ? "Sunting aturan lalu simpan. Perubahan berlaku untuk pengecekan berikutnya." : "Aturan yang dipakai untuk memeriksa naskah di jurnal ini."}
        aksi={
          <>
            <TautanTombol href={`/api/jurnal/${jid}/ekspor`} ikon={Download}>Ekspor .json</TautanTombol>
            {admin && <Tombol varian="utama" ikon={Save} onClick={simpan} memuat={menyimpan}>Simpan</Tombol>}
          </>
        }
      />
      <div className={admin ? "grid gap-6 xl:grid-cols-[340px_1fr]" : ""}>
        {admin && (
          <div className="space-y-4">
            {data.punya_template ? (
              <PanelBaca status={status} onBaca={bacaUlang} memuat={memuat} labelTombol="Baca ulang template">
                <div className="flex items-center gap-2 text-sm text-ink-2">
                  <RefreshCw className="h-4 w-4 text-brand" />
                  <a className="truncate font-semibold text-brand hover:underline" href={`/api/jurnal/${jid}/template`}>{data.template_nama || "template tersimpan"}</a>
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
              <Tombol varian="utama" ukuran="besar" ikon={Save} onClick={simpan} memuat={menyimpan}>Simpan perubahan</Tombol>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
