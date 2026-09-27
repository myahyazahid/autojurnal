import { ArrowLeft, Download, FileText, FolderDown, History, ScanSearch, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, relatif, type Cek } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import HasilCek from "../components/HasilCek";
import { JudulHalaman, Kartu, Kerangka, Kosong, Lencana, LencanaScope, MemuatHalaman, Pesan, Sakelar, TautanTombol, Tombol } from "../components/ui";

export function Riwayat() {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  const toast = useToast();
  const [semua, setSemua] = useState(false);
  const [data, setData] = useState<Cek[] | null>(null);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [cari, setCari] = useState("");
  const muat = () => api.riwayat(semua).then(setData).catch((e) => toast("galat", "Gagal memuat", e.message));
  useEffect(() => {
    setData(null);
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semua]);

  const tampil = useMemo(() => {
    const q = cari.toLowerCase();
    return (data ?? []).filter((c) => !q || c.nama_file.toLowerCase().includes(q) || c.jurnal_nama.toLowerCase().includes(q) || c.pengguna_nama.toLowerCase().includes(q));
  }, [data, cari]);
  const tersedia = tampil.filter((c) => pilih.has(c.id) && c.file_tersedia).map((c) => c.id);

  return (
    <>
      <JudulHalaman
        ikon={History}
        judul="Riwayat Pengecekan"
        sub="Berkas hasil dihapus otomatis setelah masa simpan; ringkasannya tetap tercatat."
        aksi={tersedia.length > 0 && <TautanTombol href={api.urlZip(tersedia)} varian="utama" ikon={FolderDown}>Unduh {tersedia.length} (.zip)</TautanTombol>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input className="input pl-10" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari naskah, jurnal, atau pengguna…" />
        </div>
        {admin && <Sakelar nyala={semua} ubah={setSemua} label="Tampilkan semua pengguna" />}
      </div>
      {data === null ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Kerangka key={i} className="h-16" />)}</div>
      ) : tampil.length === 0 ? (
        <Kosong ikon={ScanSearch} judul={cari ? "Tidak ada yang cocok" : "Belum ada pengecekan"}
          aksi={!cari && <Link to="/"><Tombol varian="utama" ikon={ScanSearch}>Cek naskah</Tombol></Link>} />
      ) : (
        <Kartu className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold tracking-wide text-ink-3 uppercase">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={pilih.size > 0 && pilih.size === tampil.length}
                    onChange={(e) => setPilih(e.target.checked ? new Set(tampil.map((c) => c.id)) : new Set())} />
                </th>
                <th className="px-2 py-3">Naskah</th>
                <th className="px-2 py-3">Scope</th>
                <th className="px-2 py-3">Format</th>
                {semua && <th className="px-2 py-3">Pengguna</th>}
                <th className="px-2 py-3">Waktu</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tampil.map((c) => {
                const r = c.ringkasan;
                return (
                  <tr key={c.id} className="transition hover:bg-panel-2">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={pilih.has(c.id)} onChange={(e) => {
                        const s = new Set(pilih);
                        if (e.target.checked) s.add(c.id);
                        else s.delete(c.id);
                        setPilih(s);
                      }} />
                    </td>
                    <td className="max-w-80 px-2 py-3">
                      <Link to={`/riwayat/${c.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><FileText className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink hover:text-brand">{c.nama_file}</span>
                          <span className="block truncate text-xs text-ink-3">{c.jurnal_nama}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-3">
                      {c.scope?.keputusan ? <LencanaScope keputusan={c.scope.keputusan} besar /> : <span className="text-xs text-ink-3">belum dinilai</span>}
                    </td>
                    <td className="px-2 py-3">
                      {c.status === "gagal" ? <Lencana jenis="wajib">gagal</Lencana> : r ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <Lencana jenis={r.wajib === 0 ? "sukses" : "wajib"}>{r.wajib === 0 ? "siap kirim" : `${r.wajib} wajib`}</Lencana>
                          <Lencana jenis="saran">{r.saran} saran</Lencana>
                          {c.pakai_ai && <Lencana jenis="ai" ikon={Sparkles}>{r.ai}</Lencana>}
                        </span>
                      ) : null}
                    </td>
                    {semua && <td className="px-2 py-3 text-xs text-ink-2">{c.pengguna_nama || "—"}</td>}
                    <td className="px-2 py-3 text-xs whitespace-nowrap text-ink-3">{relatif(c.dibuat)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {c.file_tersedia && <TautanTombol ukuran="kecil" varian="lembut" ikon={Download} href={api.urlUnduh(c.id)}>Unduh</TautanTombol>}{" "}
                      <Tombol ukuran="kecil" varian="hantu" ikon={Trash2} aria-label="Hapus" className="hover:!text-rose-500" onClick={async () => {
                        if (!confirm("Hapus catatan pengecekan ini beserta berkas hasilnya?")) return;
                        await api.hapusCek(c.id);
                        toast("sukses", "Dihapus", c.nama_file);
                        muat();
                      }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Kartu>
      )}
    </>
  );
}

export function DetailCek() {
  const { id } = useParams();
  const [cek, setCek] = useState<Cek | null>(null);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    if (id) api.detailCek(id).then(setCek).catch((e) => setGalat(e.message));
  }, [id]);
  return (
    <>
      <Link to="/riwayat" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
        <ArrowLeft className="h-4 w-4" /> Riwayat
      </Link>
      {galat ? <Pesan jenis="galat">{galat}</Pesan> : cek ? <HasilCek cek={cek} /> : <MemuatHalaman />}
    </>
  );
}
