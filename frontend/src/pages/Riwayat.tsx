import { ArrowLeft, Download, FolderDown, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, relatif, type Cek } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import HasilCek from "../components/HasilCek";
import { JudulHalaman, Kartu, Kerangka, Kosong, Lencana, LencanaScope, MemuatHalaman, Pesan, Sakelar, TautanTombol, Tombol } from "../components/ui";

function HasilRingkas({ c }: { c: Cek }) {
  const r = c.ringkasan;
  if (c.status === "gagal") return <Lencana jenis="wajib">gagal diperiksa</Lencana>;
  if (!r) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Lencana jenis={r.wajib === 0 ? "sukses" : "wajib"}>{r.wajib === 0 ? "siap kirim" : `${r.wajib} wajib`}</Lencana>
      <Lencana jenis="saran">{r.saran} saran</Lencana>
      {c.pakai_ai && <Lencana jenis="ai">AI {r.ai}</Lencana>}
    </span>
  );
}

export function Riwayat() {
  const { pengguna } = useAuth();
  const admin = pengguna?.peran === "admin";
  const toast = useToast();
  const [semua, setSemua] = useState(false);
  const [data, setData] = useState<Cek[] | null>(null);
  const [galat, setGalat] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [cari, setCari] = useState("");
  const muat = () => {
    setGalat("");
    return api.riwayat(semua).then(setData).catch((e) => setGalat(e.message));
  };
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
  const kolom = semua
    ? "lg:grid-cols-[2rem_minmax(0,1.5fr)_9.5rem_minmax(0,1.1fr)_minmax(0,0.8fr)_7rem_9rem]"
    : "lg:grid-cols-[2rem_minmax(0,1.6fr)_9.5rem_minmax(0,1.2fr)_7rem_9rem]";

  async function hapus(c: Cek) {
    if (!confirm(`Hapus catatan pengecekan "${c.nama_file}" beserta berkas hasilnya?`)) return;
    try {
      await api.hapusCek(c.id);
      toast("sukses", "Dihapus", c.nama_file);
      muat();
    } catch (e) {
      toast("galat", "Gagal menghapus", (e as Error).message);
    }
  }

  return (
    <>
      <JudulHalaman
        judul="Riwayat pengecekan"
        sub="Berkas hasil dihapus otomatis setelah masa simpan. Ringkasannya tetap tercatat di sini."
        aksi={tersedia.length > 0 && <TautanTombol href={api.urlZip(tersedia)} varian="utama" ikon={FolderDown}>Unduh {tersedia.length} berkas (.zip)</TautanTombol>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden />
          <input className="input pl-9" type="search" aria-label="Cari riwayat" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari naskah, jurnal, atau pengguna…" />
        </div>
        {admin && <Sakelar nyala={semua} ubah={setSemua} label="Tampilkan semua pengguna" />}
      </div>
      {galat ? (
        <Pesan jenis="galat" judul="Riwayat tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muat}>Coba lagi</Tombol>}>{galat}</Pesan>
      ) : data === null ? (
        <div className="space-y-2" role="status" aria-label="Memuat riwayat">{[0, 1, 2, 3].map((i) => <Kerangka key={i} className="h-16" />)}</div>
      ) : tampil.length === 0 ? (
        <Kosong
          judul={cari ? "Tidak ada yang cocok" : "Belum ada pengecekan"}
          sub={cari ? `Tidak ada naskah, jurnal, atau pengguna yang memuat "${cari}".` : "Naskah yang Anda periksa akan tercatat di sini."}
          aksi={cari ? <Tombol onClick={() => setCari("")}>Hapus pencarian</Tombol> : <TautanTombol ke="/" varian="utama">Cek naskah pertama</TautanTombol>}
        />
      ) : (
        <Kartu>
          <div className={`hidden items-center gap-x-4 border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-2 lg:grid ${kolom}`}>
            <label className="inline-flex">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-kuat"
                aria-label="Pilih semua"
                checked={pilih.size > 0 && pilih.size === tampil.length}
                onChange={(e) => setPilih(e.target.checked ? new Set(tampil.map((c) => c.id)) : new Set())}
              />
            </label>
            <span>Naskah</span>
            <span>Scope</span>
            <span>Format</span>
            {semua && <span>Pengguna</span>}
            <span>Waktu</span>
            <span className="sr-only">Aksi</span>
          </div>
          <ul className="divide-y divide-line">
            {tampil.map((c) => (
              <li key={c.id} className={`grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 gap-y-2 px-4 py-3.5 lg:items-center ${kolom}`}>
                <label className={`ketuk inline-flex items-start pt-0.5 lg:row-span-1 lg:items-center lg:pt-0 ${semua ? "row-span-5" : "row-span-4"}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-kuat"
                    aria-label={`Pilih ${c.nama_file}`}
                    checked={pilih.has(c.id)}
                    onChange={(e) => {
                      const s = new Set(pilih);
                      if (e.target.checked) s.add(c.id);
                      else s.delete(c.id);
                      setPilih(s);
                    }}
                  />
                </label>
                <div className="min-w-0">
                  <Link to={`/riwayat/${c.id}`} className="block truncate text-sm font-semibold text-ink underline-offset-2 hover:text-brand-tinta hover:underline">
                    {c.nama_file}
                  </Link>
                  <div className="truncate text-xs text-ink-2">{c.jurnal_nama}</div>
                </div>
                <div className="min-w-0">
                  {c.scope?.keputusan ? <LencanaScope keputusan={c.scope.keputusan} besar /> : <span className="text-xs text-ink-2">scope belum dinilai</span>}
                </div>
                <div className="min-w-0"><HasilRingkas c={c} /></div>
                {semua && <div className="truncate text-xs text-ink-2">{c.pengguna_nama || "(tanpa nama)"}</div>}
                <div className="flex items-center justify-between gap-2 lg:contents">
                  <span className="text-xs whitespace-nowrap text-ink-2">{relatif(c.dibuat)}</span>
                  <span className="flex items-center justify-end gap-1">
                    {c.file_tersedia && <TautanTombol ukuran="kecil" varian="lembut" ikon={Download} href={api.urlUnduh(c.id)}>Unduh</TautanTombol>}
                    <Tombol ukuran="kecil" varian="hantu" ikon={Trash2} aria-label={`Hapus ${c.nama_file}`} title="Hapus" className="hover:!text-brand-tinta" onClick={() => hapus(c)} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
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
      <Link to="/riwayat" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Riwayat
      </Link>
      {galat ? (
        <Pesan jenis="galat" judul="Hasil pengecekan tidak bisa dimuat">{galat}</Pesan>
      ) : cek ? (
        <HasilCek cek={cek} />
      ) : (
        <MemuatHalaman teks="Memuat hasil pengecekan…" />
      )}
    </>
  );
}
