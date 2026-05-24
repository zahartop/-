# shellcheck shell=bash
# Upstream Z-TECH с хоста — для nginx в другом Docker-контейнере (не 127.0.0.1).
detect_ztech_upstream_host() {
  local nginx_container="${1:-}"
  local host tmp="/tmp/ztech-upstream-probe.html"
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
        "wget -q -O '$tmp' --timeout=3 'http://${host}:8081/' 2>/dev/null && grep -qi Z-TECH '$tmp'" 2>/dev/null; then
        echo "$host"
        return 0
      fi
    done
  fi

  # С хоста (curl на :8081 уже проверен отдельно)
  for host in 172.17.0.1 127.0.0.1; do
    if curl -fsS --max-time 3 "http://${host}:8081/" -o /dev/null 2>/dev/null; then
      echo "$host"
      return 0
    fi
  done

  echo "172.17.0.1"
}

apply_upstream_to_vhost() {
  local file="$1"
  local host="$2"
  sed "s|ZTECH_UPSTREAM_HOST|${host}|g" "$file"
}
