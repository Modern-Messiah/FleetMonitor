# Fleet Monitor MVP

MVP системы мониторинга автопарка с realtime-картой, журналом событий, дашбордом, симулятором телеметрии и очередями для обработки потока данных.

Правила для следующего агента: [AGENTS.md](AGENTS.md). Выбранный экран — `design-demos/01-gallery-dark.html`.

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
  - рабочее место — `/map`: карта на весь экран и лента номеров снизу
  - журнал (`/events`) и сводка (`/dashboard`) остаются отдельными экранами
  - живые маркеры, общий выбор ленты и карты, поиск по номеру и водителю
  - след выбранной машины: 10 последних точек из `GET /api/vehicles/:id`
  - клик по строке события ставит карту на координаты события
  - если Redis забыл координату, список отдаёт последнюю точку из `GpsPoint`, машина остаётся на карте серой
  - журнал с фильтрами, поиском, pagination, realtime и CSV
  - сводка со статистикой и графиком за час (`recharts`)
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

2. Подготовить переменные.

Корневой `.env.example` — для контейнеров: хосты `postgres`, `redis`, `rabbitmq`. Если backend и симулятор запущены на хосте, а в Docker только инфраструктура, в `backend/.env` нужны опубликованные порты:

```bash
DATABASE_URL=postgresql://user:pass@127.0.0.1:15432/fleet
REDIS_URL=redis://127.0.0.1:16379
RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672
WEBHOOK_URL=https://webhook.site/your-uuid
PORT=3000
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Фронтенд при `pnpm dev` проксирует `/api` и `/socket.io` на `http://127.0.0.1:3000`. Файл `frontend/.env` не нужен. `VITE_API_URL` включает прямой запрос браузера на API и обходит прокси.

Симулятор на хосте берёт `amqp://guest:guest@localhost:5672`. Имя хоста `rabbitmq` из `simulator/.env.example` работает только внутри compose.

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

Dev-сервер: [http://localhost:5173/map](http://localhost:5173/map). Если репозиторий лежит на диске Windows и Vite запущен из WSL, нужен `CHOKIDAR_USEPOLLING=1`, иначе правки исходников не подхватываются. `nest start --watch` на том же диске тоже может не увидеть файл: после правки backend процесс нужно перезапустить.

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

- **Frontend (UI)**: [http://localhost:8088](http://localhost:8088)
- **Backend API**: [http://localhost:3030/api](http://localhost:3030/api)
- **Swagger API Docs**: [http://localhost:3030/api/docs](http://localhost:3030/api/docs)
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

## Как карта держит последнюю точку

`GET /api/vehicles` берёт живую координату из Redis (`vehicle:{deviceId}:state`, TTL 30 секунд). Если ключа нет, в `state` подставляется последняя строка `GpsPoint`, а `isOnline` остаётся `false`. Маркер не пропадает: он серый, в карточке виден возраст точки. Пока ключ Redis есть, машина считается в сети.

`GET /api/vehicles/:id` по-прежнему отдаёт 10 последних точек (`gpsPoints`, сначала новые) и 20 событий. Карта рисует из них след выбранной машины и кольцо на координатах последнего события.

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
