#!/usr/bin/env bash
# Pemasangan pertama di VPS Ubuntu 22.04/24.04 (native, tanpa Docker).
# Pakai:  sudo bash deploy/pasang-vps.sh autojurnal.contoh.ac.id  https://github.com/USER/autojurnal.git
set -euo pipefail
DOMAIN="${1:?domain wajib, mis. autojurnal.contoh.ac.id}"
REPO="${2:?url git repo wajib}"

apt-get update
apt-get install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx git curl

# swap 2 GB untuk VPS RAM 1 GB
if [ ! -f /swapfile ] && [ "$(free -m | awk '/Mem:/{print $2}')" -lt 1800 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

id autojurnal >/dev/null 2>&1 || useradd --system --home /opt/autojurnal --shell /usr/sbin/nologin autojurnal
mkdir -p /var/lib/autojurnal
[ -d /opt/autojurnal/.git ] || git clone "$REPO" /opt/autojurnal
chown -R autojurnal:autojurnal /opt/autojurnal /var/lib/autojurnal

sudo -u autojurnal python3 -m venv /opt/autojurnal/backend/.venv
sudo -u autojurnal /opt/autojurnal/backend/.venv/bin/pip install -r /opt/autojurnal/backend/requirements.txt

if [ ! -f /opt/autojurnal/frontend/dist/index.html ]; then
  echo ">> frontend/dist belum ada. Build di laptop (npm run build) lalu unggah folder dist,"
  echo ">> atau pasang Node.js 20+ di VPS lalu jalankan deploy/perbarui.sh"
fi

# konfigurasi (.env): isi GOOGLE_CLIENT_ID/SECRET & AUTOJURNAL_ADMIN_EMAILS setelah ini
if [ ! -f /opt/autojurnal/.env ]; then
  sed -e "s#^AUTOJURNAL_BASE_URL=.*#AUTOJURNAL_BASE_URL=https://$DOMAIN#"       -e "s#^AUTOJURNAL_SECRET_KEY=.*#AUTOJURNAL_SECRET_KEY=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')#"       /opt/autojurnal/.env.example > /opt/autojurnal/.env
  chown autojurnal:autojurnal /opt/autojurnal/.env && chmod 600 /opt/autojurnal/.env
fi

cp /opt/autojurnal/deploy/autojurnal.service /etc/systemd/system/
sed "s/autojurnal.contoh.ac.id/$DOMAIN/" /opt/autojurnal/deploy/nginx-autojurnal.conf > /etc/nginx/sites-available/autojurnal
ln -sf /etc/nginx/sites-available/autojurnal /etc/nginx/sites-enabled/autojurnal
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl daemon-reload && systemctl enable --now autojurnal
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
  echo ">> certbot gagal (DNS belum mengarah?). Jalankan ulang: certbot --nginx -d $DOMAIN"
echo "Selesai. Buka https://$DOMAIN"
echo "Lengkapi /opt/autojurnal/.env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTOJURNAL_ADMIN_EMAILS) lalu: systemctl restart autojurnal"
