# Z-TECH · Цифровая инфраструктура премиум-сегмента

[![CI](https://github.com/zahartop/-/actions/workflows/ci.yml/badge.svg)](https://github.com/zahartop/-/actions/workflows/ci.yml)
[![CD](https://github.com/zahartop/-/actions/workflows/cd.yml/badge.svg)](https://github.com/zahartop/-/actions/workflows/cd.yml)

**Продакшен-лендинг и закрытый контур заявок** — без конструкторов, без посредников, без утечки токенов в браузер.

Сайт · Telegram-CRM · 152-ФЗ · Docker · CI/CD

---

## Что это

Одностраничный **premium B2B** сайт для Z-TECH: витрина, тарифы (от **150K ₽**), сравнение «архитектура vs конструкторы», FAQ со schema.org и форма экспресс-аудита с доставкой в **Telegram**.

| Слой | Стек |
|------|------|
| Frontend | HTML, Tailwind (локальная сборка), кастомные FX |
| API | Python 3.12 — валидация, rate limit, honeypot |
| Edge | nginx — CSP, rate limits, proxy `/api/audit` |
| Runtime | Docker Compose (web + api) |
| CI | GitHub Actions — Gitleaks, lint, Docker smoke |

---

## Быстрый старт (локально)

### 1. Telegram

```bash
cp telegram.config.example.json telegram.local.json
# bot_token от @BotFather, chat_id после /start боту
python3 scripts/check_telegram.py
```

### 2. Запуск

**Вариант A — без Docker**

```bash
./scripts/start-dev.sh
# → http://localhost:8081
```

**Вариант B — Docker (как на сервере)**

```bash
docker compose up -d --build
# → http://localhost:8081
```

Жёсткое обновление в браузере: **Cmd+Shift+R**

---

## Продакшен (VPS)

```bash
git clone https://github.com/zahartop/-.git z-tech-portfolio
cd z-tech-portfolio
cp telegram.config.example.json telegram.local.json
chmod 600 telegram.local.json
nano telegram.local.json

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

На сервере для порта **80** добавь локальный `docker-compose.vps.yml`:

```yaml
services:
  web:
    ports:
      - "80:80"
```

Домен + HTTPS: Cloudflare (Full SSL) или Caddy reverse_proxy на `127.0.0.1:8081`.

Подробнее — в комментариях к `docker-compose.prod.yml` и `.env.example`.

---

## Переменные окружения

| Переменная | Где | Описание |
|------------|-----|----------|
| `TELEGRAM_BOT_TOKEN` | сервер / `.env` | Токен бота (не в git) |
| `TELEGRAM_CHAT_ID` | сервер / `.env` | ID чата для заявок |
| `ALLOWED_ORIGINS` | prod | `https://z-tech.ru,https://www.z-tech.ru` |
| `DEBUG_ERRORS` | dev only | `1` локально, **0** в проде |

Файл `telegram.local.json` монтируется в API-контейнер и **в gitignore**.

---

## Безопасность

- Токен Telegram **только на сервере** — не в JS, не в репозитории
- Заголовок `X-Z-Tech-Client: 1` для POST `/api/audit`
- Rate limit, honeypot, проверка Origin
- nginx: запрет `.env`, `scripts/`, `telegram/`, лишних расширений
- Gitleaks + `scripts/ci/check_repo.py` в CI
- Контейнеры: `read_only`, `cap_drop: ALL`

---

## Скрипты

```bash
npm install
npm run build:css      # Tailwind → css/tailwind.css
npm run lint:html
npm run check:repo
python3 scripts/check_telegram.py
```

---

## Структура

```
├── index.html, privacy.html
├── css/                 # tailwind + custom + splash
├── js/main.js           # UI, форма, анимации
├── scripts/
│   ├── dev_server.py    # API + статика (dev)
│   ├── security.py      # валидация заявок
│   └── check_telegram.py
├── nginx/               # prod reverse proxy
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/   # CI + CD
```

---

## SEO

- `robots.txt`, `sitemap.xml`, canonical, Open Graph
- JSON-LD: Organization, WebSite, Service, FAQPage
- Конфиг: `seo/site.config.json`

---

## Контакты

- **Сайт:** [z-tech.ru](https://z-tech.ru)
- **Email:** Z-TECH@MAIL.RU
- **Telegram:** +7 977 720-31-30

---

## Лицензия

Проприетарный проект Z-TECH. Код в репозитории — для деплоя и сопровождения командой.

**Прямой контракт · production-grade · без посредников**
