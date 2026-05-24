# SSL и разделение доменов (z-tech.pro ≠ твкпластик.рф)

## Симптом

- `https://z-tech.pro` — ошибка сертификата (чужой CN, например ТВК).
- Редирект или контент с [твкпластик.рф](https://твкпластик.рф) вместо Z-TECH.

## Причина (у вас на проде)

1. **Docker Z-TECH на сервере, скорее всего, в порядке** (`curl http://127.0.0.1:8081/` → Z-TECH), как на Mac.
2. **Внешний nginx** (`site_prod` на `91.229.8.112`) **не знает** `z-tech.pro` — запрос попадает в **чужой** `server {}` и уходит на `https://xn--80adtgcd1asdg.xn--p1ai/` (чужой `.рф`, не z-tech.pro).
3. **ТВК** сейчас на **другом IP** (`tvkplastic.ru` → `194.58.112.9`), поэтому там всё ок, а z-tech.pro → `91.229.8.112` — нужен **свой** vhost и certbot.

Проверка с Mac:

```bash
curl -sI http://z-tech.pro | grep -i location
# Плохо: Location: https://xn--80adtgcd1asdg.xn--p1ai/
# Хорошо: Location: https://z-tech.pro/ или proxy без чужого домена
```

## Решение

1. **Два отдельных** `server { listen 443 ssl; }` — см. `deploy/nginx-vps-split.conf`.
2. **Два сертификата** Certbot — по одному на каждый домен.
3. **Два upstream**:
   - `z-tech.pro` → `http://127.0.0.1:8081` (Docker Z-TECH)
   - `твкпластик.рф` → порт контейнера ТВК (не 8081)

---

## Диагностика на VPS

```bash
# Какой процесс слушает 80/443
ss -tlnp | grep -E ':80|:443'

# Конфиг nginx в site_prod (имя контейнера может отличаться)
docker ps --format '{{.Names}}' | grep nginx
docker exec site_prod-nginx-1 nginx -T 2>/dev/null | grep -E 'server_name|ssl_certificate|proxy_pass|listen 443' | head -80

# Сертификат снаружи (без -k)
echo | openssl s_client -connect z-tech.pro:443 -servername z-tech.pro 2>/dev/null | openssl x509 -noout -subject -dates

# Куда реально ведёт SNI z-tech.pro
curl -sI https://z-tech.pro | head -5
curl -s https://z-tech.pro | head -c 200 | tr '\n' ' '
```

Ожидание для Z-TECH:

- `subject` сертификата содержит `z-tech.pro`.
- В HTML есть `Z-TECH`, не ТВК ПЛАСТИК.

---

## Certbot (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
mkdir -p /var/www/certbot

# Только Z-TECH (после того как в nginx есть server_name z-tech.pro на :80)
certbot certonly --webroot -w /var/www/certbot \
  -d z-tech.pro -d www.z-tech.pro \
  --agree-tos -m skskxnddndnx@inbox.ru --no-eff-email

# Только ТВК (все имена сайта)
certbot certonly --webroot -w /var/www/certbot \
  -d твкпластик.рф -d www.твкпластик.рф -d tvkplastic.ru -d www.tvkplastic.ru \
  --agree-tos -m tvkplastic@mail.ru --no-eff-email

certbot certificates
```

Пути к ключам подставьте в `ssl_certificate` / `ssl_certificate_key` из вывода `certbot certificates`.

Для `.рф` путь часто в punycode, например:

`/etc/letsencrypt/live/xn--80aacf5bc0a3b.xn--p1ai/`

---

## Применить конфиг (автоматически на VPS)

```bash
cd ~/z-tech-portfolio/z-tech-portfolio
git pull
sudo bash scripts/fix-z-tech-server.sh
```

(или `Z_TECH_ONLY=1 sudo bash scripts/apply-nginx-split-vps.sh`)

Скрипт: диагностика `nginx -T`, копирует `deploy/vhosts/*.conf` в `/root/site_prod/nginx/vhosts/`, убирает дубли `server {}` из `nginx.conf`, `nginx -t` и `reload`.

Вручную: `deploy/nginx-vps-split.conf` или `deploy/vhosts/00-z-tech.pro.conf` + `10-tvk.conf`.

```bash
docker exec site_prod-nginx-1 nginx -t
docker exec site_prod-nginx-1 nginx -s reload
```

6. Z-TECH Docker должен работать:

```bash
cd ~/z-tech-portfolio/z-tech-portfolio   # ваш путь
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
curl -s http://127.0.0.1:8081/ | grep -i Z-TECH
```

---

## DNS

| Домен | A-запись |
|-------|----------|
| `z-tech.pro`, `www` | IP VPS |
| `твкпластик.рф`, `www`, `tvkplastic.ru` | IP VPS (тот же или другой — как у вас в DNS) |

Оба на одном IP — нормально, nginx различает по `server_name` (SNI).

---

## Cloudflare

Если домен за Cloudflare:

- **z-tech.pro** — SSL mode **Full (strict)** только если на origin валидный сертификат для `z-tech.pro`.
- Не включайте «Flexible» для одного и «Full» для другого на одном IP без раздельных vhost — путаница на origin.

---

## Файлы в репозитории Z-TECH

| Файл | Назначение |
|------|------------|
| `deploy/nginx-vps-split.conf` | Эталон: два домена, два SSL, два upstream |
| `deploy/nginx-z-tech.pro.conf` | Только HTTP :80 → :8081 (без SSL) |
| `deploy/Caddyfile.example` | Альтернатива: Caddy только для z-tech на :8081 |
