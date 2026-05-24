#!/usr/bin/env bash
# Полный фикс Z-TECH на VPS (Docker :8081 + nginx vhost + certbot).
# Запуск на VPS: sudo bash scripts/fix-z-tech-server.sh
# Только nginx (Docker уже OK): SKIP_DOCKER=1 sudo bash scripts/fix-z-tech-server.sh
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO"
# shellcheck source=scripts/lib/curl-check.sh
source "${REPO}/scripts/lib/curl-check.sh"

if [[ "${SKIP_DOCKER:-0}" != "1" ]]; then
  echo "=== 1. Docker Z-TECH (:8081) ==="
  if [[ ! -f telegram.local.json ]]; then
    echo "❌ Нет telegram.local.json"
    exit 1
  fi
  chmod 600 telegram.local.json 2>/dev/null || true
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
  sleep 4
  if ! curl_body_has_ztech "http://127.0.0.1:8081/"; then
    echo "❌ Docker на :8081 не отдаёт Z-TECH. Логи:"
    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=40 web api
    exit 1
  fi
  echo "✓ http://127.0.0.1:8081/ — Z-TECH OK"
else
  echo "=== 1. Docker — пропуск (SKIP_DOCKER=1) ==="
  if curl_body_has_ztech "http://127.0.0.1:8081/"; then
    echo "✓ :8081 — Z-TECH OK"
  else
    echo "⚠ :8081 не отвечает — проверьте: docker compose ... ps"
  fi
fi

echo ""
echo "=== 2. Nginx (z-tech.pro → :8081) ==="
export Z_TECH_ONLY=1
export REPO
bash "${REPO}/scripts/apply-nginx-split-vps.sh"

echo ""
echo "=== 3. Проверка ==="
LOC="$(curl -sSI --max-time 5 http://z-tech.pro/ 2>/dev/null | grep -i '^location:' | head -1 || true)"
echo "http://z-tech.pro → ${LOC:-(нет редиректа, OK)}"
if echo "$LOC" | grep -qi 'xn--80adtgcd1asdg'; then
  echo "❌ Всё ещё редирект на чужой .рф — пришлите: docker exec site_prod-nginx-1 nginx -T | grep -E 'server_name|location'"
  exit 1
fi
curl -sSI --max-time 5 -H 'Host: z-tech.pro' http://127.0.0.1/ | head -5 || true

echo ""
echo "Готово. Откройте https://z-tech.pro"
