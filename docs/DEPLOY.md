# Деплой Z-TECH на VPS и домен

Пошагово: сервер → код → Telegram → Docker → DNS → HTTPS → проверка формы.

**Домен в проекте:** `z-tech.pro`, `www.z-tech.pro`  
**Репозиторий:** https://github.com/zahartop/-.git (клонировать в папку `z-tech-portfolio`)

---

## 0. Что понадобится

| Что | Где взять |
|-----|-----------|
| VPS (Ubuntu 22/24) | Timeweb, Selectel, Hetzner… |
| IP сервера | Панель хостинга |
| Домен | Регистратор → DNS |
| `bot_token`, `chat_id` | @BotFather, @userinfobot |
| `telegram.local.json` | Уже на Mac — скопируете на сервер |

---

## 1. Подготовка VPS (один раз)

Подключение:

```bash
ssh root@ВАШ_IP
```

Установка Docker:

```bash
apt update && apt install -y git ca-certificates curl
curl -fsSL https://get.docker.com | sh
```

Фаервол:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 2. Код на сервере

```bash
cd ~
git clone https://github.com/zahartop/-.git z-tech-portfolio
cd z-tech-portfolio
```

Секреты (не коммитить в git):

```bash
nano telegram.local.json
chmod 600 telegram.local.json
```

Формат:

```json
{
  "bot_token": "1234567890:AAH...",
  "chat_id": "123456789"
}
```

Проверка Telegram с VPS:

```bash
apt install -y python3
python3 scripts/check_telegram.py
```

---

## 3. Запуск Docker (прод)

**Вариант A — сайт сразу на порту 80** (удобно с Cloudflare):

```bash
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

Или вручную:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build
```

Проверка на сервере:

```bash
curl -sI http://127.0.0.1/ | head -1
curl -s http://127.0.0.1/ | grep -i Z-TECH
```

**Вариант B — только 8081 + Caddy с HTTPS** (без Cloudflare на origin):

```bash
USE_VPS_PORT=0 ./scripts/deploy-vps.sh
sudo apt install -y caddy
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
```

---

## 4. DNS домена

В панели домена (или Cloudflare):

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `@` | IP VPS |
| A | `www` | IP VPS |

Подождите 5–30 мин, проверка:

```bash
dig +short z-tech.pro
dig +short www.z-tech.pro
```

Должен вернуться IP вашего VPS.

---

## 5. HTTPS

### Cloudflare (рекомендуется)

1. Добавить сайт в Cloudflare, NS у регистратора → на Cloudflare.
2. DNS: A-записи на IP VPS, прокси **включён** (оранжевое облако).
3. SSL/TLS → **Full** или **Full (strict)**.
4. На VPS Docker слушает **80** (`docker-compose.vps.yml`).

Открыть: https://z-tech.pro

### Без Cloudflare — Caddy

См. вариант B выше и `deploy/Caddyfile.example`.

---

## 6. Верификация Google / Яндекс

Файлы уже в репозитории (корень сайта):

| Сервис | URL после деплоя |
|--------|------------------|
| Google Search Console | `https://z-tech.pro/google3d51010077350b48.html` |
| Яндекс Вебмастер | `https://z-tech.pro/yandex_99c0be07af079e32.html` |

В панелях выберите способ **«HTML-файл»** и нажмите «Проверить» после того, как сайт открывается по HTTPS.

---

## 7. Проверка после деплоя

| Проверка | Ожидание |
|----------|----------|
| https://z-tech.pro | Сайт, стили, заставка (первый визит в вкладке) |
| https://z-tech.pro/robots.txt | 200 |
| Форма «экспресс-аудит» | Сообщение в Telegram |
| DevTools → POST `/api/audit` | 200 |

Если форма: «сервер недоступен» или CORS:

- Сайт открыт по **https://z-tech.pro**, не по голому IP.
- В `docker-compose.prod.yml` уже: `ALLOWED_ORIGINS=https://z-tech.pro,https://www.z-tech.pro`.

---

## 8. Обновление сайта

На VPS:

```bash
cd ~/z-tech-portfolio
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build
```

Или: `./scripts/deploy-vps.sh`

---

## 9. Скопировать секреты с Mac (если не создавали на сервере)

На **Mac** (из папки проекта):

```bash
scp telegram.local.json root@ВАШ_IP:~/z-tech-portfolio/telegram.local.json
ssh root@ВАШ_IP 'chmod 600 ~/z-tech-portfolio/telegram.local.json'
```

---

## 10. Частые проблемы

| Симптом | Решение |
|---------|---------|
| Сайт не открывается | `ufw`, порт 80, `docker ps`, DNS |
| Нет стилей | Открывать по HTTPS; не `file://` |
| Форма не шлёт | `python3 scripts/check_telegram.py` на VPS |
| 502 / пусто | `docker compose logs web api` |
| project name empty | Уже исправлено: `name: z-tech` в compose |

---

## Контакты в проде

- Email на сайте: **Z-TECH@MAIL.RU**
- Telegram-заявки: только через `telegram.local.json` на сервере
