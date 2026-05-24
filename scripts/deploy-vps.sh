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

# Порт 80 часто занят другим nginx на VPS — по умолчанию публикуем 8081
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
if [[ "${USE_VPS_PORT:-0}" == "1" ]]; then
  COMPOSE_FILES+=(-f docker-compose.vps.yml)
fi

if [[ ! -f telegram.local.json ]]; then
  echo "❌ Нет telegram.local.json"
  echo "   cp telegram.config.example.json telegram.local.json && nano telegram.local.json"
  exit 1
fi

chmod 600 telegram.local.json 2>/dev/null || true

WEB_PORT="8081"
[[ "${USE_VPS_PORT:-0}" == "1" ]] && WEB_PORT="80"
echo "→ Сборка и запуск (web :${WEB_PORT}, домен z-tech.pro)..."
docker compose "${COMPOSE_FILES[@]}" up -d --build

echo ""
echo "→ Проверка..."
sleep 5
if [[ "${USE_VPS_PORT:-0}" == "1" ]]; then
  curl -fsS http://127.0.0.1/ | grep -qi "Z-TECH" && echo "✓ http://127.0.0.1/"
else
  curl -fsS http://127.0.0.1:8081/ | grep -qi "Z-TECH" && echo "✓ http://127.0.0.1:8081/"
  echo "  Прокси с 80/443: см. deploy/nginx-z-tech.pro.conf → site_prod-nginx-1"
fi
docker compose "${COMPOSE_FILES[@]}" ps

if [[ -d /root/site_prod/nginx ]]; then
  echo ""
  echo "→ Nginx: раздельный vhost z-tech.pro (ТВК на другом IP — Z_TECH_ONLY)..."
  Z_TECH_ONLY=1 bash scripts/apply-nginx-split-vps.sh || {
    echo "⚠ Nginx не обновлён. На VPS вручную: sudo bash scripts/fix-z-tech-server.sh"
  }
fi

echo ""
echo "Готово на сервере."
echo "  DNS: z-tech.pro → IP ЭТОГО VPS (не IP tvkplastic.ru)"
echo "  Если сайт ломается: sudo bash scripts/fix-z-tech-server.sh"
echo "  Логи: docker compose ${COMPOSE_FILES[*]} logs -f web api"
