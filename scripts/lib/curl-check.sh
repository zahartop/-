# shellcheck shell=bash
# Проверка HTML без pipefail из-за раннего закрытия grep (curl exit 23).
curl_body_has_ztech() {
  local url="$1"
  local max_time="${2:-8}"
  local body
  body="$(curl -fsS --max-time "$max_time" "$url" 2>/dev/null || true)"
  [[ -n "$body" ]] && echo "$body" | grep -qi 'Z-TECH'
}
