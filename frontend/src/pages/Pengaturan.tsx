import { CircleCheck, CircleX, Copy, Plug, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { api, type KonfigurasiAuth, type Pengaturan as P } from "../lib/api";
import { useToast } from "../lib/toast";
import PemilihModel from "../components/PemilihModel";
import { BagianPengaturan, JudulHalaman, LogoGoogle, MemuatHalaman, Pesan, Tombol } from "../components/ui";

const kode = "rounded bg-panel-3 px-1 py-0.5 text-[0.92em]";

export default function Pengaturan() {
  const toast = useToast();
  const id = useId();
  const [p, setP] = useState<P | null>(null);
  const [galat, setGalat] = useState("");
  const [konf, setKonf] = useState<KonfigurasiAuth | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [retensi, setRetensi] = useState(24);
  const [daftarModel, setDaftarModel] = useState<string[]>([]);
  const [galatModel, setGalatModel] = useState("");
  const [hasilTes, setHasilTes] = useState<{ ok: boolean; pesan: string } | null>(null);
  const [sibuk, setSibuk] = useState<"" | "simpan" | "tes" | "model" | "retensi">("");

  const muat = () => {
    setGalat("");
    api.pengaturan().then((d) => {
      setP(d);
      setBaseUrl(d.ai_base_url);
      setModel(d.ai_model);
      setRetensi(d.retensi_jam);
      if (d.ai_base_url) ambilModel({ ai_base_url: d.ai_base_url }); // langsung tampilkan daftar model
    }).catch((e) => setGalat(e.message));
  };
  useEffect(() => {
    muat();
    api.konfigurasi().then(setKonf).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uji = { ai_base_url: baseUrl, ai_model: model, ai_api_key: key || undefined };

  async function simpan(bagian: "simpan" | "retensi") {
    setSibuk(bagian);
    try {
      const d = await api.simpanPengaturan({ ai_base_url: baseUrl, ai_model: model, ai_api_key: key || undefined, retensi_jam: retensi });
      setP(d);
      setKey("");
      toast("sukses", "Pengaturan tersimpan");
    } catch (e) {
      toast("galat", "Gagal menyimpan", (e as Error).message);
    } finally {
      setSibuk("");
    }
  }

  async function tes() {
    setSibuk("tes");
    setHasilTes(await api.tesAI(uji).catch((e) => ({ ok: false, pesan: (e as Error).message })));
    setSibuk("");
  }

  async function ambilModel(data: { ai_base_url?: string; ai_api_key?: string } = uji) {
    if (!data.ai_base_url) {
      setGalatModel("Isi Base URL dulu.");
      return;
    }
    setSibuk("model");
    const r = await api.modelAI(data).catch((e) => ({ ok: false, model: [] as string[], pesan: (e as Error).message }));
    setDaftarModel(r.model);
    setGalatModel(r.ok ? "" : r.pesan ?? "Gagal mengambil daftar model.");
    setSibuk("");
  }

  async function hapusKunci() {
    try {
      setP(await api.simpanPengaturan({ hapus_api_key: true }));
      toast("info", "API key dihapus");
    } catch (e) {
      toast("galat", "Gagal menghapus API key", (e as Error).message);
    }
  }

  if (galat) return <Pesan jenis="galat" judul="Pengaturan tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muat}>Coba lagi</Tombol>}>{galat}</Pesan>;
  if (!p) return <MemuatHalaman teks="Memuat pengaturan…" />;
  return (
    <>
      <JudulHalaman judul="Pengaturan" sub="Koneksi AI, login Google, dan penyimpanan berkas hasil. Hanya admin yang bisa mengubahnya." />

      <BagianPengaturan
        id={`${id}-ai`}
        judul="Koneksi AI"
        sub={
          <>
            <p>Layanan OpenAI-compatible: 9router, OpenRouter, LiteLLM, Ollama, atau lainnya.</p>
            <p className="mt-3">AI dipakai untuk membaca petunjuk template dan menilai aturan naratif. Format, struktur, jumlah kata, dan referensi tetap dicek bot tanpa AI.</p>
          </>
        }
        kaki={
          <>
            <Tombol ikon={Plug} onClick={tes} memuat={sibuk === "tes"} disabled={!baseUrl || !model}>Tes koneksi</Tombol>
            <Tombol varian="utama" onClick={() => simpan("simpan")} memuat={sibuk === "simpan"}>Simpan</Tombol>
          </>
        }
      >
        <div>
          <label className="label" htmlFor={`${id}-url`}>Base URL</label>
          <input id={`${id}-url`} className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:20128/v1" />
          <p className="mt-1.5 text-xs text-ink-2">Biasanya diakhiri <code className={kode}>/v1</code>. Kalau lupa, sistem mencoba menambahkannya otomatis.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor={`${id}-key`}>API key</label>
            <input id={`${id}-key`} className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)}
              placeholder={p.ai_api_key_terisi ? `tersimpan (${p.ai_api_key_samar})` : "kosongkan bila tidak perlu"} />
            {p.ai_api_key_terisi && (
              <button type="button" className="ketuk mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-bahaya hover:underline" onClick={hapusKunci}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Hapus API key tersimpan
              </button>
            )}
          </div>
          <div>
            <span className="label" id={`${id}-model`}>Model</span>
            <PemilihModel labelId={`${id}-model`} nilai={model} ubah={setModel} daftar={daftarModel} memuat={sibuk === "model"} galat={galatModel} muatUlang={() => ambilModel()} />
          </div>
        </div>
        {hasilTes && (
          <div role="status" className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${hasilTes.ok ? "bg-ok-soft text-ok" : "bg-bahaya-soft text-bahaya"}`}>
            {hasilTes.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <span className="min-w-0 break-words">{hasilTes.pesan}</span>
          </div>
        )}
        <Pesan jenis="peringatan" judul="Kerahasiaan naskah">
          Saat aturan naratif dicek, isi naskah dikirim ke layanan AI. Untuk naskah yang sedang direview, pilihan paling aman adalah model lokal. API key tidak pernah dikirim kembali ke browser.
        </Pesan>
      </BagianPengaturan>

      <BagianPengaturan id={`${id}-google`} judul="Login Google" sub="Diatur lewat berkas .env di server, lalu restart aplikasi.">
        <div className="flex items-center gap-3">
          <LogoGoogle className="h-6 w-6" />
          <div className={`flex items-center gap-1.5 text-sm font-semibold ${konf?.google ? "text-ok" : "text-waspada"}`}>
            {konf?.google ? <CircleCheck className="h-4 w-4" aria-hidden /> : <CircleX className="h-4 w-4" aria-hidden />}
            {konf?.google ? "Aktif" : "Belum dikonfigurasi"}
          </div>
        </div>
        <p className="text-sm text-ink-2">
          Isi <code className={kode}>GOOGLE_CLIENT_ID</code> dan <code className={kode}>GOOGLE_CLIENT_SECRET</code> di <code className={kode}>.env</code>.
        </p>
        {konf && (
          <div>
            <label className="label" htmlFor={`${id}-redirect`}>Authorized redirect URI (Google Cloud Console)</label>
            <div className="flex gap-2">
              <input id={`${id}-redirect`} className="input min-w-0 font-mono text-xs" readOnly value={konf.redirect_uri} />
              <Tombol ikon={Copy} aria-label="Salin redirect URI" title="Salin" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(konf.redirect_uri);
                  toast("sukses", "Disalin");
                } catch {
                  toast("galat", "Tidak bisa menyalin", "Salin manual dari kolom di sebelahnya.");
                }
              }} />
            </div>
          </div>
        )}
      </BagianPengaturan>

      <BagianPengaturan
        id={`${id}-simpan`}
        judul="Penyimpanan berkas hasil"
        sub="Naskah unggahan langsung dihapus setelah diperiksa. Salinan berkomentar disimpan sementara lalu dihapus otomatis."
        kaki={<Tombol varian="utama" onClick={() => simpan("retensi")} memuat={sibuk === "retensi"}>Simpan</Tombol>}
      >
        <div className="max-w-48">
          <label className="label" htmlFor={`${id}-retensi`}>Hapus setelah (jam)</label>
          <input id={`${id}-retensi`} className="input" type="number" min={1} value={retensi} onChange={(e) => setRetensi(Number(e.target.value))} />
        </div>
      </BagianPengaturan>
    </>
  );
}
