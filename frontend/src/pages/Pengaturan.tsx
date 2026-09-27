import { Bot, CircleCheck, CircleX, Copy, HardDrive, ListRestart, PlugZap, Save, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type KonfigurasiAuth, type Pengaturan as P } from "../lib/api";
import { useToast } from "../lib/toast";
import { JudulHalaman, Kartu, KotakIkon, LogoGoogle, MemuatHalaman, Pesan, Tombol } from "../components/ui";

export default function Pengaturan() {
  const toast = useToast();
  const [p, setP] = useState<P | null>(null);
  const [konf, setKonf] = useState<KonfigurasiAuth | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [retensi, setRetensi] = useState(24);
  const [daftarModel, setDaftarModel] = useState<string[]>([]);
  const [hasilTes, setHasilTes] = useState<{ ok: boolean; pesan: string } | null>(null);
  const [sibuk, setSibuk] = useState<"" | "simpan" | "tes" | "model">("");

  useEffect(() => {
    api.pengaturan().then((d) => {
      setP(d);
      setBaseUrl(d.ai_base_url);
      setModel(d.ai_model);
      setRetensi(d.retensi_jam);
    });
    api.konfigurasi().then(setKonf).catch(() => undefined);
  }, []);

  const uji = { ai_base_url: baseUrl, ai_model: model, ai_api_key: key || undefined };

  async function simpan() {
    setSibuk("simpan");
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

  async function ambilModel() {
    setSibuk("model");
    const r = await api.modelAI(uji).catch((e) => ({ ok: false, model: [] as string[], pesan: (e as Error).message }));
    setDaftarModel(r.model);
    if (r.ok) toast("info", `${r.model.length} model tersedia`, "Pilih dari saran di kolom Model.");
    else toast("galat", "Gagal mengambil model", r.pesan);
    setSibuk("");
  }

  if (!p) return <MemuatHalaman />;
  return (
    <>
      <JudulHalaman ikon={Settings} judul="Pengaturan" sub="Koneksi AI, login Google, dan penyimpanan berkas." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* ------------ AI ------------ */}
          <Kartu className="space-y-5 p-6">
            <div className="flex items-start gap-3.5">
              <KotakIkon ikon={Bot} />
              <div>
                <h2 className="font-bold text-ink">AI (OpenAI-compatible)</h2>
                <p className="text-sm text-ink-2">9router, OpenRouter, LiteLLM, Ollama — apa pun yang menyediakan <code className="rounded bg-panel-3 px-1">/chat/completions</code>.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label">Base URL</label>
                <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:20128/v1" />
                <p className="mt-1 text-xs text-ink-3">Biasanya diakhiri <code>/v1</code>. Kalau lupa, sistem mencoba menambahkannya otomatis.</p>
              </div>
              <div>
                <label className="label">API key</label>
                <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)}
                  placeholder={p.ai_api_key_terisi ? `tersimpan (${p.ai_api_key_samar})` : "kosongkan bila tidak perlu"} />
                {p.ai_api_key_terisi && (
                  <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline"
                    onClick={async () => { setP(await api.simpanPengaturan({ hapus_api_key: true })); toast("info", "API key dihapus"); }}>
                    <Trash2 className="h-3 w-3" /> Hapus API key tersimpan
                  </button>
                )}
              </div>
              <div>
                <label className="label">Model</label>
                <div className="flex gap-2">
                  <input className="input" list="daftar-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="mis. gpt-4o-mini" />
                  <Tombol ikon={ListRestart} onClick={ambilModel} memuat={sibuk === "model"} disabled={!baseUrl} title="Ambil daftar model" />
                </div>
                <datalist id="daftar-model">{daftarModel.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
            </div>
            {hasilTes && (
              <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${hasilTes.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
                {hasilTes.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0" />}
                {hasilTes.pesan}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Tombol ikon={PlugZap} onClick={tes} memuat={sibuk === "tes"} disabled={!baseUrl || !model}>Tes koneksi</Tombol>
              <Tombol varian="utama" ikon={Save} onClick={simpan} memuat={sibuk === "simpan"}>Simpan</Tombol>
            </div>
          </Kartu>

          {/* ------------ penyimpanan ------------ */}
          <Kartu className="space-y-4 p-6">
            <div className="flex items-start gap-3.5">
              <KotakIkon ikon={HardDrive} warna="lembut" />
              <div>
                <h2 className="font-bold text-ink">Penyimpanan berkas hasil</h2>
                <p className="text-sm text-ink-2">Naskah unggahan langsung dihapus setelah diperiksa. Salinan berkomentar disimpan sementara lalu dihapus otomatis.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label className="label">Hapus setelah (jam)</label>
                <input className="input" type="number" min={1} value={retensi} onChange={(e) => setRetensi(Number(e.target.value))} />
              </div>
              <Tombol varian="utama" ikon={Save} onClick={simpan} memuat={sibuk === "simpan"}>Simpan</Tombol>
            </div>
          </Kartu>
        </div>

        <div className="space-y-5">
          {/* ------------ Google ------------ */}
          <Kartu className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-3"><LogoGoogle /></span>
              <div className="flex-1">
                <h2 className="font-bold text-ink">Login Google</h2>
                <div className={`text-xs font-semibold ${konf?.google ? "text-emerald-500" : "text-amber-500"}`}>
                  {konf?.google ? "Aktif" : "Belum dikonfigurasi"}
                </div>
              </div>
            </div>
            <p className="text-sm text-ink-2">
              Diatur lewat berkas <code className="rounded bg-panel-3 px-1">.env</code> di folder aplikasi: <code className="rounded bg-panel-3 px-1">GOOGLE_CLIENT_ID</code> dan{" "}
              <code className="rounded bg-panel-3 px-1">GOOGLE_CLIENT_SECRET</code>, lalu restart aplikasi.
            </p>
            {konf && (
              <div>
                <label className="label">Authorized redirect URI (Google Cloud Console)</label>
                <div className="flex gap-2">
                  <input className="input font-mono text-xs" readOnly value={konf.redirect_uri} />
                  <Tombol ikon={Copy} title="Salin" onClick={() => { navigator.clipboard.writeText(konf.redirect_uri); toast("sukses", "Disalin"); }} />
                </div>
              </div>
            )}
          </Kartu>
          <Pesan jenis="info" judul="Kapan AI dipakai?">
            <ul className="ml-4 list-disc space-y-1">
              <li><b>Membaca template</b> (opsional): memahami ketentuan berbentuk kalimat.</li>
              <li><b>Aturan naratif</b> (opsional per cek): menilai substansi, mis. research gap.</li>
              <li>Format, struktur, jumlah kata, dan referensi dicek <b>bot tanpa AI</b>.</li>
            </ul>
          </Pesan>
          <Pesan jenis="peringatan" judul="Kerahasiaan naskah">
            Saat aturan naratif dicek, isi naskah dikirim ke layanan AI. Untuk naskah yang sedang direview, pilihan paling aman adalah model lokal.
          </Pesan>
          <div className="flex items-center gap-2 px-1 text-xs text-ink-3"><ShieldCheck className="h-4 w-4" /> API key tidak pernah dikirim kembali ke browser.</div>
        </div>
      </div>
    </>
  );
}
