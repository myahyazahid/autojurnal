import { Crown, Mail, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, relatif, type Pengguna as P } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { Avatar, JudulHalaman, Kartu, Kerangka, Lencana, LogoGoogle, Sakelar } from "../components/ui";

export default function Pengguna() {
  const { pengguna: saya } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<P[] | null>(null);
  const [cari, setCari] = useState("");
  useEffect(() => {
    api.daftarPengguna().then(setData).catch((e) => toast("galat", "Gagal memuat", e.message));
  }, [toast]);

  async function ubah(u: P, isi: { peran?: string; aktif?: boolean }) {
    try {
      const baru = await api.ubahPengguna(u.id, isi);
      setData((d) => d?.map((x) => (x.id === u.id ? baru : x)) ?? null);
      toast("sukses", "Tersimpan", `${baru.nama || baru.email}: ${baru.peran}${baru.aktif ? "" : " (nonaktif)"}`);
    } catch (e) {
      toast("galat", "Gagal", (e as Error).message);
    }
  }

  const tampil = useMemo(() => {
    const q = cari.toLowerCase();
    return (data ?? []).filter((u) => !q || u.email.includes(q) || u.nama.toLowerCase().includes(q));
  }, [data, cari]);
  const jumlahAdmin = data?.filter((u) => u.peran === "admin").length ?? 0;

  return (
    <>
      <JudulHalaman ikon={Users} judul="Pengguna"
        sub="Admin mengelola profil jurnal, AI, dan pengguna. Pengguna biasa bisa mengecek naskah dan melihat riwayatnya sendiri." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input className="input pl-10" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau email…" />
        </div>
        {data && <span className="text-sm text-ink-3">{data.length} akun · {jumlahAdmin} admin</span>}
      </div>
      {data === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Kerangka key={i} className="h-16" />)}</div>
      ) : (
        <Kartu className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold tracking-wide text-ink-3 uppercase">
                <th className="px-5 py-3">Akun</th>
                <th className="px-2 py-3">Masuk dengan</th>
                <th className="px-2 py-3">Peran</th>
                <th className="px-2 py-3">Aktif</th>
                <th className="px-5 py-3">Terakhir masuk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tampil.map((u) => (
                <tr key={u.id} className={`transition hover:bg-panel-2 ${u.aktif ? "" : "opacity-55"}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nama={u.nama || u.email} foto={u.foto} ukuran={38} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate font-semibold text-ink">
                          {u.nama || u.email.split("@")[0]}
                          {u.id === saya?.id && <Lencana jenis="info">Anda</Lencana>}
                        </div>
                        <div className="truncate text-xs text-ink-3">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1.5">
                      {u.terhubung_google && <span title="Google" className="flex h-7 w-7 items-center justify-center rounded-lg bg-panel-3"><LogoGoogle className="h-4 w-4" /></span>}
                      {u.punya_sandi && <span title="Email & sandi" className="flex h-7 w-7 items-center justify-center rounded-lg bg-panel-3 text-ink-2"><Mail className="h-4 w-4" /></span>}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      {u.peran === "admin" && <Crown className="h-4 w-4 text-amber-500" />}
                      <select className="input-sm w-32" value={u.peran} onChange={(e) => ubah(u, { peran: e.target.value })}>
                        <option value="pengguna">Pengguna</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Sakelar nyala={u.aktif} ubah={(v) => ubah(u, { aktif: v })} nonaktif={u.id === saya?.id} label="" />
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-3">{relatif(u.terakhir_masuk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kartu>
      )}
    </>
  );
}
