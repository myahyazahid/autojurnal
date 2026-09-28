import { Download, FolderDown, History, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, relatif, tanggal, type Cek, type StatistikDasbor } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import HasilCek from "../components/HasilCek";
import Membaca from "../components/Membaca";
import {
  IkonBerkas, JudulHalaman, Kartu, Kerangka, Lencana, LencanaScope, MemuatHalaman, Pesan, Sakelar, StripAngka, TautanTombol, Tombol,
} from "../components/ui";

function Format({ c }: { c: Cek }) {
  const r = c.ringkasan;
  if (c.status === "gagal") return <Lencana jenis="wajib">Gagal diperiksa</Lencana>;
  if (!r) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Lencana jenis={r.wajib === 0 ? "sukses" : "wajib"}>{r.wajib === 0 ? "Siap kirim" : `${r.wajib} wajib`}</Lencana>
      <Lencana jenis="saran">{r.saran} saran</Lencana>
      {c.pakai_ai && <Lencana jenis="ai">AI {r.ai}</Lencana>}
    </span>
  );
}

/** Angka dari /api/statistik: ringkasan semua pengecekan pengguna ini. */
function Statistik() {
  const [stat, setStat] = useState<StatistikDasbor | null>(null);
  const [galat, setGalat] = useState(false);
  useEffect(() => {
    api.statistik().then(setStat).catch(() => setGalat(true));
  }, []);
  if (galat) return <p className="mb-6 text-sm text-ink-2">Statistik pengecekan belum bisa dimuat.</p>;
  if (!stat) return <Kerangka className="mb-6 h-[88px]" />;
  return (
    <StripAngka
      className="mb-6"
      butir={[
        { label: "Total pengecekan", nilai: stat.total_cek },
        { label: "Minggu ini", nilai: stat.cek_minggu_ini },
        { label: "Rata-rata masalah", nilai: stat.rata_masalah?.toLocaleString("id-ID", { maximumFractionDigits: 1 }) ?? "belum ada", ket: "per naskah" },
        { label: "Siap dikirim", nilai: stat.siap_kirim, ket: "tanpa pelanggaran wajib" },
      ]}
    />
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
    ? "lg:grid-cols-[1.25rem_minmax(0,1.6fr)_9.5rem_minmax(0,1.1fr)_minmax(0,0.8fr)_6.5rem_7.5rem]"
    : "lg:grid-cols-[1.25rem_minmax(0,1.7fr)_9.5rem_minmax(0,1.2fr)_6.5rem_7.5rem]";

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
        aksi={<TautanTombol ke="/" varian="utama">Cek naskah baru</TautanTombol>}
      />
      <Statistik />

      <Kartu className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="input pl-9" type="search" aria-label="Cari riwayat" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari naskah, jurnal, atau pengguna…" />
          </div>
          {admin && <Sakelar nyala={semua} ubah={setSemua} label="Semua pengguna" />}
          {tersedia.length > 0 && (
            <TautanTombol href={api.urlZip(tersedia)} ukuran="kecil" varian="lembut" ikon={FolderDown} className="sm:ml-auto">
              Unduh {tersedia.length} berkas (.zip)
            </TautanTombol>
          )}
        </div>

        {galat ? (
          <div className="p-4 sm:p-5">
            <Pesan jenis="galat" judul="Riwayat tidak bisa dimuat" aksi={<Tombol ukuran="kecil" onClick={muat}>Coba lagi</Tombol>}>{galat}</Pesan>
          </div>
        ) : data === null ? (
          <Membaca judul="Memuat riwayat pengecekan…" className="px-4 py-12" />
        ) : tampil.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-tinta"><History className="h-6 w-6" aria-hidden /></span>
            <div className="font-semibold">{cari ? "Tidak ada yang cocok" : "Belum ada pengecekan"}</div>
            <p className="mt-1.5 max-w-sm text-sm text-ink-2">
              {cari ? `Tidak ada naskah, jurnal, atau pengguna yang memuat "${cari}".` : "Naskah yang Anda periksa akan tercatat di sini."}
            </p>
            <div className="mt-5">
              {cari ? <Tombol onClick={() => setCari("")}>Hapus pencarian</Tombol> : <TautanTombol ke="/" varian="utama">Cek naskah pertama</TautanTombol>}
            </div>
          </div>
        ) : (
          <>
            <div className={`hidden items-center gap-x-4 border-b border-line bg-panel-2 px-5 py-2.5 text-xs font-medium text-ink-2 lg:grid ${kolom}`}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                aria-label="Pilih semua"
                checked={pilih.size > 0 && pilih.size === tampil.length}
                onChange={(e) => setPilih(e.target.checked ? new Set(tampil.map((c) => c.id)) : new Set())}
              />
              <span>Naskah</span>
              <span>Scope</span>
              <span>Format</span>
              {semua && <span>Pengguna</span>}
              <span>Waktu</span>
              <span className="sr-only">Aksi</span>
            </div>
            <ul className="divide-y divide-line">
              {tampil.map((c) => (
                <li key={c.id} className={`grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5 transition-colors hover:bg-panel-2 sm:px-5 lg:items-center lg:gap-x-4 ${kolom}`}>
                  <label className={`ketuk inline-flex items-start pt-2.5 lg:row-span-1 lg:items-center lg:pt-0 ${semua ? "row-span-5" : "row-span-4"}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
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
                  <Link to={`/riwayat/${c.id}`} className="group flex min-w-0 items-center gap-3">
                    <IkonBerkas ukuran={30} redup={!c.file_tersedia} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand-tinta group-hover:underline">{c.nama_file}</span>
                      <span className="block truncate text-xs text-ink-2">{c.jurnal_nama}</span>
                    </span>
                  </Link>
                  <div className="min-w-0">
                    {c.scope?.keputusan ? <LencanaScope keputusan={c.scope.keputusan} besar /> : <span className="text-xs text-ink-3">Scope belum dinilai</span>}
                  </div>
                  <div className="min-w-0"><Format c={c} /></div>
                  {semua && <div className="truncate text-xs text-ink-2">{c.pengguna_nama || "(tanpa nama)"}</div>}
                  <div className="flex items-center justify-between gap-2 lg:contents">
                    <span className="text-xs whitespace-nowrap text-ink-2" title={tanggal(c.dibuat)}>{relatif(c.dibuat)}</span>
                    <span className="flex items-center justify-end gap-1">
                      {c.file_tersedia && <TautanTombol ukuran="kecil" varian="biasa" ikon={Download} href={api.urlUnduh(c.id)}>Unduh</TautanTombol>}
                      <Tombol ukuran="kecil" varian="hantu" ikon={Trash2} aria-label={`Hapus ${c.nama_file}`} title="Hapus" className="hover:!bg-bahaya-soft hover:!text-bahaya" onClick={() => hapus(c)} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Kartu>
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
      <JudulHalaman judul="Hasil pengecekan" kembali={{ ke: "/riwayat", label: "Riwayat" }} />
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

