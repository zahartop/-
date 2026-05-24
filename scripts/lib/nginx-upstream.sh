# shellcheck shell=bash
# Upstream с хоста — для nginx в другом Docker-контейнере (не 127.0.0.1).

detect_upstream_host() {
  local nginx_container="$1"
  local port="$2"
  local marker="$3"
  local host tmp="/tmp/upstream-probe.html"
  local candidates=()

  if [[ -n "$nginx_container" ]]; then
    local gw
    gw="$(docker exec "$nginx_container" sh -c "ip route 2>/dev/null | awk '/default/ {print \$3; exit}'" 2>/dev/null || true)"
    [[ -n "$gw" ]] && candidates+=("$gw")
    candidates+=(host.docker.internal 172.17.0.1 172.18.0.1)
  else
    candidates+=(172.17.0.1)
  fi

  if [[ -n "$nginx_container" ]]; then
    for host in "${candidates[@]}"; do
      [[ -z "$host" ]] && continue
      if docker exec "$nginx_container" sh -c \
        "wget -q -O '$tmp' --timeout=3 'http://${host}:${port}/' 2>/dev/null && grep -qi '${marker}' '$tmp'" 2>/dev/null; then
        echo "$host"
        return 0
      fi
      if docker exec "$nginx_container" sh -c \
        "wget -q -O /dev/null --timeout=2 'http://${host}:${port}/' 2>/dev/null"; then
        echo "$host"
        return 0
      fi
    done
  fi

  for host in 172.17.0.1 127.0.0.1; do
    if curl -fsS --max-time 3 "http://${host}:${port}/" -o /dev/null 2>/dev/null; then
      echo "$host"
      return 0
    fi
  done

  echo "172.17.0.1"
}

detect_ztech_upstream_host() {
  detect_upstream_host "${1:-}" "8081" "Z-TECH"
}

detect_tvk_upstream_port() {
  local nginx_container="${1:-}"
  local port

  port="$(docker exec "$nginx_container" nginx -T 2>/dev/null \
    | grep -oE 'proxy_pass http://[^:/*]+:[0-9]+' \
    | grep -v ':8081' | head -1 | grep -oE '[0-9]+$' || true)"

  if [[ -z "$port" ]]; then
    port="$(ss -tlnp 2>/dev/null | grep -oE '0\.0\.0\.0:[0-9]+|127\.0\.0\.1:[0-9]+' \
      | grep -oE '[0-9]+$' | grep -vE '^(80|443|8081|22)$' | head -1 || true)"
  fi

  echo "${port:-8080}"
}

apply_upstream_to_vhost() {
  local file="$1"
  local host="$2"
  local port="${3:-}"
  local out
  out="$(sed "s|ZTECH_UPSTREAM_HOST|${host}|g" "$file")"
  out="$(echo "$out" | sed "s|TVK_UPSTREAM_HOST|${host}|g")"
  if [[ -n "$port" ]]; then
    out="$(echo "$out" | sed "s|TVK_UPSTREAM_PORT|${port}|g")"
  fi
  echo "$out"
}
