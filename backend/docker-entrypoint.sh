#!/bin/sh
set -e

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

# Запускаем приложение
echo "Starting application..."
exec "$@"

