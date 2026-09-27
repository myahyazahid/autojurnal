import { Mail, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, relatif, type Pengguna as P } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { Avatar, JudulHalaman, Kartu, Kerangka, Kosong, Lencana, LogoGoogle, Pesan, Sakelar, Tombol } from "../components/ui";

const kolom = "md:grid-cols-[minmax(0,2fr)_6rem_9rem_5rem_minmax(0,1fr)]";

export default function Pengguna() {
  const { pengguna: saya } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<P[] | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const muat = () => {
    setGalat("");
    api.daftarPengguna().then(setData).catch((e) => setGalat(e.message));
  };
  useEffect(() => {
    muat();
  }, []);

  async function ubah(u: P, isi: { peran?: string; aktif?: boolean }) {
    try {
      const baru = await api.ubahPengguna(u.id, isi);
      setData((d) => d?.map((x) => (x.id === u.id ? baru : x)) ?? null);
      toast("sukses", "Tersimpan", `${baru.nama || baru.email}: ${baru.peran}${baru.aktif ? "" : " (nonaktif)"}`);
    } catch (e) {
      toast("galat", "Gagal menyimpan", (e as Error).message);
    }
  }

  const tampil = useMemo(() => {
    const q = cari.toLowerCase();
    return (data ?? []).filter((u) => !q || u.email.includes(q) || u.nama.toLowerCase().includes(q));
  }, [data, cari]);
  const jumlahAdmin = data?.filter((u) => u.peran === "admin").length ?? 0;

  return (
    <>
      <JudulHalaman judul="Pengguna"
        sub="Admin mengelola profil jurnal, AI, dan pengguna. Pengguna biasa bisa mengecek naskah dan melihat riwayatnya sendiri." />
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden />
          <input className="input pl-9" type="search" aria-label="Cari pengguna" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau email…" />
        </div>
        {data && <span className="text-sm text-ink-2">{data.length} akun, {jumlahAdmin} admin</span>}
      </div>
      {galat ? (
        <Pesan jenis="galat" judul="Daftar pengguna tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muat}>Coba lagi</Tombol>}>{galat}</Pesan>
      ) : data === null ? (
        <div className="space-y-2" role="status" aria-label="Memuat pengguna">{[0, 1, 2].map((i) => <Kerangka key={i} className="h-16" />)}</div>
      ) : tampil.length === 0 ? (
        <Kosong judul="Tidak ada yang cocok" sub={`Tidak ada nama atau email yang memuat "${cari}".`} aksi={<Tombol onClick={() => setCari("")}>Hapus pencarian</Tombol>} />
      ) : (
        <Kartu>
          <div className={`hidden gap-x-4 border-b border-line px-5 py-2.5 text-xs font-semibold text-ink-2 md:grid ${kolom}`}>
            <span>Akun</span>
            <span>Masuk dengan</span>
            <span>Peran</span>
            <span>Aktif</span>
            <span>Terakhir masuk</span>
          </div>
          <ul className="divide-y divide-line">
            {tampil.map((u) => {
              const namaTampil = u.nama || u.email.split("@")[0];
              return (
                <li key={u.id} className={`grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-3.5 ${kolom}`}>
                  <div className={`col-span-2 flex min-w-0 items-center gap-3 md:col-span-1 ${u.aktif ? "" : "opacity-60"}`}>
                    <Avatar nama={u.nama || u.email} foto={u.foto} ukuran={36} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-ink">{namaTampil}</span>
                        {u.id === saya?.id && <Lencana jenis="info">Anda</Lencana>}
                        {!u.aktif && <Lencana>nonaktif</Lencana>}
                      </div>
                      <div className="truncate text-xs text-ink-2">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-ink-2">
                    <span className="text-xs md:hidden">Masuk dengan</span>
                    {u.terhubung_google && <span title="Google" aria-label="Google"><LogoGoogle className="h-4 w-4" /></span>}
                    {u.punya_sandi && <span title="Email & sandi" aria-label="Email dan sandi"><Mail className="h-4 w-4" /></span>}
                  </div>
                  <select className="input-sm ketuk w-full md:w-32" aria-label={`Peran ${namaTampil}`} value={u.peran} onChange={(e) => ubah(u, { peran: e.target.value })}>
                    <option value="pengguna">Pengguna</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Sakelar nyala={u.aktif} ubah={(v) => ubah(u, { aktif: v })} nonaktif={u.id === saya?.id} label="" labelAria={`Akun ${namaTampil} aktif`} />
                  <span className="text-xs text-ink-2">
                    <span className="md:hidden">Terakhir masuk </span>{relatif(u.terakhir_masuk)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Kartu>
      )}
    </>
  );
}
