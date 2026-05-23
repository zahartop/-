#!/usr/bin/env python3
"""Статика + защищённый API заявок в Telegram (токен только на сервере)."""

import http.server
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from security import (
    MAX_BODY_BYTES,
    RateLimiter,
    client_ip,
    origin_allowed,
    require_site_header,
    validate_audit_payload,
)

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "8080"))
CONFIG_PATH = ROOT / "telegram.local.json"
TRUST_PROXY = os.environ.get("TRUST_PROXY", "0") == "1"
DEBUG_ERRORS = os.environ.get("DEBUG_ERRORS", "0") == "1"
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_MIN", "5"))
ALLOWED_ORIGINS = frozenset(
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
)

_rate_limiter = RateLimiter(max_requests=RATE_LIMIT, window_seconds=60.0)


PLACEHOLDER_TOKENS = frozenset({"YOUR_TOKEN", "YOUR_BOT_TOKEN", "PLACEHOLDER_BOT_TOKEN"})
PLACEHOLDER_CHAT_IDS = frozenset({"YOUR_CHAT_ID", "123456789"})


def load_telegram_config():
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if CONFIG_PATH.is_file():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            token = token or str(data.get("bot_token", "")).strip()
            chat_id = chat_id or str(data.get("chat_id", "")).strip()
        except (json.JSONDecodeError, OSError):
            pass
    if token in PLACEHOLDER_TOKENS:
        token = ""
    if chat_id in PLACEHOLDER_CHAT_IDS:
        chat_id = ""
    return token, chat_id


def send_telegram_message(token, chat_id, text, retries: int = 3):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps(
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
    ).encode("utf-8")
    last_err: Exception | None = None

    for attempt in range(retries):
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            last_err = exc
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
        except Exception as exc:
            last_err = exc
            break

    if last_err is not None:
        raise last_err
    raise TimeoutError("Telegram API timeout")


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "ZTechAPI"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if DEBUG_ERRORS:
            super().log_message(fmt, *args)

    def do_GET(self):
        if self.path == "/health":
            self._json_response(200, {"ok": True, "service": "z-tech-api"})
            return
        return super().do_GET()

    def do_OPTIONS(self):
        self.send_error(405)

    def do_POST(self):
        if self.path == "/api/audit":
            self._handle_audit()
            return
        self.send_error(404)

    def _security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")

    def _json_response(self, status, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._security_headers()
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _client_key(self):
        return client_ip(self.headers, self.client_address[0], TRUST_PROXY)

    def _reject_rate_limit(self):
        retry = _rate_limiter.retry_after_seconds(self._client_key())
        self._json_response(
            429,
            {"ok": False, "error": "Слишком много запросов. Попробуйте позже."},
            extra_headers={"Retry-After": str(retry)},
        )

    def _handle_audit(self):
        if not require_site_header(self.headers):
            self._json_response(403, {"ok": False, "error": "Forbidden"})
            return

        if not origin_allowed(self.headers, ALLOWED_ORIGINS):
            self._json_response(403, {"ok": False, "error": "Forbidden"})
            return

        if not _rate_limiter.allow(self._client_key()):
            self._reject_rate_limit()
            return

        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            self._json_response(415, {"ok": False, "error": "Некорректный формат"})
            return

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_BODY_BYTES:
            self._json_response(400, {"ok": False, "error": "Некорректный запрос"})
            return

        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json_response(400, {"ok": False, "error": "Некорректный JSON"})
            return

        if not isinstance(data, dict):
            self._json_response(400, {"ok": False, "error": "Некорректный JSON"})
            return

        validated = validate_audit_payload(data)
        if validated == "spam":
            self._json_response(200, {"ok": True})
            return
        if isinstance(validated, str):
            self._json_response(400, {"ok": False, "error": validated})
            return

        payload = validated

        token, chat_id = load_telegram_config()
        if not token or not chat_id:
            self._json_response(
                503,
                {
                    "ok": False,
                    "error": (
                        "Сервис временно недоступен. Напишите на skskxnddndnx@inbox.ru или в Telegram."
                        if not DEBUG_ERRORS
                        else (
                            "Telegram не настроен. В telegram.local.json укажите bot_token от @BotFather "
                            "и chat_id (напишите боту /start, затем узнайте id у @userinfobot)."
                        )
                    ),
                },
            )
            return

        from datetime import datetime, timezone, timedelta

        msk = datetime.now(timezone(timedelta(hours=3))).strftime("%d.%m.%Y %H:%M")
        lines = [
            "<b>🎓 Новая заявка — Z-TECH</b>",
            "",
            f"<b>URL проекта:</b> {payload['url']}",
        ]
        if payload["name"]:
            lines.append(f"<b>Имя:</b> {payload['name']}")
        lines.append(
            f"<b>Связь ({payload['contact_method']}):</b> {payload['contact_value']}"
        )
        lines.extend(["", f"<i>{msk} MSK</i>"])
        text = "\n".join(lines)

        try:
            tg = send_telegram_message(token, chat_id, text)
            if not tg.get("ok"):
                self._json_response(
                    502,
                    {
                        "ok": False,
                        "error": "Не удалось отправить заявку. Попробуйте позже.",
                    },
                )
                return
            self._json_response(200, {"ok": True})
        except urllib.error.HTTPError:
            self._json_response(
                502,
                {"ok": False, "error": "Не удалось отправить заявку. Попробуйте позже."},
            )
        except urllib.error.URLError as exc:
            reason = str(exc.reason or exc)
            if DEBUG_ERRORS:
                print(f"[telegram] URLError: {reason}", flush=True)
            if "timed out" in reason.lower() or "timeout" in reason.lower():
                msg = (
                    "Telegram не ответил вовремя. Проверьте интернет/VPN и отправьте снова "
                    "или напишите на skskxnddndnx@inbox.ru / Telegram."
                )
            elif DEBUG_ERRORS:
                msg = reason
            else:
                msg = "Не удалось связаться с Telegram. Попробуйте позже или напишите напрямую."
            self._json_response(502, {"ok": False, "error": msg})
        except Exception as exc:
            if DEBUG_ERRORS:
                self._json_response(502, {"ok": False, "error": str(exc)})
            else:
                self._json_response(
                    502,
                    {"ok": False, "error": "Не удалось отправить заявку. Попробуйте позже."},
                )

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    token, chat_id = load_telegram_config()
    print(f"Z-TECH API → http://localhost:{PORT}")
    print("Форма: POST /api/audit (только с заголовком X-Z-Tech-Client)")
    print(f"Rate limit: {RATE_LIMIT}/min per IP")
    if token and chat_id:
        print("Telegram: настроен ✓")
    else:
        print("Telegram: не настроен — TELEGRAM_* env или telegram.local.json")

    http.server.ThreadingHTTPServer(("", PORT), Handler).serve_forever()
