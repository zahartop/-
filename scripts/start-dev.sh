#!/usr/bin/env bash
# Локальный запуск без Docker: статика + API формы на :8081
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f telegram.local.json ]]; then
  echo "⚠ Нет telegram.local.json — форма вернёт ошибку, пока не настроите бота."
fi

export PORT=8081
export DEBUG_ERRORS=1
export ALLOWED_ORIGINS="http://localhost:8081,http://127.0.0.1:8081"

echo "Z-TECH → http://localhost:8081"
echo "Остановка: Ctrl+C"
exec python3 scripts/dev_server.py
