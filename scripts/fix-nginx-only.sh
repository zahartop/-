#!/usr/bin/env bash
# Только nginx (Docker уже работает на :8081).
exec env SKIP_DOCKER=1 bash "$(cd "$(dirname "$0")" && pwd)/fix-z-tech-server.sh" "$@"
