#!/usr/bin/env bash
# Z-TECH на VPS: Docker :8081 + nginx z-tech.pro + certbot.
# sudo bash scripts/fix-z-tech-server.sh
# Только nginx: SKIP_DOCKER=1 sudo bash scripts/fix-z-tech-server.sh
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO"

if [[ -f "${REPO}/scripts/lib/curl-check.sh" ]]; then
  # shellcheck source=scripts/lib/curl-check.sh
  source "${REPO}/scripts/lib/curl-check.sh"
else
  echo "⚠ Сначала: git pull  (нет scripts/lib/curl-check.sh)"
fi

echo "→ Репозиторий: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

if [[ "${SKIP_DOCKER:-0}" != "1" ]]; then
  echo ""
  echo "=== 1. Docker (:8081) ==="
  [[ -f telegram.local.json ]] || { echo "❌ Нет telegram.local.json"; exit 1; }
  chmod 600 telegram.local.json 2>/dev/null || true
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
fi

echo ""
if declare -F curl_body_has_ztech >/dev/null 2>&1 && curl_body_has_ztech "http://127.0.0.1:8081/"; then
  echo "✓ :8081 — Z-TECH отвечает"
else
  echo "⚠ Проверка :8081 не прошла автоматически (часто ложно)."
  echo "  Вручную: curl -s http://127.0.0.1:8081/ | grep -i Z-TECH | head -1"
  echo "  Продолжаем — главное исправить nginx для z-tech.pro"
fi

echo ""
echo "=== 2. Nginx z-tech.pro (обязательно) ==="
export Z_TECH_ONLY=1 REPO
bash "${REPO}/scripts/apply-nginx-split-vps.sh"

echo ""
echo "=== 3. Проверка домена ==="
LOC="$(curl -sSI --max-time 8 http://z-tech.pro/ 2>/dev/null | grep -i '^location:' | head -1 || true)"
echo "${LOC:-HTTP без Location (OK)}"
if echo "$LOC" | grep -qi '80adtgcd1asdg'; then
  echo ""
  echo "❌ Редирект на чужой .рф остался. Диагностика:"
  echo "  docker exec site_prod-nginx-1 nginx -T 2>/dev/null | grep -E 'server_name|80adtgcd|z-tech|default_server'"
  echo "  grep -r '80adtgcd' /root/site_prod/nginx/ || true"
  exit 1
fi

echo ""
echo "✓ Готово: https://z-tech.pro"
