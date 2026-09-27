#!/usr/bin/env bash
# Pasang AutoJurnal di VPS yang SUDAH berisi proyek lain (Ubuntu/Debian + Nginx).
# Aman untuk server bersama: tidak menghapus site Nginx lain, tidak membuat swap, port bisa dipilih.
#
# Pakai:
#   sudo bash deploy/pasang-vps.sh <domain> [url-git] [port]
#   sudo bash deploy/pasang-vps.sh autojurnal.redscale.my.id https://github.com/USER/autojurnal.git 8010
set -euo pipefail
DOMAIN="${1:?domain wajib, mis. autojurnal.redscale.my.id}"
REPO="${2:-}"
PORT="${3:-8010}"
APP=/opt/autojurnal
DATA=/var/lib/autojurnal

# ---- 0. pemeriksaan awal ----------------------------------------------------------
if ss -ltn "( sport = :$PORT )" | grep -q LISTEN; then
  echo "!! Port $PORT sudah dipakai proses lain. Jalankan ulang dengan port lain, mis.: ... $DOMAIN \"$REPO\" 8011"; exit 1
fi
command -v nginx >/dev/null || { echo "!! Nginx tidak ditemukan. Skrip ini untuk server dengan Nginx."; exit 1; }
PY=$(command -v python3.12 || command -v python3.11 || command -v python3)
"$PY" -c 'import sys; assert sys.version_info >= (3, 10)' || { echo "!! Butuh Python 3.10+ (terdeteksi: $($PY -V))"; exit 1; }

# paket yang belum ada saja
PERLU=()
"$PY" -m venv --help >/dev/null 2>&1 || PERLU+=("python3-venv")
command -v certbot >/dev/null || PERLU+=("certbot" "python3-certbot-nginx")
command -v git >/dev/null || PERLU+=("git")
if [ ${#PERLU[@]} -gt 0 ]; then apt-get update && apt-get install -y "${PERLU[@]}"; fi

# ---- 1. kode & pengguna layanan ------------------------------------------------------
id autojurnal >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin autojurnal
mkdir -p "$DATA"
if [ ! -d "$APP" ]; then
  [ -n "$REPO" ] || { echo "!! $APP belum ada. Beri url git, atau salin kodenya ke $APP dulu."; exit 1; }
  git clone "$REPO" "$APP"
fi
chown -R autojurnal:autojurnal "$APP" "$DATA"

# ---- 2. Python ---------------------------------------------------------------------
sudo -u autojurnal "$PY" -m venv "$APP/backend/.venv"
sudo -u autojurnal "$APP/backend/.venv/bin/pip" install -q --upgrade pip
sudo -u autojurnal "$APP/backend/.venv/bin/pip" install -q -r "$APP/backend/requirements.txt"

# ---- 3. .env -----------------------------------------------------------------------
if [ ! -f "$APP/.env" ]; then
  KUNCI=$("$PY" -c 'import secrets;print(secrets.token_urlsafe(48))')
  sed -e "s#^AUTOJURNAL_BASE_URL=.*#AUTOJURNAL_BASE_URL=https://$DOMAIN#" \
      -e "s#^AUTOJURNAL_SECRET_KEY=.*#AUTOJURNAL_SECRET_KEY=$KUNCI#" \
      "$APP/.env.example" > "$APP/.env"
  chown autojurnal:autojurnal "$APP/.env" && chmod 600 "$APP/.env"
fi

# ---- 4. systemd --------------------------------------------------------------------
sed "s/--port 8010/--port $PORT/" "$APP/deploy/autojurnal.service" > /etc/systemd/system/autojurnal.service
systemctl daemon-reload
systemctl enable --now autojurnal
sleep 2
curl -fsS "http://127.0.0.1:$PORT/api/auth/konfigurasi" >/dev/null && echo ">> backend jalan di port $PORT" \
  || { echo "!! backend belum merespons — cek: journalctl -u autojurnal -n 50"; }

# ---- 5. Nginx (hanya menambah site baru) --------------------------------------------
if [ -d /etc/nginx/sites-available ]; then
  CONF=/etc/nginx/sites-available/autojurnal
  LINK=/etc/nginx/sites-enabled/autojurnal
else
  CONF=/etc/nginx/conf.d/autojurnal.conf
  LINK=""
fi
sed -e "s/autojurnal.redscale.my.id/$DOMAIN/" -e "s/127.0.0.1:8010/127.0.0.1:$PORT/" "$APP/deploy/nginx-autojurnal.conf" > "$CONF"
[ -n "$LINK" ] && ln -sf "$CONF" "$LINK"
if ! nginx -t; then
  echo "!! Konfigurasi Nginx gagal diuji — site autojurnal dibatalkan, site lain tidak diubah."
  rm -f "$CONF" ${LINK:+"$LINK"}; exit 1
fi
systemctl reload nginx

# ---- 6. HTTPS (hanya untuk domain ini) -----------------------------------------------
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
  || echo "!! certbot gagal (DNS belum mengarah ke VPS?). Ulangi nanti: sudo certbot --nginx -d $DOMAIN"

echo
echo "Selesai. Lengkapi $APP/.env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTOJURNAL_ADMIN_EMAILS),"
echo "lalu: sudo systemctl restart autojurnal   →   buka https://$DOMAIN"
