#!/usr/bin/env bash
# Полный фикс Z-TECH на VPS (Docker :8081 + nginx vhost + certbot).
# ТВК на другом IP — на этом сервере только Z-TECH.
# Запуск на VPS: sudo bash scripts/fix-z-tech-server.sh
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO"

echo "=== 1. Docker Z-TECH (:8081) ==="
if [[ ! -f telegram.local.json ]]; then
  echo "❌ Нет telegram.local.json — скопируйте с Mac: scp telegram.local.json root@VPS:~/z-tech-portfolio/z-tech-portfolio/"
  exit 1
fi
chmod 600 telegram.local.json 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
sleep 4
if ! curl -fsS --max-time 5 http://127.0.0.1:8081/ | grep -qi "Z-TECH"; then
  echo "❌ Docker на :8081 не отдаёт Z-TECH. Логи:"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=40 web api
  exit 1
fi
echo "✓ http://127.0.0.1:8081/ — Z-TECH OK"

echo ""
echo "=== 2. Nginx (только z-tech.pro, без ТВК) ==="
export Z_TECH_ONLY=1
export REPO
bash "${REPO}/scripts/apply-nginx-split-vps.sh"

echo ""
echo "=== 3. Проверка с сервера ==="
curl -sSI --max-time 5 -H 'Host: z-tech.pro' http://127.0.0.1/ | head -5 || true
if [[ -d /etc/letsencrypt/live/z-tech.pro ]]; then
  echo | openssl s_client -connect 127.0.0.1:443 -servername z-tech.pro 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null || true
fi

echo ""
echo "Готово. Откройте https://z-tech.pro (после certbot — без ошибки SSL)."
