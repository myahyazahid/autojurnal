import { CircleUser, KeyRound, Mail, MessageSquareText, Save } from "lucide-react";
import { useState } from "react";
import { api, tanggal, type FormatNama } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { Avatar, JudulHalaman, Kartu, Lencana, LogoGoogle, Tombol } from "../components/ui";

const OPSI: { nilai: FormatNama; label: string }[] = [
  { nilai: "nama", label: "Nama saja" },
  { nilai: "nama_email", label: "Nama + email" },
  { nilai: "email", label: "Email saja" },
];

function contohNama(nama: string, email: string, f: FormatNama) {
  return f === "email" ? email : f === "nama_email" ? `${nama} (${email})` : nama;
}

/** Pratinjau komentar gaya panel Review di Microsoft Word. */
function PratinjauKomentar({ penulis, foto }: { penulis: string; foto?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel-2 p-4">
      <div className="mb-2 text-[11px] font-bold tracking-wide text-ink-3 uppercase">Pratinjau di Microsoft Word</div>
      <div className="flex gap-3">
        <div className="hidden w-1/2 space-y-1.5 sm:block">
          <div className="h-2 w-11/12 rounded bg-line-2" />
          <div className="h-2 w-full rounded bg-line-2" />
          <div className="h-2 w-10/12 rounded bg-amber-300/70 dark:bg-amber-400/40" />
          <div className="h-2 w-full rounded bg-line-2" />
          <div className="h-2 w-8/12 rounded bg-line-2" />
        </div>
        <div className="flex-1 rounded-xl border border-line bg-panel p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Avatar nama={penulis} foto={foto} ukuran={26} />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-ink">{penulis}</div>
              <div className="text-[10px] text-ink-3">baru saja</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-2">
            <b className="text-ink">[WAJIB · Abstrak]</b> Abstrak terdiri atas 174 kata; seharusnya 200–250 kata.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Akun() {
  const { pengguna, setPengguna } = useAuth();
  const toast = useToast();
  const [nama, setNama] = useState(pengguna?.nama ?? "");
  const [format, setFormat] = useState<FormatNama>(pengguna?.format_nama_komentar ?? "nama");
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [sibuk, setSibuk] = useState<"" | "profil" | "sandi">("");
  if (!pengguna) return null;

  async function simpanProfil() {
    setSibuk("profil");
    try {
      setPengguna(await api.ubahSaya({ nama, format_nama_komentar: format }));
      toast("sukses", "Profil tersimpan", "Nama komentar berlaku untuk pengecekan berikutnya.");
    } catch (e) {
      toast("galat", "Gagal", (e as Error).message);
    } finally {
      setSibuk("");
    }
  }

  async function simpanSandi() {
    setSibuk("sandi");
    try {
      await api.ubahSandi(lama, baru);
      setPengguna({ ...pengguna!, punya_sandi: true });
      setLama("");
      setBaru("");
      toast("sukses", "Kata sandi tersimpan");
    } catch (e) {
      toast("galat", "Gagal", (e as Error).message);
    } finally {
      setSibuk("");
    }
  }

  return (
    <>
      <JudulHalaman ikon={CircleUser} judul="Akun Saya" sub="Identitas ini dipakai sebagai penulis komentar di naskah yang Anda periksa." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Kartu className="overflow-hidden">
            <div className="bg-merek relative h-24">
              <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:18px_18px]" />
            </div>
            <div className="px-6 pb-6">
              <div className="relative -mt-10 flex flex-wrap items-end gap-4">
                <div className="rounded-full bg-panel p-1"><Avatar nama={pengguna.nama || pengguna.email} foto={pengguna.foto} ukuran={80} /></div>
                <div className="pb-1">
                  <div className="text-xl font-extrabold">{pengguna.nama || pengguna.email.split("@")[0]}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
                    {pengguna.email}
                    <Lencana jenis={pengguna.peran === "admin" ? "ai" : "netral"}>{pengguna.peran === "admin" ? "Admin" : "Pengguna"}</Lencana>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {pengguna.terhubung_google && <span className="inline-flex items-center gap-2 rounded-lg bg-panel-3 px-3 py-1.5 text-xs font-semibold"><LogoGoogle className="h-4 w-4" /> Terhubung dengan Google</span>}
                {pengguna.punya_sandi && <span className="inline-flex items-center gap-2 rounded-lg bg-panel-3 px-3 py-1.5 text-xs font-semibold"><Mail className="h-4 w-4" /> Email & sandi</span>}
                <span className="inline-flex items-center rounded-lg bg-panel-3 px-3 py-1.5 text-xs text-ink-3">Bergabung {tanggal(pengguna.dibuat)}</span>
              </div>
            </div>
          </Kartu>

          <Kartu className="space-y-5 p-6">
            <div className="flex items-center gap-2 font-bold"><MessageSquareText className="h-5 w-5 text-brand" /> Nama di komentar Word</div>
            <div>
              <label className="label">Nama tampilan</label>
              <input className="input max-w-md" value={nama} onChange={(e) => setNama(e.target.value)} />
              {pengguna.terhubung_google && <p className="mt-1 text-xs text-ink-3">Diambil dari akun Google; diperbarui setiap kali masuk dengan Google.</p>}
            </div>
            <div>
              <label className="label">Tampilkan sebagai</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {OPSI.map((o) => (
                  <button key={o.nilai} type="button" onClick={() => setFormat(o.nilai)}
                    className={`rounded-xl border p-3 text-left transition ${format === o.nilai ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line hover:border-line-2"}`}>
                    <div className="text-sm font-bold text-ink">{o.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-ink-3">{contohNama(nama || "Nama", pengguna.email, o.nilai)}</div>
                  </button>
                ))}
              </div>
            </div>
            <PratinjauKomentar penulis={contohNama(nama || pengguna.email, pengguna.email, format)} foto={pengguna.foto} />
            <Tombol varian="utama" ikon={Save} onClick={simpanProfil} memuat={sibuk === "profil"}>Simpan</Tombol>
          </Kartu>
        </div>

        <Kartu className="h-fit space-y-4 p-6">
          <div className="flex items-center gap-2 font-bold"><KeyRound className="h-5 w-5 text-brand" /> {pengguna.punya_sandi ? "Ganti kata sandi" : "Buat kata sandi"}</div>
          {!pengguna.punya_sandi && <p className="text-sm text-ink-2">Akun Anda dibuat lewat Google. Buat sandi bila ingin bisa masuk juga dengan email.</p>}
          {pengguna.punya_sandi && (
            <div>
              <label className="label">Sandi lama</label>
              <input className="input" type="password" value={lama} onChange={(e) => setLama(e.target.value)} autoComplete="current-password" />
            </div>
          )}
          <div>
            <label className="label">Sandi baru</label>
            <input className="input" type="password" value={baru} onChange={(e) => setBaru(e.target.value)} placeholder="Minimal 8 karakter" autoComplete="new-password" />
          </div>
          <Tombol varian="utama" className="w-full" onClick={simpanSandi} memuat={sibuk === "sandi"} disabled={baru.length < 8}>Simpan sandi</Tombol>
        </Kartu>
      </div>
    </>
  );
}
