#!/usr/bin/env bash
# Разделить z-tech.pro и ТВК в site_prod-nginx на VPS.
# Запуск: sudo bash scripts/apply-nginx-split-vps.sh
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
SITE_PROD="${SITE_PROD:-/root/site_prod}"
NGINX_CONF="${SITE_PROD}/nginx/nginx.conf"
VHOSTS_DIR="${SITE_PROD}/nginx/vhosts"
NGINX_CONTAINER="${NGINX_CONTAINER:-}"

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

echo "=== Диагностика (до правок): ${NGINX_CONTAINER} ==="
docker exec "$NGINX_CONTAINER" nginx -T 2>/dev/null \
  | grep -E 'server_name|ssl_certificate |proxy_pass|listen 443|default_server' \
  | grep -v '#' || true

echo ""
echo "=== Certbot на хосте ==="
if command -v certbot >/dev/null 2>&1; then
  certbot certificates 2>/dev/null | sed -n '1,80p' || true
else
  echo "(certbot не установлен на хосте — пути к сертификатам проверьте вручную)"
fi

# Порт ТВК: первый proxy_pass на 127.0.0.1, не 8081, из текущего конфига
TVK_PORT="${TVK_UPSTREAM_PORT:-}"
if [[ -z "$TVK_PORT" ]]; then
  TVK_PORT="$(docker exec "$NGINX_CONTAINER" nginx -T 2>/dev/null \
    | grep -oE 'proxy_pass http://127\.0\.0\.1:[0-9]+' \
    | grep -v ':8081' | head -1 | grep -oE '[0-9]+$' || true)"
fi
if [[ -z "$TVK_PORT" ]]; then
  TVK_PORT="$(ss -tlnp 2>/dev/null | grep -oE '127\.0\.0\.1:[0-9]+' | grep -v ':8081' | head -1 | cut -d: -f2 || true)"
fi
if [[ -z "$TVK_PORT" ]]; then
  echo "❌ Не удалось определить TVK_UPSTREAM_PORT. Задайте: TVK_UPSTREAM_PORT=8080 bash $0"
  exit 1
fi
echo ""
echo "→ TVK upstream port: ${TVK_PORT}"

if [[ ! -f "$NGINX_CONF" ]]; then
  echo "❌ Нет файла ${NGINX_CONF}"
  exit 1
fi

BACKUP="${NGINX_CONF}.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$NGINX_CONF" "$BACKUP"
echo "→ Бэкап: ${BACKUP}"

mkdir -p "$VHOSTS_DIR"
sed "s/TVK_UPSTREAM_PORT/${TVK_PORT}/g" \
  "${REPO}/deploy/vhosts/10-tvk.conf" > "${VHOSTS_DIR}/10-tvk.conf"
cp "${REPO}/deploy/vhosts/00-z-tech.pro.conf" "${VHOSTS_DIR}/00-z-tech.pro.conf"

# Путь внутри контейнера: /root/site_prod → /srv/site
INCLUDE_LINE='    include /srv/site/nginx/vhosts/*.conf;'
if ! grep -qF 'include /srv/site/nginx/vhosts/' "$NGINX_CONF"; then
  python3 - "$NGINX_CONF" "$INCLUDE_LINE" <<'PY'
import sys
path, inc = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
if inc.strip() in text:
    sys.exit(0)
idx = text.find("http {")
if idx < 0:
    raise SystemExit("http { not found")
pos = idx + len("http {")
text = text[:pos] + "\n" + inc + "\n" + text[pos:]
open(path, "w", encoding="utf-8").write(text)
print("→ Добавлен include vhosts в http {}")
PY
fi

# Убрать старые server {} для тех же доменов из основного nginx.conf
python3 - "$NGINX_CONF" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
markers = (
    "z-tech.pro", "www.z-tech.pro",
    "твкпластик.рф", "tvkplastic.ru",
    "xn--80aacf5bc0a3b", "xn--80adtgcd1asdg",
)
out = []
i = 0
removed = 0
while i < len(text):
    m = re.search(r"\bserver\s*\{", text[i:])
    if not m:
        out.append(text[i:])
        break
    start = i + m.start()
    out.append(text[i:start])
    depth = 0
    j = start
    while j < len(text):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                block = text[start : j + 1]
                if any(x in block for x in markers):
                    out.append(f"\n    # removed duplicate vhost ({removed + 1})\n")
                    removed += 1
                else:
                    out.append(block)
                i = j + 1
                break
        j += 1
    else:
        out.append(text[start:])
        break
new = "".join(out)
if removed:
    open(path, "w", encoding="utf-8").write(new)
    print(f"→ Удалено дублирующих server {{}}: {removed}")
else:
    print("→ Дубли server {} в nginx.conf не найдены (или уже только в vhosts/)")
PY

# Сертификат z-tech.pro
if [[ ! -d /etc/letsencrypt/live/z-tech.pro ]]; then
  echo ""
  echo "⚠ Нет /etc/letsencrypt/live/z-tech.pro"
  echo "  Выпустите сертификат (после DNS на этот VPS):"
  echo "  certbot certonly --webroot -w /var/www/certbot -d z-tech.pro -d www.z-tech.pro"
  echo "  Затем снова: bash scripts/apply-nginx-split-vps.sh"
fi

echo ""
echo "=== nginx -t ==="
docker exec "$NGINX_CONTAINER" nginx -t

echo "=== reload ==="
docker exec "$NGINX_CONTAINER" nginx -s reload

echo ""
echo "=== Диагностика (после) ==="
docker exec "$NGINX_CONTAINER" nginx -T 2>/dev/null \
  | grep -E 'server_name|ssl_certificate |proxy_pass' | grep -v '#' || true

echo ""
bash "${REPO}/scripts/check-nginx-domains.sh" || true
echo "Готово."
