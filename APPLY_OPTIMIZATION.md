# Инструкция по применению оптимизации производительности

## Что было сделано

1. ✅ Добавлены индексы в `Message.entity.ts` (композитный + индивидуальные)
2. ✅ Создана миграция для добавления индексов в БД
3. ✅ Оптимизирован метод `findAll()` в `ChatsService` (убран N+1 query)
4. ✅ Добавлен индекс на `last_message_at` в `Chat.entity.ts`
5. ✅ Увеличены интервалы автообновления на фронтенде (5с→15с, 3с→10с)

## Применение на сервере

### Вариант 1: Через Docker Compose (Рекомендуется)

```bash
# 1. Подключиться к серверу
ssh root@195.26.225.224
# Пароль: MK6mPw%KW6tk4CPX279F

# 2. Перейти в директорию проекта
cd /root/admin_panel_tg

# 3. Остановить контейнеры
docker compose down

# 4. Пересобрать образы (на локальной машине обновить код через git)
# На локальной машине:
# git add .
# git commit -m "Optimize chat list loading performance"
# git push

# На сервере обновить код
git pull

# 5. Запустить контейнеры
docker compose up -d --build

# 6. Проверить логи
docker compose logs -f backend

# 7. Применить миграцию внутри контейнера
docker exec -it admin_telegram_backend npm run typeorm migration:run

# 8. Проверить что индексы созданы
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram -c "\d messages"
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram -c "\di"
```

### Вариант 2: Применить миграцию вручную (Альтернатива)

Если миграция не применяется автоматически, можно выполнить SQL напрямую:

```bash
# Подключиться к PostgreSQL
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram

# Выполнить SQL команды
CREATE INDEX IF NOT EXISTS "IDX_messages_chat_admin_read" 
ON "messages" ("chat_id", "is_from_admin", "is_read");

CREATE INDEX IF NOT EXISTS "IDX_messages_is_from_admin" 
ON "messages" ("is_from_admin");

CREATE INDEX IF NOT EXISTS "IDX_messages_is_read" 
ON "messages" ("is_read");

CREATE INDEX IF NOT EXISTS "IDX_chats_last_message_at" 
ON "chats" ("last_message_at");

-- Проверить созданные индексы
\di

-- Выйти
\q
```

## Проверка результатов

### 1. Проверить работу приложения

```bash
# Проверить статус контейнеров
docker compose ps

# Проверить здоровье сервисов
curl http://localhost:3000/api/broadcasts/test
curl http://localhost:4000
```

### 2. Проверить производительность

Откройте браузер и зайдите в приложение: http://195.26.225.224:4000

**До оптимизации:**
- Загрузка списка чатов: 2-5 секунд
- Множественные запросы к БД (N+1 query)

**После оптимизации (ожидается):**
- Загрузка списка чатов: 200-500 мс
- Один оптимизированный запрос к БД

### 3. Мониторинг логов

```bash
# Смотреть логи backend
docker compose logs -f backend | grep "DEBUG_CHATS"

# Смотреть логи PostgreSQL
docker compose logs -f postgres

# Проверить нагрузку на сервер
htop
```

## Откат (если что-то пошло не так)

```bash
# Откатить миграцию
docker exec -it admin_telegram_backend npm run typeorm migration:revert

# ИЛИ удалить индексы вручную
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram

DROP INDEX IF EXISTS "IDX_chats_last_message_at";
DROP INDEX IF EXISTS "IDX_messages_is_read";
DROP INDEX IF EXISTS "IDX_messages_is_from_admin";
DROP INDEX IF EXISTS "IDX_messages_chat_admin_read";

\q
```

## Дополнительные команды

```bash
# Проверить размер таблицы messages
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram -c "SELECT pg_size_pretty(pg_total_relation_size('messages'));"

# Проверить количество чатов
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram -c "SELECT COUNT(*) FROM chats;"

# Проверить количество сообщений
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram -c "SELECT COUNT(*) FROM messages;"

# Анализировать производительность запроса
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram -c "EXPLAIN ANALYZE SELECT COUNT(*) FROM messages WHERE chat_id = 'some-uuid' AND is_from_admin = false AND is_read = false;"
```

## Ожидаемые результаты

### Производительность
- **10-25x** ускорение загрузки списка чатов
- Снижение нагрузки на БД в **3x** (интервалы 5с→15с, 3с→10с)
- Один запрос вместо N+1 запросов

### Пользовательский опыт
- Мгновенная загрузка списка чатов
- Плавная работа интерфейса
- Снижение задержек при переключении между чатами

## Примечания

- **ВАЖНО:** Индексы создаются с `IF NOT EXISTS`, поэтому повторное применение миграции безопасно
- Создание индексов может занять время на больших таблицах (1-2 минуты)
- После создания индексов PostgreSQL автоматически использует их для оптимизации запросов
- Рекомендуется следить за логами в первые 10-15 минут после деплоя
