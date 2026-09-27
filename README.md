# AutoJurnal — Cek Naskah Artikel Otomatis

Unggah **template jurnal** (.docx), lalu sistem membaca aturannya. Setelah itu unggah **naskah** (.docx), dan sistem
mengembalikan **salinan naskah berisi komentar Word** di setiap bagian yang tidak sesuai template, beserta ringkasannya.

- **Aturan dinamis, tidak di-hardcode.** Setiap jurnal punya *profil aturan* yang dibaca dari template-nya dan bisa disunting di web.
- **Bot + AI.** Semua yang bisa diukur (format, struktur, jumlah kata, referensi) dicek bot secara pasti dan gratis.
  AI (OpenAI-compatible: 9router, OpenRouter, Ollama, dll.) bersifat opsional dan dipakai untuk dua hal:
  1. membaca ketentuan yang ditulis sebagai kalimat di template;
  2. menilai *aturan naratif* (substansi), mis. "pendahuluan memuat research gap".
- **Akun asli + Masuk dengan Google.** Komentar di Word ditulis **atas nama akun yang login** (nama Google asli),
  dengan format nama bisa dipilih: nama, nama + email, atau email.
- **Naskah tidak disimpan.** Berkas unggahan langsung dihapus setelah diperiksa. Salinan berkomentar dihapus otomatis setelah masa simpan (bawaan 24 jam).

## Yang dicek

| Kategori | Contoh |
|---|---|
| Tata letak | ukuran kertas, orientasi, margin, jumlah kolom (bagian depan & isi) |
| Format per elemen | font, ukuran, tebal/miring, kapital, perataan, spasi, indentasi, jarak paragraf. Dicek untuk judul, penulis, abstrak, kata kunci, heading, teks isi, tabel, gambar, dan daftar pustaka |
| Struktur | bagian wajib ada & urut, nama bagian sesuai template, subbagian wajib, penomoran heading |
| Judul / abstrak / kata kunci | jumlah kata, judul & abstract bahasa Inggris, satu paragraf, jumlah & pemisah kata kunci, huruf kecil |
| Paragraf | minimal/maksimal kalimat per paragraf |
| Tabel & gambar | judul ada, penomoran berurutan, posisi judul (atas/bawah), dirujuk di teks |
| Referensi | jumlah minimal, % referensi mutakhir, urut abjad/kemunculan, sitasi ↔ daftar pustaka (nama-tahun & numerik [1]) |
| Naskah | jumlah kata/halaman, kata terlarang, sisa petunjuk template yang lupa dihapus |
| Naratif (AI, opsional) | aturan isi dari template, mis. kelengkapan metode, research gap, kesimpulan menjawab tujuan |

Temuan **WAJIB** berarti tidak sesuai aturan template. Temuan **SARAN** berarti hasil heuristik yang perlu dicek manusia.
Masalah yang sama tidak membanjiri naskah: maksimal N komentar per masalah (bisa diatur), sisanya diringkas.

## Akun, peran & login Google

| Peran | Bisa |
|---|---|
| **Admin** | semua yang bisa dilakukan pengguna, ditambah mengelola profil jurnal, pengaturan AI, dan pengguna (naik/turun peran, nonaktifkan) |
| **Pengguna** | cek naskah, melihat riwayat miliknya sendiri, melihat aturan jurnal, mengatur nama di komentar |

- Akun **pertama** yang dibuat otomatis menjadi admin, kecuali Anda mengisi `AUTOJURNAL_ADMIN_EMAILS`.
- Masuk dengan **email + sandi** (sandi di-hash scrypt, percobaan salah dibatasi) atau **Google OAuth 2.0** (authorization code + PKCE).
- Semua konfigurasi ada di **`.env`** di folder utama (contoh lengkap: `.env.example`). Ubah lalu restart aplikasi.

### Mengaktifkan “Masuk dengan Google”

1. Buka https://console.cloud.google.com/ lalu buat atau pilih project.
2. **APIs & Services → OAuth consent screen**: pilih *External*, isi nama aplikasi dan email. Selama status *Testing*, tambahkan email penguji.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, jenis *Web application*.
   *Authorized redirect URIs* (salin juga dari halaman **Pengaturan** di aplikasi):
   - `http://127.0.0.1:8000/api/auth/google/callback` (laptop)
   - `https://domain-anda/api/auth/google/callback` (VPS)
4. Isi `.env`:
   ```ini
   AUTOJURNAL_BASE_URL=http://127.0.0.1:8000      # atau https://domain-anda
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   AUTOJURNAL_ADMIN_EMAILS=email.anda@gmail.com
   ```
5. Restart aplikasi. Tombol *Masuk dengan Google* otomatis aktif.

Opsi lain di `.env`: `AUTOJURNAL_IZINKAN_DAFTAR=false` (hanya admin yang menambah akun), `AUTOJURNAL_DOMAIN_EMAIL=unusa.ac.id`
(batasi domain email), `AUTOJURNAL_SECRET_KEY` (kunci cookie sesi; kosong = dibuat otomatis).

## Struktur proyek

```
backend/
  app/engine/   mesin bot: docmodel (format efektif), klasifikasi (peran paragraf), ekstrak (template→profil),
                periksa + referensi (cek), anotasi (komentar Word), profil (skema aturan)
  app/ai/       klien OpenAI-compatible, AI pembaca template, AI pengecek aturan naratif
  app/auth.py   akun, sesi, Google OAuth, manajemen pengguna
  app/main.py   API FastAPI + penyaji frontend
  app/cli.py    cek banyak naskah dari terminal
  tests/        pytest dengan dokumen sintetis
frontend/       React + Vite + Tailwind v4 (mode terang/gelap; form aturan dibangkitkan dari skema profil)
deploy/         systemd, nginx, skrip pasang & perbarui VPS
jalankan.bat    jalankan di Windows dengan dobel-klik
```

## Menjalankan di laptop (Windows)

Syarat: Python 3.11+ dan Node.js 20+. Dobel-klik **`jalankan.bat`**. Browser akan terbuka di http://127.0.0.1:8000.

Mode pengembangan (hot reload):

```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload        # API di :8000
cd frontend && npm run dev                                                 # UI di :5173 (proxy /api ke :8000)
```

Tes: `cd backend && .venv/Scripts/python -m pytest -q`

## Alur pakai

0. **Daftar / Masuk**. Akun pertama menjadi admin.
1. **Pengaturan** (admin) → isi AI (opsional). Untuk 9router biasanya `http://localhost:20128/v1` plus API key dan model. Klik *Tes koneksi*.
2. **Profil Jurnal → Tambah dari template** → unggah template .docx → *Baca template* (opsional: centang AI dan tempel *Author Guidelines*).
3. **Tinjau** catatan pembacaan (konflik/asumsi ditandai) dan sunting aturan, lalu **Simpan**.
4. **Cek Naskah** → pilih jurnal → seret satu atau banyak naskah → *Cek* → unduh `.docx` berkomentar (atau .zip).

Profil bisa **diekspor/diimpor (.json)** untuk dibagikan antarpengelola jurnal.

### CLI (tanpa web)

```bash
cd backend
.venv/Scripts/python -m app.cli ekstrak "Template.docx" -o sibc.json
.venv/Scripts/python -m app.cli cek "D:/naskah/queue" --profil sibc.json -o "D:/naskah/hasil"
.venv/Scripts/python -m app.cli cek naskah.docx --jurnal "Jurnal SIBC"     # pakai profil dari database web
```

## Deploy ke VPS (native, tanpa Docker — aman untuk VPS yang sudah berisi proyek lain)

Kebutuhan: Ubuntu/Debian dengan **Nginx** dan **Python 3.10+**, subdomain yang A-record-nya mengarah ke VPS.

```bash
# laptop (Git Bash): kemas kode + tampilan web yang sudah di-build, lalu kirim
cd frontend && npm run build && cd ../..
tar -czf autojurnal.tar.gz --exclude=autojurnal/backend/.venv --exclude=autojurnal/frontend/node_modules     --exclude=autojurnal/data --exclude=autojurnal/.env --exclude=autojurnal/.git autojurnal
scp autojurnal.tar.gz USER@IP_VPS:/tmp/

# VPS
sudo tar -xzf /tmp/autojurnal.tar.gz -C /opt
sudo bash /opt/autojurnal/deploy/pasang-vps.sh autojurnal.redscale.my.id "" 8010
sudo nano /opt/autojurnal/.env        # isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTOJURNAL_ADMIN_EMAILS
sudo systemctl restart autojurnal
```

`pasang-vps.sh` hanya **menambah**: user sistem `autojurnal`, `/opt/autojurnal`, `/var/lib/autojurnal`, layanan systemd
`autojurnal` di port internal pilihan (bawaan 8010, dicek dulu tidak bentrok), satu site Nginx baru, dan sertifikat HTTPS untuk
domain itu saja. Site Nginx lain tidak disentuh; bila `nginx -t` gagal, site baru dibatalkan otomatis.

Susunan: Nginx (HTTPS/certbot) → Uvicorn 2 worker (systemd `autojurnal`) → SQLite di `/var/lib/autojurnal`.
Log: `journalctl -u autojurnal -f`. Update: kirim ulang tar lalu ekstrak (`.env` & data tidak tertimpa) + `systemctl restart autojurnal`,
atau bila memakai git: `sudo bash /opt/autojurnal/deploy/perbarui.sh`.

## Catatan & batasan

- Format `.doc` (Word 97–2003) belum didukung. Simpan ulang sebagai `.docx`.
- Jumlah halaman diambil dari metadata Word (perkiraan). Word memperbaruinya saat berkas disimpan.
- Hasil pembacaan template **wajib ditinjau manusia** sekali per jurnal. Template di lapangan sering berisi contoh yang
  bertentangan dengan teks petunjuknya sendiri, dan konflik semacam itu ditandai di *Catatan pembacaan template*.
- Belum ada verifikasi email untuk pendaftaran email+sandi. Untuk dipakai publik, sebaiknya set `AUTOJURNAL_IZINKAN_DAFTAR=false`
  atau batasi `AUTOJURNAL_DOMAIN_EMAIL`, dan andalkan login Google (email Google sudah terverifikasi).
