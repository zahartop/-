# DevOps test: X-Forwarded-For через цепочку nginx

Тестовое задание: стенд с **3 nginx** (reverse proxy) и приложением, которое показывает `X-Forwarded-For`.

## Идея решения

| Кто подключается | Что в `X-Forwarded-For` уходит дальше |
|------------------|--------------------------------------|
| **Пользователь** (не из доверенной сети) | только `$remote_addr` — **заголовок клиента игнорируется** |
| **Другой nginx** (Docker-сеть = trusted) | `$proxy_add_x_forwarded_for` — цепочка: старый XFF + IP предыдущего hop |

Реализация: `nginx/snippets/trusted_xff.conf` (`geo` + `map`).

## Запуск

```bash
cd devops-task-xff
docker compose up -d --build
```

Порты:

| Сервис | URL |
|--------|-----|
| nginx1 | http://127.0.0.1:8001/ |
| nginx2 | http://127.0.0.1:8002/ |
| nginx3 | http://127.0.0.1:8003/ |

Протокол проверки: **[TESTING.md](./TESTING.md)**

## Маршруты цепочек

| Путь | Цепочка |
|------|---------|
| `GET /` на :8001/:8002/:8003 | один nginx → app |
| `GET /via/nginx2/` на :8001 | nginx1 → nginx2 → app |
| `GET /via/nginx3/` на :8001 | nginx1 → nginx3 → app |
| `GET /via/nginx2-nginx3/` на :8001 | nginx1 → nginx2 → nginx3 → app |

## Время на задание

~2–3 часа (стенд, проверки curl, README).

## Автор

Dmitry Bannykh — тестовое для стажировки DevOps.
