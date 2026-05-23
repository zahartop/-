#!/usr/bin/env bash
# Локальный запуск без Docker: статика + API формы на :8081
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f telegram.local.json ]]; then
  echo "⚠ Нет telegram.local.json — форма вернёт ошибку, пока не настроите бота."
fi

export PORT="${PORT:-8081}"
export DEBUG_ERRORS=1
export ALLOWED_ORIGINS="http://localhost:${PORT},http://127.0.0.1:${PORT}"

if lsof -ti ":${PORT}" >/dev/null 2>&1; then
  echo "⚠ Порт ${PORT} занят (старый dev_server или Docker)."
  echo "  Остановить: kill \$(lsof -ti :${PORT})"
  echo "  Или Docker: docker compose down"
  echo "  Или другой порт: PORT=8082 ./scripts/start-dev.sh"
  exit 1
fi

echo "Z-TECH → http://localhost:${PORT}"
echo "Остановка: Ctrl+C в этом терминале"
exec python3 scripts/dev_server.py
