# Протокол тестирования (curl)

Перед тестами:

```bash
cd devops-task-xff
docker compose up -d --build
docker compose ps
```

Во всех примерах смотрим поле **`x_forwarded_for_chain`** в JSON.

Ожидаемая логика:

1. Первый IP в цепочке — **клиент** (с хоста часто IP Docker bridge, например `172.x`).
2. Дальше — IP каждого nginx по порядку прохождения.
3. Подставленный пользователем `X-Forwarded-For: 1.1.1.1` **не должен** появиться в ответе.

---

## 1. Один nginx → приложение

```bash
curl -s http://127.0.0.1:8001/ | jq .
curl -s http://127.0.0.1:8002/ | jq .
curl -s http://127.0.0.1:8003/ | jq .
```

**Ожидание:** `x_forwarded_for_chain` — **один** элемент (IP клиента).  
**Не ожидается:** лишние IP nginx (запрос не проходил через другие proxy).

---

## 2. Поддельный X-Forwarded-For от «злого» клиента

```bash
curl -s -H "X-Forwarded-For: 1.1.1.1, evil" http://127.0.0.1:8001/ | jq .x_forwarded_for_chain
curl -s -H "X-Forwarded-For: 1.1.1.1" http://127.0.0.1:8002/ | jq .x_forwarded_for_chain
curl -s -H "X-Forwarded-For: 8.8.8.8" http://127.0.0.1:8003/ | jq .x_forwarded_for_chain
```

**Ожидание:** в цепочке **нет** `1.1.1.1`, `evil`, `8.8.8.8`.  
Только реальный `$remote_addr` клиента (edge nginx сбрасывает подделку).

---

## 3. Два nginx в цепочке

```bash
curl -s http://127.0.0.1:8001/via/nginx2/ | jq .x_forwarded_for_chain
```

**Ожидание:** **два** IP — клиент + IP nginx1 (как видит nginx2).

```bash
curl -s http://127.0.0.1:8002/via/nginx3/ | jq .x_forwarded_for_chain
```

**Ожидание:** клиент + nginx2.

```bash
curl -s http://127.0.0.1:8003/via/nginx1/ | jq .
```

**Ожидание:** клиент + nginx3 (+ при прохождении через nginx1 ещё hop — смотреть длину цепочки ≥ 2).

---

## 4. Три nginx в цепочке

```bash
curl -s http://127.0.0.1:8001/via/nginx2-nginx3/ | jq .x_forwarded_for_chain
```

**Ожидание:** **три** IP — клиент, nginx1, nginx2 (nginx3 перед app — в цепочке отображаются все proxy-hop).

---

## 5. Подделка XFF в цепочке

```bash
curl -s -H "X-Forwarded-For: 203.0.113.50" http://127.0.0.1:8001/via/nginx2-nginx3/ | jq .
```

**Ожидание:** `203.0.113.50` **отсутствует**; цепочка только из реальных hop.

---

## 6. Разные входные точки (любой nginx)

Задание: запрос может прийти на **любой** nginx.

```bash
# Вход на nginx2, цепочка на nginx3
curl -s http://127.0.0.1:8002/via/nginx3/ | jq .x_forwarded_for_chain

# Вход на nginx3, цепочка на nginx2 → app
curl -s http://127.0.0.1:8003/via/nginx2/ | jq .x_forwarded_for_chain
```

**Ожидание:** корректная цепочка без подставленного XFF.

---

## 7. Остановка стенда

```bash
docker compose down
```

---

## Примечание про IP клиента

С хоста `curl` к `127.0.0.1:8001` первый IP часто из подсети Docker (`172.17.x.x`), не публичный IP ПК — это нормально.  
Важно: **порядок hop** и **отсутствие подделки**, а не конкретный публичный адрес.

Для «чистого» клиента из контейнера:

```bash
docker run --rm --network xff-test_internal curlimages/curl:latest \
  -s http://nginx1/via/nginx2/ 
```

(при необходимости подставить имя сети из `docker network ls`).
