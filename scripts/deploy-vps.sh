#!/usr/bin/env bash
# Запуск на VPS после git clone и настройки telegram.local.json
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
USE_VPS_PORT="${USE_VPS_PORT:-1}"

if [[ "$USE_VPS_PORT" == "1" ]]; then
  COMPOSE_FILES+=(-f docker-compose.vps.yml)
fi

if [[ ! -f telegram.local.json ]]; then
  echo "❌ Нет telegram.local.json"
  echo "   cp telegram.config.example.json telegram.local.json && nano telegram.local.json"
  exit 1
fi

chmod 600 telegram.local.json 2>/dev/null || true

echo "→ Сборка и запуск (порт web: ${USE_VPS_PORT:+80}${USE_VPS_PORT:-8081})..."
docker compose "${COMPOSE_FILES[@]}" up -d --build

echo ""
echo "→ Проверка..."
sleep 4
if [[ "$USE_VPS_PORT" == "1" ]]; then
  curl -fsS http://127.0.0.1/ | grep -qi "Z-TECH" && echo "✓ http://127.0.0.1/"
else
  curl -fsS http://127.0.0.1:8081/ | grep -qi "Z-TECH" && echo "✓ http://127.0.0.1:8081/"
fi
curl -fsS http://127.0.0.1:8081/health 2>/dev/null | grep -q '"ok"' && echo "✓ API health" || true

echo ""
echo "Готово. Дальше: DNS домена → IP сервера, HTTPS (см. docs/DEPLOY.md)"
