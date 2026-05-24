#!/usr/bin/env bash
# Быстрая проверка: z-tech.pro не отдаёт чужой сертификат и не редиректит на ТВК.
# Запуск на VPS: bash scripts/check-nginx-domains.sh
# С Mac: bash scripts/check-nginx-domains.sh z-tech.pro

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/curl-check.sh
source "${SCRIPT_DIR}/lib/curl-check.sh"

Z_HOST="${1:-z-tech.pro}"
TVK_HOST="${2:-твкпластик.рф}"

echo "=== Порты 80/443 ==="
ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' || netstat -tlnp 2>/dev/null | grep -E ':80|:443' || true

echo ""
echo "=== Z-TECH backend :8081 ==="
if curl_body_has_ztech "http://127.0.0.1:8081/" 5; then
  echo "OK: 127.0.0.1:8081 отдаёт Z-TECH"
else
  echo "FAIL: 127.0.0.1:8081 не отвечает или нет Z-TECH в HTML"
fi

echo ""
echo "=== Сертификат для SNI ${Z_HOST} ==="
echo | openssl s_client -connect "${Z_HOST}:443" -servername "${Z_HOST}" 2>/dev/null \
  | openssl x509 -noout -subject -issuer 2>/dev/null || echo "Не удалось получить сертификат (порт/DNS?)"

echo ""
echo "=== HTTPS ${Z_HOST} (первые строки) ==="
curl -sSI --max-time 10 "https://${Z_HOST}/" | head -8 || true

echo ""
echo "=== Тело ${Z_HOST} (маркер) ==="
BODY=$(curl -fsS --max-time 10 "https://${Z_HOST}/" 2>/dev/null | head -c 4000 || true)
if echo "$BODY" | grep -qi "Z-TECH"; then
  echo "OK: в ответе есть Z-TECH"
elif echo "$BODY" | grep -qi "ТВК\|ИЗОКОМ\|tvkplastic"; then
  echo "FAIL: ответ похож на ТВК ПЛАСТИК — nginx ведёт не на :8081 или неверный server {}"
else
  echo "WARN: не найден маркер Z-TECH (проверьте вручную)"
fi

echo ""
echo "=== Сертификат для SNI ${TVK_HOST} (для сравнения) ==="
echo | openssl s_client -connect "${TVK_HOST}:443" -servername "${TVK_HOST}" 2>/dev/null \
  | openssl x509 -noout -subject 2>/dev/null || true

echo ""
echo "=== Docker nginx (если есть site_prod-nginx-1) ==="
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q nginx; then
  NGINX=$(docker ps --format '{{.Names}}' | grep nginx | head -1)
  echo "Контейнер: $NGINX"
  docker exec "$NGINX" nginx -T 2>/dev/null | grep -E 'server_name|ssl_certificate |proxy_pass' | grep -v '#' | head -40 || true
else
  echo "Docker nginx не найден — смотрите /etc/nginx на хосте"
fi

echo ""
echo "Готово."
