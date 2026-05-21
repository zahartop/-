#!/usr/bin/env bash
# Только VPS/Linux: продакшен через Docker (web:80 + api).
# На Mac не запускайте — там ./scripts/start-dev.sh или docker compose up (порт 8081).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker не запущен или нет прав."
  echo "   На VPS: systemctl start docker  (или apt install docker.io)"
  echo "   На Mac этот скрипт не нужен — используйте start-dev.sh"
  exit 1
fi

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml)

if [[ ! -f telegram.local.json ]]; then
  echo "❌ Нет telegram.local.json"
  echo "   cp telegram.config.example.json telegram.local.json && nano telegram.local.json"
  exit 1
fi

chmod 600 telegram.local.json 2>/dev/null || true

echo "→ Сборка и запуск (web :80, домен z-tech.pro)..."
docker compose "${COMPOSE_FILES[@]}" up -d --build

echo ""
echo "→ Проверка..."
sleep 5
curl -fsS http://127.0.0.1/ | grep -qi "Z-TECH" && echo "✓ http://127.0.0.1/"
docker compose "${COMPOSE_FILES[@]}" ps

echo ""
echo "Готово на сервере."
echo "  DNS: A @ и www → IP этого VPS"
echo "  Сайт: https://z-tech.pro (после Cloudflare / HTTPS)"
echo "  Логи: docker compose ${COMPOSE_FILES[*]} logs -f web api"
