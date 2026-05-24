#!/usr/bin/env bash
# Восстановить ТВК ПЛАСТИК в nginx (сертификат и vhost), не ломая z-tech.pro.
# sudo bash scripts/restore-tvk-nginx.sh
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
# shellcheck source=lib/nginx-upstream.sh
source "${REPO}/scripts/lib/nginx-upstream.sh"

SITE_PROD="${SITE_PROD:-/root/site_prod}"
NGINX_CONF="${SITE_PROD}/nginx/nginx.conf"
VHOSTS_DIR="${SITE_PROD}/nginx/vhosts"
NGINX_CONTAINER="${NGINX_CONTAINER:-site_prod-nginx-1}"

TVK_CERT="/etc/letsencrypt/live/xn--80aacf5bc0a3b.xn--p1ai/fullchain.pem"

if ! docker exec "$NGINX_CONTAINER" test -f "$TVK_CERT" 2>/dev/null; then
  echo "❌ На этом сервере нет сертификата ТВК: $TVK_CERT"
  echo "   Если ТВК на другом VPS — DNS tvkplastic.ru не должен указывать сюда."
  echo "   Восстановите nginx.conf из бэкапа вручную на том сервере, где был ТВК."
  exit 1
fi

mkdir -p "$VHOSTS_DIR" /var/www/certbot
cp "${REPO}/deploy/vhosts/ssl-params.conf" "${VHOSTS_DIR}/ssl-params.conf"

TVK_PORT="${TVK_UPSTREAM_PORT:-$(detect_tvk_upstream_port "$NGINX_CONTAINER")}"
TVK_HOST="$(detect_upstream_host "$NGINX_CONTAINER" "$TVK_PORT" "ТВК")"
echo "→ ТВК upstream: http://${TVK_HOST}:${TVK_PORT}"

apply_upstream_to_vhost "${REPO}/deploy/vhosts/10-tvk.conf" "$TVK_HOST" "$TVK_PORT" \
  > "${VHOSTS_DIR}/10-tvk.conf"

# Бэкап nginx.conf перед любой правкой
if [[ -f "$NGINX_CONF" ]]; then
  cp -a "$NGINX_CONF" "${NGINX_CONF}.bak.tvk-restore.$(date +%Y%m%d-%H%M%S)"
fi

# Восстановить блоки ТВК из старого бэкапа, если их вырезали из nginx.conf
if ! grep -q 'xn--80aacf5bc0a3b\|tvkplastic\|твкпластик' "$NGINX_CONF" 2>/dev/null; then
  RESTORED=""
  for bak in $(ls -t "${SITE_PROD}/nginx/nginx.conf.bak."* 2>/dev/null || true); do
    if grep -q 'xn--80aacf5bc0a3b\|tvkplastic\|твкпластик' "$bak" 2>/dev/null; then
      echo "→ В nginx.conf нет ТВК — можно откатить весь файл: cp $bak $NGINX_CONF"
      echo "  Сейчас ТВК поднимаем через vhosts/10-tvk.conf (безопаснее для z-tech.pro)."
      RESTORED=1
      break
    fi
  done
  [[ -z "$RESTORED" ]] && echo "→ Бэкап с ТВК не найден — только vhosts/10-tvk.conf"
fi

INCLUDE_LINE='    include /srv/site/nginx/vhosts/*.conf;'
if [[ -f "$NGINX_CONF" ]] && ! grep -qF 'include /srv/site/nginx/vhosts/' "$NGINX_CONF"; then
  python3 - "$NGINX_CONF" "$INCLUDE_LINE" <<'PY'
import sys
path, inc = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
idx = text.find("http {")
pos = idx + len("http {")
open(path, "w", encoding="utf-8").write(text[:pos] + "\n" + inc + "\n" + text[pos:])
print("→ include vhosts добавлен")
PY
fi

echo ""
docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
echo "✓ ТВК vhost восстановлен (10-tvk.conf)"

echo ""
echo "Проверка:"
echo | openssl s_client -connect 127.0.0.1:443 -servername tvkplastic.ru 2>/dev/null \
  | openssl x509 -noout -subject 2>/dev/null || true
