import { Save } from "lucide-react";
import { useId, useState } from "react";
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

/** Pratinjau komentar di panel Review Word. Pesannya memakai format asli dari mesin pemeriksa. */
function PratinjauKomentar({ penulis, foto }: { penulis: string; foto?: string }) {
  return (
    <figure className="rounded-lg border border-line bg-panel-2 p-4">
      <figcaption className="mb-3 text-xs font-semibold text-ink-2">Contoh tampilan di Microsoft Word</figcaption>
      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,15rem)]">
        <p className="font-serif text-sm leading-relaxed text-ink-2">
          <span className="font-bold text-ink">Abstrak. </span>
          <mark className="rounded-sm bg-brand-soft px-0.5 text-ink">Penelitian ini menganalisis pengaruh literasi digital</mark> terhadap kinerja guru sekolah dasar.
        </p>
        <div className="self-start rounded-lg border border-line bg-panel p-3">
          <div className="flex items-center gap-2">
            <Avatar nama={penulis} foto={foto} ukuran={24} />
            <div className="min-w-0 truncate text-xs font-semibold text-ink">{penulis}</div>
          </div>
          <p className="mt-2 text-xs leading-snug text-ink-2">Abstrak terdiri atas 174 kata; seharusnya 200–250 kata.</p>
        </div>
      </div>
    </figure>
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
  const id = useId();
  if (!pengguna) return null;

  async function simpanProfil() {
    setSibuk("profil");
    try {
      setPengguna(await api.ubahSaya({ nama, format_nama_komentar: format }));
      toast("sukses", "Profil tersimpan", "Nama komentar berlaku untuk pengecekan berikutnya.");
    } catch (e) {
      toast("galat", "Gagal menyimpan profil", (e as Error).message);
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
      toast("galat", "Gagal menyimpan sandi", (e as Error).message);
    } finally {
      setSibuk("");
    }
  }

  return (
    <>
      <JudulHalaman judul="Akun saya" sub="Identitas ini dipakai sebagai penulis komentar di naskah yang Anda periksa." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Kartu className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <Avatar nama={pengguna.nama || pengguna.email} foto={pengguna.foto} ukuran={64} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-xl font-semibold break-words">{pengguna.nama || pengguna.email.split("@")[0]}</span>
                <Lencana jenis={pengguna.peran === "admin" ? "info" : "netral"}>{pengguna.peran === "admin" ? "Admin" : "Pengguna"}</Lencana>
              </div>
              <div className="text-sm break-all text-ink-2">{pengguna.email}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                {pengguna.terhubung_google && <span className="inline-flex items-center gap-1.5"><LogoGoogle className="h-3.5 w-3.5" /> Terhubung dengan Google</span>}
                {pengguna.punya_sandi && <span>Bisa masuk dengan email &amp; sandi</span>}
                <span>Bergabung {tanggal(pengguna.dibuat)}</span>
              </div>
            </div>
          </Kartu>

          <Kartu className="space-y-5 p-5 sm:p-6">
            <h2 className="font-serif text-lg font-semibold">Nama di komentar Word</h2>
            <div>
              <label className="label" htmlFor={`${id}-nama`}>Nama tampilan</label>
              <input id={`${id}-nama`} className="input max-w-md" value={nama} onChange={(e) => setNama(e.target.value)} />
              {pengguna.terhubung_google && <p className="mt-1 text-xs text-ink-2">Diambil dari akun Google dan diperbarui setiap kali masuk dengan Google.</p>}
            </div>
            <fieldset>
              <legend className="label">Tampilkan sebagai</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {OPSI.map((o) => (
                  <label key={o.nilai}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${format === o.nilai ? "border-brand-kuat bg-brand-soft" : "border-line-2 hover:border-isian"}`}>
                    <input type="radio" name={`${id}-format`} className="mt-0.5 h-4 w-4 accent-brand-kuat" checked={format === o.nilai} onChange={() => setFormat(o.nilai)} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{o.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-2">{contohNama(nama || "Nama", pengguna.email, o.nilai)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <PratinjauKomentar penulis={contohNama(nama || pengguna.email, pengguna.email, format)} foto={pengguna.foto} />
            <Tombol varian="utama" ikon={Save} onClick={simpanProfil} memuat={sibuk === "profil"}>Simpan nama komentar</Tombol>
          </Kartu>
        </div>

        <Kartu className="space-y-4 p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold">{pengguna.punya_sandi ? "Ganti kata sandi" : "Buat kata sandi"}</h2>
          {!pengguna.punya_sandi && <p className="text-sm text-ink-2">Akun Anda dibuat lewat Google. Buat sandi bila ingin bisa masuk juga dengan email.</p>}
          {pengguna.punya_sandi && (
            <div>
              <label className="label" htmlFor={`${id}-lama`}>Sandi lama</label>
              <input id={`${id}-lama`} className="input" type="password" value={lama} onChange={(e) => setLama(e.target.value)} autoComplete="current-password" />
            </div>
          )}
          <div>
            <label className="label" htmlFor={`${id}-baru`}>Sandi baru</label>
            <input id={`${id}-baru`} className="input" type="password" value={baru} onChange={(e) => setBaru(e.target.value)} placeholder="Minimal 8 karakter" autoComplete="new-password" />
            {baru.length > 0 && baru.length < 8 && <p className="mt-1 text-xs text-brand-tinta">Masih {8 - baru.length} karakter lagi.</p>}
          </div>
          <Tombol varian="utama" className="w-full" onClick={simpanSandi} memuat={sibuk === "sandi"} disabled={baru.length < 8}>Simpan sandi</Tombol>
        </Kartu>
      </div>
    </>
  );
}
