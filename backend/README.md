# Backend для Telegram Admin Panel

## Установка и настройка

1. Установите зависимости:
```bash
npm install
```

2. Файл `.env` уже создан с настройками по умолчанию для локальной разработки.

Если нужно создать заново, скопируйте из примера:
```bash
cp .env.example .env
```

**Важно:** Для подключения к базе данных в Docker используйте порт `5433`, для локального PostgreSQL - `5432`.

3. Настройте переменные окружения в `.env`:
   - `DB_HOST` - хост PostgreSQL (по умолчанию localhost)
   - `DB_PORT` - порт PostgreSQL (по умолчанию 5433 для Docker, 5432 для локального PostgreSQL)
   - `DB_USERNAME` - имя пользователя БД (по умолчанию postgres)
   - `DB_PASSWORD` - пароль БД
   - `DB_NAME` - название базы данных (по умолчанию admin_telegram)
   - `JWT_SECRET` - секретный ключ для JWT токенов (обязательно измените в production!)
   - `PORT` - порт для запуска сервера (по умолчанию 3000)
   - `NODE_ENV` - окружение (development/production)
   - `FRONTEND_URL` - URL фронтенда для CORS (можно указать несколько через запятую)

4. Создайте базу данных PostgreSQL:
```bash
createdb admin_telegram
```

5. Выполните SQL миграцию для создания таблиц:
```bash
psql -U postgres -d admin_telegram -f src/migrations/001_initial_schema.sql
```

Или через psql:
```bash
psql -U postgres -d admin_telegram
\i src/migrations/001_initial_schema.sql
```

## Запуск

### Режим разработки:
```bash
npm run start:dev
```

### Продакшн:
```bash
npm run build
npm start
```

## Структура базы данных

- **users** - пользователи Telegram
- **chats** - чаты
- **messages** - сообщения
- **message_reads** - отметки о прочтении сообщений
- **chat_unread_counts** - счетчики непрочитанных сообщений

## API

API будет добавлено позже для интеграции с Telegram ботом.

