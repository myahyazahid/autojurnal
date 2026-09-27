@echo off
setlocal
title AutoJurnal
cd /d "%~dp0"

rem ---- backend: virtualenv + dependensi (sekali saja) ----
if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/3] Menyiapkan Python virtualenv...
  python -m venv backend\.venv || goto :galat
  backend\.venv\Scripts\python -m pip install --upgrade pip >nul
  backend\.venv\Scripts\python -m pip install -r backend\requirements.txt || goto :galat
)

rem ---- frontend: build bila belum ada ----
if not exist "frontend\dist\index.html" (
  echo [2/3] Membangun tampilan web ^(butuh Node.js^)...
  pushd frontend
  call npm install || goto :galat
  call npm run build || goto :galat
  popd
)

echo [3/3] AutoJurnal berjalan di http://127.0.0.1:8000  (tutup jendela ini untuk berhenti)
start "" http://127.0.0.1:8000
cd backend
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
goto :eof

:galat
echo.
echo Terjadi kesalahan. Pastikan Python 3.11+ dan Node.js 20+ terpasang.
pause
