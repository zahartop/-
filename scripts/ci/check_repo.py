#!/usr/bin/env python3
"""CI: секреты, запрещённые файлы в git, базовая валидация репозитория."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

FORBIDDEN_TRACKED_PREFIXES = (
    "telegram.local.json",
    ".env",
    ".env.local",
    "outreach/",
)

FORBIDDEN_TRACKED_SUFFIXES = (
    ".xlsx",
    ".pem",
    ".key",
    ".p12",
)

SECRET_PATTERNS = [
    (re.compile(r"\d{8,10}:[A-Za-z0-9_-]{30,}"), "Telegram bot token"),
    (re.compile(r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{8,}"), "Hardcoded secret"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS access key"),
    (re.compile(r"(?i)BEGIN (RSA |OPENSSH )?PRIVATE KEY"), "Private key block"),
]

SCAN_EXTENSIONS = {".html", ".js", ".py", ".json", ".yml", ".yaml", ".env", ".md", ".csv", ".xml", ".txt", ".toml"}
SKIP_PATH_PARTS = {".git", "node_modules", "css/tailwind.css"}


def git_tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        capture_output=True,
        text=False,
        check=False,
    )
    if result.returncode != 0:
        print("⚠ git ls-files недоступен — пропускаем проверку tracked files")
        return []
    raw = result.stdout.decode("utf-8", errors="replace")
    return [p for p in raw.split("\0") if p]


def check_forbidden_tracked(files: list[str]) -> list[str]:
    errors = []
    for path in files:
        norm = path.replace("\\", "/")
        if any(norm == p or norm.startswith(p) for p in FORBIDDEN_TRACKED_PREFIXES):
            errors.append(f"В git отслеживается запрещённый файл: {path}")
        if any(norm.endswith(s) for s in FORBIDDEN_TRACKED_SUFFIXES):
            if norm.startswith("outreach/"):
                errors.append(f"Outreach-данные не должны быть в git: {path}")
    return errors


def iter_scan_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if any(part in rel for part in SKIP_PATH_PARTS):
            continue
        if path.suffix.lower() not in SCAN_EXTENSIONS and path.name not in {
            "Dockerfile",
            "docker-compose.yml",
        }:
            continue
        if rel == "telegram.local.json":
            continue
        files.append(path)
    return files


def scan_secrets_in_tree() -> list[str]:
    errors = []
    for path in iter_scan_files():
        rel = path.relative_to(ROOT).as_posix()
        if rel.endswith("telegram.config.example.json"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for pattern, label in SECRET_PATTERNS:
            if pattern.search(text):
                if any(
                    x in rel
                    for x in ("example", "check_repo", ".gitleaks", "site.config.json")
                ):
                    continue
                if "PLACEHOLDER" in text and "dev_server.py" in rel:
                    continue
                errors.append(f"{label} в {rel}")
    return errors


def validate_seo_config() -> list[str]:
    errors = []
    cfg_path = ROOT / "seo" / "site.config.json"
    if not cfg_path.is_file():
        return ["Отсутствует seo/site.config.json"]
    try:
        data = json.loads(cfg_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"seo/site.config.json: {exc}"]
    for key in ("siteUrl", "title", "description", "keywords"):
        if key not in data:
            errors.append(f"seo/site.config.json: нет поля {key}")
    if data.get("siteUrl", "").startswith("http") is False:
        errors.append("siteUrl должен начинаться с https://")
    return errors


def main() -> int:
    errors: list[str] = []
    errors.extend(check_forbidden_tracked(git_tracked_files()))
    errors.extend(scan_secrets_in_tree())
    errors.extend(validate_seo_config())

    if errors:
        print("❌ Проверка репозитория не пройдена:\n")
        for err in errors:
            print(f"  • {err}")
        return 1

    print("✓ Репозиторий: запрещённые файлы и утечки секретов не обнаружены")
    return 0


if __name__ == "__main__":
    sys.exit(main())
