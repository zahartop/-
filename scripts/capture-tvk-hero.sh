#!/usr/bin/env bash
# Скачивает свежий скрин hero с https://твкпластик.рф (нужен network + chromium).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/case-tvk-hero.jpg"
URL="https://твкпластик.рф/"

if command -v npx >/dev/null 2>&1; then
  npx --yes playwright@1.49.0 install chromium >/dev/null 2>&1 || true
  npx --yes playwright@1.49.0 screenshot "$URL" "$OUT" --viewport-size=1280,720 --wait-for-timeout=2500
  echo "OK: $OUT"
  exit 0
fi

echo "Установи Playwright (npx playwright install chromium) или положи скрин вручную: assets/case-tvk-hero.jpg"
exit 1
