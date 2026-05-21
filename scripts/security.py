"""Валидация заявок, rate limit, санитизация для Telegram HTML."""

from __future__ import annotations

import html
import ipaddress
import re
import time
from collections import defaultdict
from threading import Lock
from urllib.parse import urlparse

MAX_BODY_BYTES = 3072
MAX_URL_LEN = 500
MAX_NAME_LEN = 120
MAX_CONTACT_LEN = 120
MAX_HONEYPOT_LEN = 0

URL_SCHEME_RE = re.compile(r"^https?://", re.I)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", re.I)
PHONE_DIGITS_RE = re.compile(r"\D")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

CONTACT_METHOD_LABELS = {
    "phone": "Телефон",
    "email": "Email",
    "telegram": "Telegram",
    "whatsapp": "WhatsApp",
}


class RateLimiter:
    """Простой in-memory лимит: N запросов за окно (на процесс API)."""

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max(1, max_requests)
        self.window_seconds = max(1.0, window_seconds)
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        if not key:
            key = "unknown"
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            bucket = self._hits[key]
            self._hits[key] = bucket = [t for t in bucket if t > cutoff]
            if len(bucket) >= self.max_requests:
                return False
            bucket.append(now)
            return True

    def retry_after_seconds(self, key: str) -> int:
        with self._lock:
            bucket = self._hits.get(key) or []
            if not bucket:
                return int(self.window_seconds)
            oldest = min(bucket)
        wait = self.window_seconds - (time.monotonic() - oldest)
        return max(1, int(wait) + 1)


def client_ip(headers, remote_addr: str, trust_proxy: bool) -> str:
    if trust_proxy:
        real = (headers.get("X-Real-IP") or "").strip()
        if real:
            try:
                ipaddress.ip_address(real.split(",")[0].strip())
                return real.split(",")[0].strip()
            except ValueError:
                pass
    addr = (remote_addr or "").strip()
    if addr:
        try:
            ipaddress.ip_address(addr)
            return addr
        except ValueError:
            pass
    return "unknown"


def origin_allowed(headers, allowed_origins: frozenset[str]) -> bool:
    if not allowed_origins:
        return True
    origin = (headers.get("Origin") or "").strip()
    if origin and origin in allowed_origins:
        return True
    referer = (headers.get("Referer") or "").strip()
    if referer:
        parsed = urlparse(referer)
        ref_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""
        if ref_origin in allowed_origins:
            return True
    return not origin and not referer


def require_site_header(headers) -> bool:
    return (headers.get("X-Z-Tech-Client") or "").strip() == "1"


def sanitize_text(value: str, max_len: int) -> str:
    cleaned = CONTROL_CHARS_RE.sub("", value).strip()
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
    return html.escape(cleaned, quote=True)


def _validate_contact(method: str, value: str) -> str | None:
    if method not in CONTACT_METHOD_LABELS:
        return "Выберите способ связи"
    if not value:
        return "Укажите контакт для связи"
    if len(value) > MAX_CONTACT_LEN:
        return "Контакт слишком длинный"

    if method == "email":
        if not EMAIL_RE.match(value):
            return "Некорректный email"
        return None

    if method in ("phone", "whatsapp"):
        digits = PHONE_DIGITS_RE.sub("", value)
        if len(digits) < 10 or len(digits) > 15:
            return "Некорректный номер телефона"
        return None

    if method == "telegram":
        handle = value.lstrip("@").split("/")[-1].strip()
        if len(handle) < 3:
            return "Укажите @username или ссылку t.me/..."
        return None

    return None


def validate_audit_payload(data: dict) -> dict[str, str] | str:
    honeypot = str(data.get("website", "")).strip()
    if honeypot:
        return "spam"

    project_url = str(data.get("url", "")).strip()
    name = str(data.get("name", "")).strip()
    contact_method = str(data.get("contact_method", "")).strip().lower()
    contact_value = str(data.get("contact_value", "")).strip()

    if not project_url:
        return "Укажите URL проекта"
    if len(project_url) > MAX_URL_LEN:
        return "URL слишком длинный"
    if not URL_SCHEME_RE.match(project_url):
        return "URL должен начинаться с http:// или https://"

    parsed = urlparse(project_url)
    if parsed.scheme.lower() not in ("http", "https"):
        return "Недопустимая схема URL"
    if not parsed.netloc or " " in parsed.netloc:
        return "Некорректный URL"

    host = parsed.hostname or ""
    if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local"):
        return "Укажите публичный URL проекта"

    if len(name) > MAX_NAME_LEN:
        return "Имя слишком длинное"

    contact_err = _validate_contact(contact_method, contact_value)
    if contact_err:
        return contact_err

    label = CONTACT_METHOD_LABELS[contact_method]
    return {
        "url": sanitize_text(project_url, MAX_URL_LEN),
        "name": sanitize_text(name, MAX_NAME_LEN) if name else "",
        "contact_method": label,
        "contact_value": sanitize_text(contact_value, MAX_CONTACT_LEN),
    }
