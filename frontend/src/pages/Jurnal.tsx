import { Check, Download, FileJson, FileText, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, relatif, type HasilEkstrak, type JurnalRingkas, type Profil, type Status } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import EditorProfil, { PetaTemplate } from "../components/EditorProfil";
import Membaca, { minimal } from "../components/Membaca";
import {
  IkonBerkas, JudulHalaman, Kartu, KepalaKartu, Kosong, Lencana, MemuatHalaman, Pesan, Sakelar, TautanTombol, Tombol, ZonaUnggah,
} from "../components/ui";

const KEMBALI = { ke: "/jurnal", label: "Profil jurnal" };

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

  async function hapus(j: JurnalRingkas) {
    if (!confirm(`Hapus profil "${j.nama}"?`)) return;
    try {
      await api.hapusJurnal(j.id);
      toast("sukses", "Profil dihapus", j.nama);
      muat();
    } catch (err) {
      toast("galat", "Gagal menghapus", (err as Error).message);
    }
  }

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
        <Kartu className="py-12">
          <Membaca judul="Memuat daftar jurnal…" />
        </Kartu>
      ) : data.length === 0 ? (
        <Kosong
          ikon={FileText}
          judul="Belum ada jurnal"
          sub={admin ? "Unggah template .docx jurnal Anda. Sistem membaca tata letak, format, struktur, dan ketentuan tertulisnya." : "Admin belum menambahkan profil jurnal."}
          aksi={admin && <TautanTombol ke="/jurnal/baru" varian="utama" ikon={Plus}>Tambah dari template</TautanTombol>}
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.map((j) => (
            <li key={j.id}>
              <Kartu className="flex h-full flex-col">
                <div className="flex items-start gap-3.5 p-5">
                  <IkonBerkas ukuran={40} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/jurnal/${j.id}`} className="block text-[15px] leading-snug font-semibold break-words text-ink hover:text-brand-tinta hover:underline">
                      {j.nama}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-ink-2">{j.deskripsi || j.template_nama || "tanpa keterangan"}</p>
                    <p className="mt-0.5 text-xs text-ink-3">Diperbarui {relatif(j.diubah)}</p>
                    {(j.punya_scope || j.jumlah_naratif > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {j.punya_scope && <Lencana jenis="info">Focus &amp; Scope</Lencana>}
                        {j.jumlah_naratif > 0 && <Lencana jenis="ai">{j.jumlah_naratif} aturan isi</Lencana>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <div className="mb-2 text-xs font-medium text-ink-2">Struktur, {j.bagian.length} bagian</div>
                  {j.bagian.length > 0 ? (
                    <ol className="flex flex-wrap gap-1.5">
                      {j.bagian.map((b, i) => (
                        <li key={b} className="rounded-md border border-line bg-panel-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
                          <span className="text-ink-3">{i + 1}.</span> {b}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-ink-3">Belum ada bagian wajib.</p>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-line px-3 py-2.5">
                  <TautanTombol ke={`/jurnal/${j.id}`} ukuran="kecil" varian="biasa">{admin ? "Sunting aturan" : "Lihat aturan"}</TautanTombol>
                  <TautanTombol ukuran="kecil" varian="hantu" ikon={Download} href={`/api/jurnal/${j.id}/ekspor`}>Ekspor</TautanTombol>
                  {j.punya_template && <TautanTombol ukuran="kecil" varian="hantu" ikon={FileText} href={`/api/jurnal/${j.id}/template`}>Template</TautanTombol>}
                  {admin && (
                    <Tombol ukuran="kecil" varian="hantu" ikon={Trash2} className="ml-auto hover:!bg-bahaya-soft hover:!text-bahaya" aria-label={`Hapus profil ${j.nama}`} title="Hapus profil" onClick={() => hapus(j)} />
                  )}
                </div>
              </Kartu>
            </li>
          ))}
          {admin && (
            <li>
              <Link to="/jurnal/baru" className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-2 p-6 text-center transition-colors hover:border-brand/60 hover:bg-brand-soft/50">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-tinta"><Plus className="h-5 w-5" aria-hidden /></span>
                <span className="text-sm font-semibold text-ink">Tambah jurnal</span>
                <span className="mt-1 text-xs text-ink-2">Unggah template .docx-nya</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </>
  );
}

/* ---------------------------------------------------------- baca template */

function OpsiBaca({ status, onBaca, memuat, labelTombol, adaBerkas = true }: {
  status: Status | null; onBaca: (pakaiAI: boolean, panduan: string) => void; memuat: boolean; labelTombol: string; adaBerkas?: boolean;
}) {
  const [pakaiAI, setPakaiAI] = useState(false);
  const [panduan, setPanduan] = useState("");
  const idPanduan = useId();
  if (memuat)
    return (
      <Membaca
        mendatar
        ukuran="kecil"
        judul={pakaiAI ? "Membaca template (bot + AI)…" : "Membaca template…"}
        langkah={["Membaca tata letak halaman", "Mengenali judul, abstrak, dan heading", "Mencatat format tiap elemen",
          "Mengambil aturan dari kalimat petunjuk", ...(pakaiAI ? ["AI meninjau dan melengkapi aturan"] : [])]}
      />
    );
  return (
    <div className="space-y-4">
      <Sakelar
        nyala={pakaiAI && !!status?.ai_aktif}
        ubah={setPakaiAI}
        nonaktif={!status?.ai_aktif}
        label="Minta AI membaca petunjuk"
        keterangan={
          status?.ai_aktif
            ? `Lebih lengkap untuk aturan berbentuk kalimat dan aturan naratif (${status.ai_model}). Template adalah dokumen publik.`
            : <>AI belum diatur. Isi di <Link to="/pengaturan" className="font-semibold text-brand-tinta underline">Pengaturan</Link>. Bot tetap membaca format &amp; aturan umum.</>
        }
      />
      {pakaiAI && status?.ai_aktif && (
        <div>
          <label className="label" htmlFor={idPanduan}>Panduan penulis tambahan (opsional)</label>
          <textarea id={idPanduan} className="input" rows={4} value={panduan} onChange={(e) => setPanduan(e.target.value)}
            placeholder="Tempel teks Author Guidelines dari situs jurnal bila ada ketentuan yang tidak tertulis di template." />
        </div>
      )}
      <Tombol varian="utama" className="w-full sm:w-auto" onClick={() => onBaca(pakaiAI && !!status?.ai_aktif, panduan)} memuat={memuat} disabled={!adaBerkas}>
        {memuat ? (pakaiAI ? "Membaca (bot + AI)…" : "Membaca template…") : labelTombol}
      </Tombol>
    </div>
  );
}

function InfoAI({ h }: { h: HasilEkstrak | null }) {
  if (!h) return null;
  if (h.ai.galat) return <Pesan jenis="peringatan" judul="AI gagal membaca template. Yang tampil adalah hasil bot.">{h.ai.galat}</Pesan>;
  if (h.ai.dipakai) return <Pesan jenis="sukses" judul={`AI selesai meninjau: ${h.ai.perubahan.length} nilai diperbaiki atau dilengkapi.`} />;
  return null;
}

/** Kartu template di atas editor: nama berkas + tombol untuk membuka opsi baca ulang. */
function KartuTemplate({ nama, href, status, onBaca, memuat, gantiBerkas }: {
  nama: string; href?: string; status: Status | null; onBaca: (pakaiAI: boolean, panduan: string) => void; memuat: boolean; gantiBerkas?: () => void;
}) {
  const [buka, setBuka] = useState(false);
  return (
    <Kartu>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <IkonBerkas ukuran={32} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-ink-2">Template jurnal</div>
          {href ? (
            <a href={href} className="block truncate text-sm font-semibold text-brand-tinta hover:underline">{nama}</a>
          ) : (
            <div className="truncate text-sm font-semibold">{nama}</div>
          )}
        </div>
        {gantiBerkas && <Tombol ukuran="kecil" varian="hantu" onClick={gantiBerkas}>Ganti berkas</Tombol>}
        <Tombol ukuran="kecil" ikon={RefreshCw} aria-expanded={buka} onClick={() => setBuka(!buka)}>Baca ulang template</Tombol>
      </div>
      {buka && (
        <div className="border-t border-line bg-panel-2 px-5 py-4">
          <OpsiBaca status={status} onBaca={onBaca} memuat={memuat} labelTombol="Baca ulang sekarang" />
        </div>
      )}
    </Kartu>
  );
}

/** Bilah simpan yang menempel di bawah layar selama menyunting. */
function BilahSimpan({ berubah, onSimpan, memuat, nonaktif, label }: { berubah: boolean; onSimpan: () => void; memuat: boolean; nonaktif?: boolean; label: string }) {
  return (
    <div className="sticky bottom-4 z-10">
      <div className="melayang flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className={`flex items-center gap-2 text-sm ${berubah ? "font-semibold text-ink" : "text-ink-2"}`}>
          <span className={`h-2 w-2 rounded-full ${berubah ? "bg-waspada" : "bg-ok"}`} aria-hidden />
          {berubah ? "Ada perubahan yang belum disimpan" : "Semua perubahan tersimpan"}
        </span>
        <Tombol varian="utama" ikon={Save} onClick={onSimpan} memuat={memuat} disabled={nonaktif}>{label}</Tombol>
      </div>
    </div>
  );
}

function Stepper({ aktif }: { aktif: number }) {
  const langkah = ["Unggah template", "Tinjau aturan", "Simpan profil"];
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Langkah">
      {langkah.map((l, i) => (
        <li key={l} className="flex items-center gap-2" aria-current={i === aktif ? "step" : undefined}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            i < aktif ? "bg-ok-soft text-ok" : i === aktif ? "bg-brand text-white" : "border border-line-2 bg-panel text-ink-2"}`}>
            {i < aktif ? <Check className="h-3.5 w-3.5" aria-label="selesai" /> : i + 1}
          </span>
          <span className={`text-sm font-medium whitespace-nowrap ${i === aktif ? "text-ink" : "text-ink-2"}`}>{l}</span>
          {i < langkah.length - 1 && <span className="ml-1 hidden h-px w-10 bg-line-2 sm:block" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

const YANG_DIBACA: [string, string][] = [
  ["Tata letak", "ukuran kertas, orientasi, margin, jumlah kolom"],
  ["Format per elemen", "font, ukuran, tebal/miring, perataan, spasi untuk judul, abstrak, heading, isi, tabel, gambar, pustaka"],
  ["Struktur", "bagian wajib, urutannya, dan penomoran heading"],
  ["Judul, abstrak, kata kunci", "jumlah kata, versi bahasa Inggris, pemisah kata kunci, singkatan di judul, sitasi di abstrak"],
  ["Penulis", "email dan ORCID penulis"],
  ["Tabel & gambar", "judul, penomoran, pola garis tabel, lebar dan perataan tabel, sumber, In Line with Text, resolusi gambar"],
  ["Referensi", "jumlah minimal, persen mutakhir, urutan, gaya sitasi, Mendeley/Zotero, DOI, persen sumber primer, sumber terlarang"],
  ["Kebersihan naskah", "bahasa, catatan kaki, teks hitam; track changes, sorotan, spasi ganda selalu dicek"],
];

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
      const h = await minimal(api.ekstrak(berkas, pakaiAI, panduan));
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

  const gantiBerkas = () => { setBerkas(null); setHasil(null); };

  return (
    <>
      <JudulHalaman
        kembali={KEMBALI}
        judul="Tambah jurnal dari template"
        sub="Tata letak dan format dibaca dari pengaturan Word di template. Ketentuan tertulis dibaca dari teks petunjuknya."
      />
      <Stepper aktif={hasil ? 1 : 0} />
      {hasil && berkas ? (
        <EditorProfil
          nama={nama} setNama={setNama} deskripsi={deskripsi} setDeskripsi={setDeskripsi} profil={profil} setProfil={setProfil}
          atas={
            <>
              <KartuTemplate nama={berkas.name} status={status} onBaca={baca} memuat={memuat} gantiBerkas={gantiBerkas} />
              <InfoAI h={hasil} />
              <PetaTemplate peta={hasil.peta} />
            </>
          }
          bawah={<BilahSimpan berubah onSimpan={simpan} memuat={menyimpan} nonaktif={!nama.trim()} label="Simpan profil" />}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Kartu>
            <KepalaKartu judul="Template jurnal" sub="Gunakan template resmi dari situs jurnal (.docx atau .dotx)." />
            <div className="space-y-5 p-5">
              {berkas ? (
                <div className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-3">
                  <IkonBerkas ukuran={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{berkas.name}</span>
                  <Tombol ukuran="kecil" varian="hantu" onClick={gantiBerkas}>Ganti</Tombol>
                </div>
              ) : (
                <ZonaUnggah terima=".docx,.dotx" label="Seret template .docx ke sini" sub="atau klik untuk memilih berkas" pilih={(f) => setBerkas(f[0])} />
              )}
              <OpsiBaca status={status} onBaca={baca} memuat={memuat} labelTombol="Baca template" adaBerkas={!!berkas} />
            </div>
          </Kartu>
          <Kartu>
            <KepalaKartu judul="Yang dibaca dari template" sub="Semuanya menjadi aturan yang bisa Anda tinjau dan sunting sebelum disimpan." />
            <dl className="divide-y divide-line">
              {YANG_DIBACA.map(([k, v]) => (
                <div key={k} className="px-5 py-3">
                  <dt className="text-sm font-semibold text-ink">{k}</dt>
                  <dd className="mt-0.5 text-[13px] text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </Kartu>
        </div>
      )}
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
  const [tersimpan, setTersimpan] = useState("");
  const [hasil, setHasil] = useState<HasilEkstrak | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  const jejak = useMemo(() => JSON.stringify({ nama, deskripsi, profil }), [nama, deskripsi, profil]);

  useEffect(() => {
    if (admin) api.status().then(setStatus).catch(() => undefined);
    api.jurnal(jid).then((d) => {
      setData(d);
      setProfil(d.profil);
      setNama(d.nama);
      setDeskripsi(d.deskripsi);
      setTersimpan(JSON.stringify({ nama: d.nama, deskripsi: d.deskripsi, profil: d.profil }));
    }).catch((e) => setGalat(e.message));
  }, [jid, admin]);

  async function simpan() {
    setMenyimpan(true);
    try {
      await api.ubahJurnal(jid, { nama, deskripsi, profil });
      setTersimpan(jejak);
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
      const h = await minimal(api.ekstrakUlang(jid, pakaiAI, panduan));
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
        <JudulHalaman judul="Profil jurnal" kembali={KEMBALI} />
        <Pesan jenis="galat" judul="Profil jurnal tidak bisa dimuat">{galat}</Pesan>
      </>
    );
  if (!data) return <MemuatHalaman teks="Memuat profil jurnal…" />;

  let atas: ReactNode = null;
  if (admin)
    atas = (
      <>
        {data.punya_template ? (
          <KartuTemplate nama={data.template_nama || "template tersimpan"} href={`/api/jurnal/${jid}/template`} status={status} onBaca={bacaUlang} memuat={memuat} />
        ) : (
          <Pesan jenis="info">Profil ini tidak menyimpan berkas template (mis. hasil impor), jadi tidak bisa dibaca ulang.</Pesan>
        )}
        <InfoAI h={hasil} />
        {hasil && <PetaTemplate peta={hasil.peta} />}
      </>
    );

  return (
    <>
      <JudulHalaman
        kembali={KEMBALI}
        judul={data.nama}
        sub={admin ? "Sunting aturan lalu simpan. Perubahan berlaku untuk pengecekan berikutnya." : "Aturan yang dipakai untuk memeriksa naskah di jurnal ini."}
        aksi={<TautanTombol href={`/api/jurnal/${jid}/ekspor`} ikon={Download}>Ekspor .json</TautanTombol>}
      />
      <EditorProfil
        nama={nama} setNama={setNama} deskripsi={deskripsi} setDeskripsi={setDeskripsi} profil={profil} setProfil={setProfil} hanyaBaca={!admin}
        atas={atas}
        bawah={admin && <BilahSimpan berubah={jejak !== tersimpan} onSimpan={simpan} memuat={menyimpan} label="Simpan perubahan" />}
      />
    </>
  );
}
