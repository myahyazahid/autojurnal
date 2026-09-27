#!/usr/bin/env bash
# Update AutoJurnal di VPS:  sudo bash /opt/autojurnal/deploy/perbarui.sh
set -euo pipefail
cd /opt/autojurnal
sudo -u autojurnal git pull --ff-only
sudo -u autojurnal backend/.venv/bin/pip install -q -r backend/requirements.txt
if command -v npm >/dev/null 2>&1; then
  (cd frontend && sudo -u autojurnal npm ci --no-audit --no-fund && sudo -u autojurnal npm run build)
else
  echo ">> npm tidak ada di VPS: build frontend di laptop lalu kirim folder frontend/dist."
fi
systemctl restart autojurnal
sleep 2
systemctl --no-pager --lines=5 status autojurnal
