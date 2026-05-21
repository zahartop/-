#!/usr/bin/env python3
"""Проверка telegram.local.json перед запуском."""

import json
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "telegram.local.json"
TELEGRAM_HOST = "api.telegram.org"
TELEGRAM_PORT = 443
CONNECT_TIMEOUT = 8
API_TIMEOUT = 12


def _print_network_help() -> None:
    print()
    print("Сеть не доходит до Telegram. Что сделать:")
    print("  1. Включите VPN (Telegram API часто блокируют без VPN)")
    print("  2. DNS: 1.1.1.1 или 8.8.8.8 в настройках Wi‑Fi / VPN")
    print("  3. Повторите: python3 scripts/check_telegram.py")
    print("  Пока API недоступен — заявки на Z-TECH@MAIL.RU")


def _check_tcp() -> bool:
    print(f"→ TCP {TELEGRAM_HOST}:{TELEGRAM_PORT} (макс. {CONNECT_TIMEOUT} сек)...", flush=True)
    try:
        with socket.create_connection(
            (TELEGRAM_HOST, TELEGRAM_PORT), timeout=CONNECT_TIMEOUT
        ):
            print("✓ Соединение с api.telegram.org установлено", flush=True)
            return True
    except socket.timeout:
        print("❌ Таймаут на этапе подключения (connect)", flush=True)
        _print_network_help()
        return False
    except OSError as exc:
        print(f"❌ Не удалось подключиться: {exc}", flush=True)
        _print_network_help()
        return False


def main() -> int:
    if not CONFIG.is_file():
        print("❌ Нет файла telegram.local.json")
        print("   Скопируйте: cp telegram.config.example.json telegram.local.json")
        return 1

    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    token = str(data.get("bot_token", "")).strip()
    chat_id = str(data.get("chat_id", "")).strip()

    if not token or "xxxx" in token or token == "YOUR_TOKEN":
        print("❌ bot_token — заглушка. Получите токен у @BotFather → /newbot")
        return 1
    if not chat_id or chat_id == "YOUR_CHAT_ID":
        print("❌ chat_id не задан. Напишите боту /start, id узнайте у @userinfobot")
        return 1

    if not _check_tcp():
        return 1

    print(f"→ Проверка токена getMe (макс. {API_TIMEOUT} сек)...", flush=True)
    try:
        with urllib.request.urlopen(
            f"https://api.telegram.org/bot{token}/getMe", timeout=API_TIMEOUT
        ) as resp:
            me = json.loads(resp.read())
    except KeyboardInterrupt:
        print("\n⏹ Прервано. Включите VPN и запустите снова.", flush=True)
        return 130
    except urllib.error.HTTPError as e:
        print(f"❌ Токен неверный (HTTP {e.code}). Создайте нового бота у @BotFather")
        return 1
    except urllib.error.URLError as e:
        reason = str(e.reason or e)
        if "timed out" in reason.lower() or "timeout" in reason.lower():
            print("❌ Telegram API не ответил вовремя (таймаут HTTP).", flush=True)
            _print_network_help()
        else:
            print(f"❌ Нет связи с Telegram: {reason}", flush=True)
        return 1

    if not me.get("ok"):
        print("❌ Telegram отклонил токен")
        return 1

    username = me["result"].get("username", "?")
    print(f"✓ Бот @{username} — токен валиден")

    print(f"→ Тестовое сообщение в чат (макс. {API_TIMEOUT} сек)...", flush=True)
    payload = json.dumps(
        {
            "chat_id": chat_id,
            "text": "✅ Z-TECH: тест подключения. Заявки с сайта будут приходить сюда.",
        }
    ).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
            sent = json.loads(resp.read())
    except KeyboardInterrupt:
        print("\n⏹ Прервано.", flush=True)
        return 130
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if "chat not found" in body.lower():
            print("❌ chat_id неверный. Напишите боту /start в Telegram и обновите chat_id")
        else:
            print(f"❌ Не удалось отправить тест: {body[:200]}")
        return 1
    except urllib.error.URLError as e:
        reason = str(e.reason or e)
        if "timed out" in reason.lower() or "timeout" in reason.lower():
            print("❌ Отправка: таймаут.", flush=True)
            _print_network_help()
        else:
            print(f"❌ Отправка: {reason}")
        return 1

    if sent.get("ok"):
        print("✓ Тестовое сообщение отправлено в ваш чат")
        return 0

    print("❌", sent.get("description", "ошибка отправки"))
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n⏹ Прервано. Включите VPN и запустите: python3 scripts/check_telegram.py")
        sys.exit(130)
