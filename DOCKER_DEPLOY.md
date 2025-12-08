# Деплой через Docker

## Быстрая инструкция

### 1. Скопируйте файлы на сервер

```bash
cd /Users/evgenijkukuskin/Documents/Проекты/cursor/admin_telegram

# Создайте архив проекта (исключая node_modules)
tar --exclude='node_modules' --exclude='.git' --exclude='backend/node_modules' \
    -czf admin_telegram.tar.gz \
    backend/ frontend/ docker-compose.yml admin_telegram_backup.sql .env.example

# Скопируйте на сервер
scp admin_telegram.tar.gz root@144.124.249.43:/root/admin/
```

### 2. На сервере - распакуйте и запустите

```bash
ssh root@144.124.249.43
cd /root/admin
tar -xzf admin_telegram.tar.gz

# Создайте .env файл
cp .env.example .env
# Отредактируйте .env и установите JWT_SECRET

# Запустите через docker-compose
docker-compose up -d

# Проверьте логи
docker-compose logs -f
```

### 3. Настройте nginx для проксирования (если нужно)

Приложение будет доступно на порту 4000.

Если нужно настроить nginx для проксирования на другой порт:

```nginx
server {
    listen 80;
    server_name 144.124.249.43;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Пересборка
docker-compose up -d --build

# Просмотр статуса
docker-compose ps
```

## Доступ к приложению

- Frontend: http://144.124.249.43:4000
- Backend API: http://144.124.249.43:3000

## Данные для входа

- Email: admin@test.com
- Пароль: admin123

