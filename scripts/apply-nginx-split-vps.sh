#!/usr/bin/env bash
# Nginx vhost для z-tech.pro (и опционально ТВК, если на том же VPS).
# Запуск: sudo Z_TECH_ONLY=1 bash scripts/apply-nginx-split-vps.sh
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
SITE_PROD="${SITE_PROD:-/root/site_prod}"
NGINX_CONF="${SITE_PROD}/nginx/nginx.conf"
VHOSTS_DIR="${SITE_PROD}/nginx/vhosts"
NGINX_CONTAINER="${NGINX_CONTAINER:-}"
Z_TECH_ONLY="${Z_TECH_ONLY:-0}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-skskxnddndnx@inbox.ru}"

if [[ -z "$NGINX_CONTAINER" ]]; then
  NGINX_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'site_prod.*nginx|nginx.*site_prod' | head -1 || true)"
fi
if [[ -z "$NGINX_CONTAINER" ]]; then
  NGINX_CONTAINER="$(docker ps --format '{{.Names}}' | grep nginx | head -1 || true)"
fi
if [[ -z "$NGINX_CONTAINER" ]]; then
  echo "❌ Не найден контейнер nginx. Задайте: NGINX_CONTAINER=site_prod-nginx-1"
  exit 1
fi

echo "=== Диагностика (до): ${NGINX_CONTAINER} ==="
docker exec "$NGINX_CONTAINER" nginx -T 2>/dev/null \
  | grep -E 'server_name|ssl_certificate |proxy_pass|listen 443|default_server' \
  | grep -v '#' || true

if [[ ! -f "$NGINX_CONF" ]]; then
  echo "❌ Нет файла ${NGINX_CONF}"
  exit 1
fi

BACKUP="${NGINX_CONF}.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$NGINX_CONF" "$BACKUP"
echo "→ Бэкап: ${BACKUP}"

mkdir -p "$VHOSTS_DIR" /var/www/certbot

# ─── Z-TECH vhost (HTTP-only или HTTP+HTTPS) ─────────────────────────────────
HAS_ZTECH_CERT=0
if [[ -f /etc/letsencrypt/live/z-tech.pro/fullchain.pem ]]; then
  HAS_ZTECH_CERT=1
  cp "${REPO}/deploy/vhosts/00-z-tech.pro.conf" "${VHOSTS_DIR}/00-z-tech.pro.conf"
  echo "→ Z-TECH: HTTPS + proxy :8081 (сертификат z-tech.pro есть)"
else
  cp "${REPO}/deploy/vhosts/00-z-tech.pro-http-only.conf" "${VHOSTS_DIR}/00-z-tech.pro.conf"
  echo "→ Z-TECH: только HTTP → :8081 (пока нет certbot для z-tech.pro)"
fi

# ─── ТВК (только если на этом же VPS) ───────────────────────────────────────
TVK_PORT="${TVK_UPSTREAM_PORT:-}"
if [[ "$Z_TECH_ONLY" != "1" ]]; then
  if [[ -z "$TVK_PORT" ]]; then
    TVK_PORT="$(docker exec "$NGINX_CONTAINER" nginx -T 2>/dev/null \
      | grep -oE 'proxy_pass http://127\.0\.0\.1:[0-9]+' \
      | grep -v ':8081' | head -1 | grep -oE '[0-9]+$' || true)"
  fi
  if [[ -n "$TVK_PORT" ]] && [[ -f /etc/letsencrypt/live/xn--80aacf5bc0a3b.xn--p1ai/fullchain.pem ]]; then
    sed "s/TVK_UPSTREAM_PORT/${TVK_PORT}/g" \
      "${REPO}/deploy/vhosts/10-tvk.conf" > "${VHOSTS_DIR}/10-tvk.conf"
    echo "→ ТВК: vhost на порту ${TVK_PORT}"
  else
    rm -f "${VHOSTS_DIR}/10-tvk.conf"
    echo "→ ТВК: пропуск (другой VPS или нет сертификата ТВК на этом хосте)"
  fi
else
  rm -f "${VHOSTS_DIR}/10-tvk.conf"
  echo "→ Z_TECH_ONLY=1 — vhost ТВК не трогаем"
fi

INCLUDE_LINE='    include /srv/site/nginx/vhosts/*.conf;'
if ! grep -qF 'include /srv/site/nginx/vhosts/' "$NGINX_CONF"; then
  python3 - "$NGINX_CONF" "$INCLUDE_LINE" <<'PY'
import sys
path, inc = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
idx = text.find("http {")
if idx < 0:
    raise SystemExit("http { not found")
pos = idx + len("http {")
text = text[:pos] + "\n" + inc + "\n" + text[pos:]
open(path, "w", encoding="utf-8").write(text)
print("→ Добавлен include vhosts")
PY
fi

# Убрать старые server {} — они перехватывают z-tech.pro и редиректят на чужой .рф
python3 - "$NGINX_CONF" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
markers = (
    "z-tech.pro", "www.z-tech.pro",
    "твкпластик.рф", "tvkplastic.ru",
    "xn--80aacf5bc0a3b", "xn--80adtgcd1asdg",
    "80adtgcd1asdg",  # чужой .рф, на который сейчас редиректит z-tech.pro
)
out, i, removed = [], 0, 0
while i < len(text):
    m = re.search(r"\bserver\s*\{", text[i:])
    if not m:
        out.append(text[i:])
        break
    start = i + m.start()
    out.append(text[i:start])
    depth, j = 0, start
    while j < len(text):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                block = text[start : j + 1]
                if any(x in block for x in markers):
                    out.append(f"\n    # removed old vhost ({removed + 1})\n")
                    removed += 1
                else:
                    out.append(block)
                i = j + 1
                break
        j += 1
    else:
        out.append(text[start:])
        break
if removed:
    open(path, "w", encoding="utf-8").write("".join(out))
    print(f"→ Удалено старых server {{}}: {removed}")
else:
    print("→ Старые server {} в nginx.conf не найдены")
PY

echo ""
echo "=== nginx -t ==="
docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
echo "✓ nginx reload"

# Certbot для z-tech.pro
if [[ "$HAS_ZTECH_CERT" -eq 0 ]] && command -v certbot >/dev/null 2>&1; then
  echo ""
  echo "=== Certbot для z-tech.pro ==="
  if certbot certonly --webroot -w /var/www/certbot \
    -d z-tech.pro -d www.z-tech.pro \
    --agree-tos -m "$CERTBOT_EMAIL" --no-eff-email --non-interactive; then
    cp "${REPO}/deploy/vhosts/00-z-tech.pro.conf" "${VHOSTS_DIR}/00-z-tech.pro.conf"
    docker exec "$NGINX_CONTAINER" nginx -t
    docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "✓ HTTPS vhost включён"
  else
    echo "⚠ Certbot не выпустил сертификат — сайт работает по http://z-tech.pro"
    echo "  Проверьте DNS: dig +short z-tech.pro → IP этого VPS"
  fi
fi

echo ""
echo "=== Диагностика (после) ==="
docker exec "$NGINX_CONTAINER" nginx -T 2>/dev/null \
  | grep -E 'server_name|ssl_certificate |proxy_pass' | grep -v '#' | head -30 || true

bash "${REPO}/scripts/check-nginx-domains.sh" 2>/dev/null || true
