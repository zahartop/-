# shellcheck shell=bash
# Проверка :8081 через файл (без curl|grep pipefail и без огромных переменных).
curl_body_has_ztech() {
  local url="${1:-http://127.0.0.1:8081/}"
  local max_time="${2:-15}"
  local tmp="${3:-/tmp/ztech-curl-check.html}"
  local attempt code

  for attempt in 1 2 3 4 5; do
    code="$(curl -fsS --max-time "$max_time" -o "$tmp" -w '%{http_code}' "$url" 2>/dev/null || echo "000")"
    if [[ "$code" == "200" ]] && [[ -s "$tmp" ]] && grep -qi 'Z-TECH' "$tmp" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}
