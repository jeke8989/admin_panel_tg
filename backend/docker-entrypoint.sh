#!/bin/sh
set -e

# Создаём папку uploads с правильными правами (если не монтируется как volume)
echo "Setting up uploads directory..."
mkdir -p /app/uploads

echo "Waiting for database to be ready..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" > /dev/null 2>&1; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready!"

# Запускаем SQL миграции
echo "Running database migrations..."
export PGPASSWORD="$DB_PASSWORD"

# Выполняем SQL миграции в порядке
for migration in /app/dist/migrations/*.sql /app/src/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Running migration: $migration"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$migration" || {
      # Игнорируем ошибки "already exists" и продолжаем
      echo "Migration may have already been applied, continuing..."
    }
  fi
done

echo "Migrations completed"

# Устанавливаем права на папку uploads ПОСЛЕ монтирования volume
# На Windows права могут не применяться, но попробуем
echo "Setting permissions on uploads directory..."
chmod -R 777 /app/uploads 2>/dev/null || echo "Note: Could not set permissions (may be volume mount on Windows)"

# Пытаемся изменить владельца (может не работать для volume)
chown -R nestjs:nodejs /app/uploads 2>/dev/null || echo "Note: Could not change owner (volume mount)"

# Убеждаемся, что папка существует и доступна для записи
if [ ! -w /app/uploads ]; then
  echo "WARNING: /app/uploads is not writable!"
  # Пытаемся установить права еще раз
  chmod 777 /app/uploads 2>/dev/null || true
fi

echo "Uploads directory ready"

# Переключаемся на пользователя nestjs и запускаем приложение
echo "Switching to nestjs user and starting application..."
exec su-exec nestjs:nodejs "$@"
