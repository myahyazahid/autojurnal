export type Tingkat = "wajib" | "saran";

export interface Temuan {
  kategori: string;
  pesan: string;
  tingkat: Tingkat;
  para: number | null;
  kelompok: string | null;
  sumber: "bot" | "ai";
  diringkas: boolean;
  ditulis?: boolean; // benar-benar ditulis sebagai komentar di Word
  kode?: string | null; // kunci katalog komentar
  cuplikan: string | null;
}

export interface Ringkasan {
  masalah: number;
  kemunculan: number;
  di_word?: number;
  wajib: number;
  saran: number;
  ai: number;
  per_kategori: Record<string, number>;
}

export interface Statistik {
  kata_naskah: number;
  halaman: number | null;
  kata_abstrak: number | null;
  judul_bagian: string[];
  jumlah_referensi: number;
  jumlah_tabel: number;
  jumlah_gambar: number;
  gaya_sitasi_terdeteksi: string | null;
}

export interface Cek {
  id: string;
  jurnal_id: number | null;
  jurnal_nama: string;
  nama_file: string;
  pengguna_id: number | null;
  pengguna_nama: string;
  pakai_ai: boolean;
  status: "selesai" | "gagal";
  pesan_galat: string;
  file_tersedia: boolean;
  dibuat: string;
  ringkasan: Ringkasan | null;
  statistik?: Statistik;
  temuan?: Temuan[];
  galat_ai?: string | null;
  penulis_komentar?: string | null;
  scope?: HasilScope | null;
}

export interface JurnalRingkas {
  id: number;
  nama: string;
  deskripsi: string;
  template_nama: string;
  punya_template: boolean;
  diubah: string;
  bagian: string[];
  jumlah_naratif: number;
  punya_scope?: boolean;
}

export interface HasilScope {
  keputusan?: "terima" | "tolak";
  skor?: number | null;
  bidang_cocok?: string[];
  alasan?: string;
  model?: string;
  galat?: string;
  alasan_tidak_dinilai?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Profil = Record<string, any>;

export interface Peta {
  i: number;
  peran: string;
  label: string;
  level: number | null;
  teks: string;
  petunjuk: string[];
}

export interface HasilEkstrak {
  token?: string;
  template_nama?: string;
  profil: Profil;
  peta: Peta[];
  ai: { dipakai: boolean; galat: string | null; perubahan: string[] };
}

export interface Pengaturan {
  ai_base_url: string;
  ai_model: string;
  ai_api_key_samar: string;
  ai_api_key_terisi: boolean;
  retensi_jam: number;
}

export interface Status {
  versi: string;
  ai_aktif: boolean;
  ai_model: string;
}

export type FormatNama = "nama" | "nama_email" | "email";

export interface Pengguna {
  id: number;
  email: string;
  nama: string;
  foto: string;
  peran: "admin" | "pengguna";
  aktif: boolean;
  punya_sandi: boolean;
  terhubung_google: boolean;
  format_nama_komentar: FormatNama;
  nama_komentar: string;
  dibuat: string;
  terakhir_masuk: string | null;
}

export interface KonfigurasiAuth {
  google: boolean;
  daftar: boolean;
  domain: string[];
  redirect_uri: string;
}

export interface StatistikDasbor {
  total_cek: number;
  cek_minggu_ini: number;
  rata_masalah: number | null;
  jumlah_jurnal: number;
  siap_kirim: number;
}

/** Dipancarkan saat sesi habis (HTTP 401) agar aplikasi kembali ke halaman masuk. */
export interface VariabelKomentar {
  nama: string;
  arti: string;
  contoh: string;
}

export interface EntriKomentar {
  kode: string;
  grup: string;
  judul: string;
  bawaan: string;
  tingkat: Tingkat;
  variabel: VariabelKomentar[];
}

export interface KatalogKomentar {
  grup: string[];
  entri: EntriKomentar[];
  maks_panjang: number;
}

export const SESI_HABIS = "autojurnal:sesi-habis";

async function minta<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin", ...init });
  if (!r.ok) {
    if (r.status === 401 && !url.startsWith("/api/auth/")) window.dispatchEvent(new Event(SESI_HABIS));
    let pesan = `Gagal (HTTP ${r.status})`;
    try {
      const d = await r.json();
      if (d?.detail) pesan = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
    } catch {
      /* balasan bukan JSON */
    }
    throw new Error(pesan);
  }
  return r.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function form(isi: Record<string, string | Blob | boolean | number>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(isi)) f.append(k, v instanceof Blob ? v : String(v));
  return f;
}

export const api = {
  // akun
  konfigurasi: () => minta<KonfigurasiAuth>("/api/auth/konfigurasi"),
  saya: () => minta<Pengguna>("/api/auth/saya"),
  masuk: (email: string, sandi: string) => minta<Pengguna>("/api/auth/masuk", json("POST", { email, sandi })),
  daftar: (nama: string, email: string, sandi: string) => minta<Pengguna>("/api/auth/daftar", json("POST", { nama, email, sandi })),
  keluar: () => minta<{ ok: boolean }>("/api/auth/keluar", { method: "POST" }),
  ubahSaya: (data: { nama?: string; format_nama_komentar?: FormatNama }) => minta<Pengguna>("/api/auth/saya", json("PUT", data)),
  ubahSandi: (sandi_lama: string, sandi_baru: string) => minta<{ ok: boolean }>("/api/auth/sandi", json("PUT", { sandi_lama, sandi_baru })),
  daftarPengguna: () => minta<Pengguna[]>("/api/pengguna"),
  ubahPengguna: (id: number, data: { peran?: string; aktif?: boolean }) => minta<Pengguna>(`/api/pengguna/${id}`, json("PUT", data)),

  status: () => minta<Status>("/api/status"),
  statistik: () => minta<StatistikDasbor>("/api/statistik"),
  skema: () => minta<Profil>("/api/skema"),

  daftarJurnal: () => minta<JurnalRingkas[]>("/api/jurnal"),
  jurnal: (id: number) => minta<JurnalRingkas & { profil: Profil }>(`/api/jurnal/${id}`),
  ekstrak: (template: File, pakai_ai: boolean, panduan: string) =>
    minta<HasilEkstrak>("/api/jurnal/ekstrak", { method: "POST", body: form({ template, pakai_ai, panduan }) }),
  ekstrakUlang: (id: number, pakai_ai: boolean, panduan: string) =>
    minta<HasilEkstrak>(`/api/jurnal/${id}/ekstrak-ulang`, { method: "POST", body: form({ pakai_ai, panduan }) }),
  buatJurnal: (data: { nama: string; deskripsi: string; profil: Profil; token_template?: string; template_nama?: string }) =>
    minta<JurnalRingkas>("/api/jurnal", json("POST", data)),
  ubahJurnal: (id: number, data: { nama: string; deskripsi: string; profil: Profil }) =>
    minta<JurnalRingkas>(`/api/jurnal/${id}`, json("PUT", data)),
  hapusJurnal: (id: number) => minta<{ ok: boolean }>(`/api/jurnal/${id}`, { method: "DELETE" }),
  katalogKomentar: () => minta<KatalogKomentar>("/api/komentar/katalog"),
  komentarJurnal: (id: number) => minta<{ jurnal_id: number; teks: Record<string, string> }>(`/api/jurnal/${id}/komentar`),
  simpanKomentar: (id: number, teks: Record<string, string>) =>
    minta<{ jurnal_id: number; teks: Record<string, string> }>(`/api/jurnal/${id}/komentar`, json("PUT", { teks })),
  imporJurnal: (berkas: File) => minta<JurnalRingkas>("/api/jurnal/impor", { method: "POST", body: form({ berkas }) }),

  cek: (naskah: File, jurnal_id: number, pakai_ai: boolean) =>
    minta<Cek>("/api/cek", { method: "POST", body: form({ naskah, jurnal_id, pakai_ai }) }),
  riwayat: (semua = false) => minta<Cek[]>(`/api/cek${semua ? "?semua=true" : ""}`),
  detailCek: (id: string) => minta<Cek>(`/api/cek/${id}`),
  hapusCek: (id: string) => minta<{ ok: boolean }>(`/api/cek/${id}`, { method: "DELETE" }),
  urlUnduh: (id: string) => `/api/cek/${id}/unduh`,
  urlZip: (ids: string[]) => `/api/unduh-zip?${ids.map((i) => `id=${i}`).join("&")}`,

  pengaturan: () => minta<Pengaturan>("/api/pengaturan"),
  simpanPengaturan: (data: Partial<Pengaturan> & { ai_api_key?: string; hapus_api_key?: boolean }) =>
    minta<Pengaturan>("/api/pengaturan", json("PUT", data)),
  tesAI: (data: { ai_base_url?: string; ai_api_key?: string; ai_model?: string }) =>
    minta<{ ok: boolean; pesan: string }>("/api/pengaturan/tes-ai", json("POST", data)),
  modelAI: (data: { ai_base_url?: string; ai_api_key?: string }) =>
    minta<{ ok: boolean; model: string[]; pesan?: string }>("/api/pengaturan/model-ai", json("POST", data)),
};

export function tanggal(iso: string | null | undefined): string {
  if (!iso) return "tanpa tanggal";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function relatif(iso: string | null | undefined): string {
  if (!iso) return "belum pernah";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "baru saja";
  if (d < 3600) return `${Math.floor(d / 60)} menit lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} hari lalu`;
  return tanggal(iso);
}
