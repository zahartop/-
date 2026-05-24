# SSL и разделение доменов (z-tech.pro ≠ твкпластик.рф)

## Симптом

- `https://z-tech.pro` — ошибка сертификата (чужой CN, например ТВК).
- Редирект или контент с [твкпластик.рф](https://твкпластик.рф) вместо Z-TECH.

## Причина (типично)

На одном nginx **443** один `server` с `default_server` или **один** `ssl_certificate` на все домены, а `proxy_pass` ведёт на ТВК. Браузер видит несоответствие имени или отдаётся не тот сайт.

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

## Применить конфиг

1. Скопировать `deploy/nginx-vps-split.conf` в проект **site_prod** (два файла или один — как удобнее).
2. Заменить `TVK_UPSTREAM_PORT` на реальный порт ТВК.
3. Удалить **старые** `server { }` с теми же `server_name`, чтобы не было дублей.
4. Убрать `default_server` с 443 у ТВК, если z-tech попадал в этот блок.
5. Проверка и reload:

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
