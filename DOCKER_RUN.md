# Запуск проекта в Docker

Инструкция по запуску всего проекта (бэкенд, фронтенд, база данных) через Docker.

## Требования

- Docker версии 20.10 или выше
- Docker Compose версии 2.0 или выше
- Минимум 2GB свободной оперативной памяти

## Быстрый старт

### 1. Проверка Docker

Убедитесь, что Docker установлен и запущен:

```bash
docker --version
docker-compose --version
```

### 2. Запуск проекта

Из корневой директории проекта выполните:

```bash
# Сборка и запуск всех сервисов
docker-compose up -d --build
```

Эта команда:
- Соберет образы для backend и frontend
- Запустит PostgreSQL базу данных
- Запустит backend (NestJS)
- Запустит frontend (React + Nginx)
- Запустит autoheal для автоматического перезапуска

### 3. Проверка статуса

```bash
# Просмотр статуса всех контейнеров
docker-compose ps

# Или через скрипт
./docker-manage.sh status
```

### 4. Доступ к приложению

После запуска приложение будет доступно:

- **Frontend**: http://localhost:4000
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5433

## Управление через скрипт

Используйте удобный скрипт `docker-manage.sh`:

```bash
# Запуск всех сервисов
./docker-manage.sh start

# Остановка всех сервисов
./docker-manage.sh stop

# Перезапуск
./docker-manage.sh restart

# Статус
./docker-manage.sh status

# Просмотр логов
./docker-manage.sh logs              # Все логи
./docker-manage.sh logs backend      # Только backend
./docker-manage.sh logs frontend     # Только frontend
./docker-manage.sh logs postgres     # Только база данных

# Полная сборка и деплой
./docker-manage.sh deploy

# Обновление без простоя
./docker-manage.sh update

# Проверка здоровья сервисов
./docker-manage.sh health

# Бэкап базы данных
./docker-manage.sh backup_db

# Восстановление базы данных
./docker-manage.sh restore_db backup.sql
```

## Прямые команды Docker Compose

Если предпочитаете использовать docker-compose напрямую:

```bash
# Запуск в фоновом режиме
docker-compose up -d

# Запуск с пересборкой образов
docker-compose up -d --build

# Остановка
docker-compose down

# Остановка с удалением volumes (ОСТОРОЖНО: удалит данные БД!)
docker-compose down -v

# Просмотр логов
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Перезапуск конкретного сервиса
docker-compose restart backend
docker-compose restart frontend

# Пересборка конкретного сервиса
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

## Структура сервисов

### PostgreSQL (База данных)
- **Контейнер**: `admin_telegram_db`
- **Порт**: `5433:5432`
- **Данные**: Сохраняются в volume `postgres_data`
- **Пароль**: `X69Sx2y2_SecureDB` (изменить в `docker-compose.yml`)

### Backend (NestJS)
- **Контейнер**: `admin_telegram_backend`
- **Порт**: `3000:3000`
- **API**: http://localhost:3000/api
- **Загрузки**: `./backend/uploads` монтируется в контейнер

### Frontend (React + Nginx)
- **Контейнер**: `admin_telegram_frontend`
- **Порт**: `4000:80`
- **URL**: http://localhost:4000
- **Сборка**: Выполняется автоматически при создании образа

## Переменные окружения

Основные переменные настраиваются в `docker-compose.yml`:

```yaml
# Backend
DB_HOST: postgres
DB_PORT: 5432
DB_USERNAME: postgres
DB_PASSWORD: X69Sx2y2_SecureDB
DB_NAME: admin_telegram
JWT_SECRET: change-this-secret-key-in-production
PORT: 3000
NODE_ENV: production
FRONTEND_URL: http://localhost:5173,http://localhost:4000
```

Для изменения настроек отредактируйте `docker-compose.yml` или создайте `.env` файл:

```env
JWT_SECRET=your-secret-key-here
```

## Troubleshooting

### Проблемы с портами

Если порты заняты, измените их в `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Backend на другом порту
  - "4001:80"    # Frontend на другом порту
```

### Проблемы с правами доступа

Если возникают проблемы с загрузкой файлов:

```bash
# Проверьте права на папку uploads
ls -la backend/uploads

# Если нужно, создайте и установите права
mkdir -p backend/uploads
chmod 755 backend/uploads
```

### Просмотр логов для диагностики

```bash
# Все логи
docker-compose logs

# Последние 100 строк
docker-compose logs --tail=100

# Логи конкретного сервиса
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Логи в реальном времени
docker-compose logs -f
```

### Пересборка после изменений кода

```bash
# Полная пересборка
docker-compose down
docker-compose up -d --build

# Или через скрипт
./docker-manage.sh deploy
```

### Очистка Docker ресурсов

```bash
# Очистка неиспользуемых ресурсов
./docker-manage.sh cleanup

# Удаление всех контейнеров и образов проекта
docker-compose down --rmi all -v
```

### Проверка здоровья сервисов

```bash
# Через скрипт
./docker-manage.sh health

# Или вручную
curl http://localhost:3000/api/broadcasts/test
curl http://localhost:4000
```

### Подключение к базе данных

```bash
# Подключение через psql
docker exec -it admin_telegram_db psql -U postgres -d admin_telegram

# Или через внешний клиент
# Host: localhost
# Port: 5433
# User: postgres
# Password: X69Sx2y2_SecureDB
# Database: admin_telegram
```

## Бэкап и восстановление

### Создание бэкапа базы данных

```bash
./docker-manage.sh backup_db
```

Или вручную:

```bash
docker exec admin_telegram_db pg_dump -U postgres admin_telegram > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Восстановление из бэкапа

```bash
./docker-manage.sh restore_db backup_20240101_120000.sql
```

Или вручную:

```bash
cat backup.sql | docker exec -i admin_telegram_db psql -U postgres admin_telegram
```

## Остановка и удаление

### Остановка без удаления данных

```bash
docker-compose stop
# или
./docker-manage.sh stop
```

### Полное удаление (включая данные БД!)

```bash
docker-compose down -v
```

**ВНИМАНИЕ**: Флаг `-v` удалит все volumes, включая данные базы данных!

### Удаление только контейнеров (данные сохраняются)

```bash
docker-compose down
```

## Полезные команды

```bash
# Просмотр использования ресурсов
docker stats

# Просмотр всех контейнеров
docker ps -a

# Просмотр образов
docker images

# Вход в контейнер
docker exec -it admin_telegram_backend sh
docker exec -it admin_telegram_frontend sh

# Просмотр переменных окружения контейнера
docker exec admin_telegram_backend env
```

## Производственное использование

Для production рекомендуется:

1. **Изменить пароли** в `docker-compose.yml`
2. **Установить JWT_SECRET** через переменные окружения
3. **Настроить HTTPS** через reverse proxy (nginx/traefik)
4. **Настроить регулярные бэкапы** базы данных
5. **Мониторинг** через healthchecks и логирование

## Дополнительная информация

- Подробная документация по деплою: `DOCKER_DEPLOY.md`
- Инструкции по интеграции: `INTEGRATION_GUIDE.md`
- Быстрый деплой: `QUICK_DEPLOY.md`

