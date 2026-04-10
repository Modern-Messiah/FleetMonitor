# Fleet Monitor MVP

MVP системы мониторинга автопарка с realtime-картой, журналом событий, дашбордом, симулятором телеметрии и очередями для обработки потока данных.

## Что реализовано

- Монорепо на `pnpm workspaces` с сервисами:
  - `backend` (NestJS + Prisma + PostgreSQL + Redis + RabbitMQ + Socket.IO)
  - `frontend` (React + Vite + Leaflet + TanStack Query + UI-компоненты в стиле shadcn)
  - `simulator` (Python, публикует GPS и события в RabbitMQ)
- Backend:
  - Prisma-модели `Vehicle`, `GpsPoint`, `Event`, `WebhookLog`
  - consumers для `gps.updates` и `fleet.events`
  - запись GPS/событий в PostgreSQL
  - кэш текущего состояния машины в Redis (`vehicle:{deviceId}:state`, TTL 30 сек)
  - дедупликация событий через Redis TTL + `groupCount`
  - REST API:
    - `GET /api/vehicles`
    - `GET /api/vehicles/:id`
    - `GET /api/events`
    - `GET /api/events/export/csv`
    - `GET /api/health`
  - WebSocket namespace `/fleet`:
    - `gps:update`
    - `event:new`
    - `vehicle:status`
    - reconnect batches: `fleet:snapshot`, `events:history`
  - webhook worker для `webhook.critical` с retry (1s, 2s, 4s) и логом попыток в `WebhookLog`
  - Swagger на `/api/docs`
  - глобальный `ValidationPipe`, `ExceptionFilter`, Winston-логирование
- Frontend:
  - роуты `/map`, `/events`, `/dashboard`
  - live-карта с throttle обновлений маркеров (1 раз/сек)
  - offline-индикация транспорта
  - toast для CRITICAL событий
  - журнал событий с фильтрами, поиском, pagination, realtime и CSV экспортом
  - дашборд со статистикой, CRITICAL-лентой и top-5 графиком (`recharts`)
- Docker:
  - `docker-compose` для `postgres`, `redis`, `rabbitmq`, `backend`, `simulator`, `frontend`
  - healthchecks и зависимости сервисов

## Стек и почему именно он

- **NestJS**: структурированные модули и удобная интеграция WebSocket/DI
- **Prisma + PostgreSQL**: типобезопасный доступ к данным и надежное хранение истории
- **Redis**: быстрый online-state и дедуп-окно по TTL
- **RabbitMQ**: буферизация и развязка simulator ↔ backend ↔ webhook worker
- **React + TanStack Query**: удобный слой клиентского состояния + polling/retry
- **Leaflet**: простой и надежный realtime map-rendering
- **Python simulator**: быстрый отдельный генератор телеметрии
- **Docker Compose**: воспроизводимый запуск всего MVP одним набором сервисов

## Как запустить локально и через docker-compose

### Локально

1. Установить зависимости:

```bash
pnpm install
```

2. Подготовить переменные:

- Скопировать `.env.example` в `.env` (и при необходимости `backend/.env.example`, `frontend/.env.example`, `simulator/.env.example`)

3. Поднять инфраструктуру (Postgres/Redis/RabbitMQ), например через docker:

```bash
docker compose up -d postgres redis rabbitmq
```

4. Применить миграции и сгенерировать Prisma Client:

```bash
pnpm --filter backend prisma migrate deploy
pnpm --filter backend prisma generate
```

5. Запустить backend:

```bash
pnpm --filter backend dev
```

6. Запустить frontend:

```bash
pnpm --filter frontend dev
```

7. Запустить simulator:

```bash
cd simulator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Через Docker Compose

```bash
docker compose up --build
```

После старта:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- RabbitMQ UI: `http://localhost:15672` (`guest/guest`)

## Почему WebSocket для фронта, RabbitMQ между simulator и backend

- **WebSocket** нужен фронту для мгновенной доставки GPS и событий без постоянного polling.
- **RabbitMQ** между simulator и backend:
  - сглаживает всплески потока
  - отделяет генерацию данных от потребления
  - дает независимость и масштабируемость consumers
  - позволяет выделить отдельный webhook worker

## Как работает reconnect (`fleet:snapshot` + `events:history`)

При подключении клиента к `/fleet` backend:

1. Читает текущие online-состояния из Redis (`vehicle:*:state`) и отправляет батч `fleet:snapshot`.
2. Дочитывает события за последний час из Postgres и отправляет батч `events:history`.

Это позволяет клиенту после reconnect восстановить актуальное состояние карты и недавний контекст по событиям.

## Как дедуплицируются события (Redis TTL + groupCount)

- Для события используется ключ `event:dedup:{vehicleId}:{type}` с TTL 30 секунд.
- Если ключа нет:
  - создается новый `Event`
  - в Redis записывается `eventId`
- Если ключ есть:
  - новая запись `Event` не создается
  - у существующего `Event` увеличивается `groupCount` и ставится `grouped=true`

Итог: серия одинаковых событий за короткий интервал агрегируется в одну запись.

## Как работает retry вебхуков (exponential backoff, `WebhookLog`)

- CRITICAL события публикуются в `webhook.critical`.
- Отдельный worker читает очередь и отправляет POST на `WEBHOOK_URL`.
- Повторные попытки: до 3 раз с задержками `1s`, `2s`, `4s`.
- В `WebhookLog` сохраняются:
  - статус (`PENDING/SUCCESS/FAILED`)
  - число попыток
  - время последней попытки
  - текст ответа/ошибки

## Trade-offs

- Для упрощения MVP не добавлен auth/rbac.
- Для аналитики дашборда часть метрик считается на уровне API-запросов, а не через отдельные materialized views/агрегаты.
- В webhook worker retry реализован внутри consumer-потока (без отдельного scheduler/parking queue).
- В Redis используется `KEYS` для snapshot (достаточно для MVP, но не лучший вариант для high-scale).

## Что не успел и что бы улучшил в production

- Добавить полноценную авторизацию (JWT/OAuth2), multi-tenant изоляцию и аудит.
- Перейти на `SCAN` вместо `KEYS`, добавить eviction/partition strategy для Redis.
- Вынести websocket fan-out в отдельный слой (например, Redis pub/sub + несколько backend инстансов).
- Добавить DLQ для webhook, circuit breaker и более гибкую retry-политику.
- Ввести миграции/seed pipeline и e2e/integration тесты для очередей/WS.
- Добавить наблюдаемость: metrics (Prometheus), трассировку, alerting.
- Оптимизировать Docker-образы и CI/CD пайплайн с кэшированием и проверками безопасности.
