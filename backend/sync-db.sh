#!/bin/bash
# Скрипт для выполнения SQL миграций

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5433}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-X69Sx2y2_SecureDB}
DB_NAME=${DB_NAME:-admin_telegram}

export PGPASSWORD="$DB_PASSWORD"

echo "Выполнение миграций базы данных..."
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo ""

for migration in src/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Выполнение: $migration"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f "$migration" || {
      echo "Миграция может быть уже применена, продолжаем..."
    }
  fi
done

echo ""
echo "Миграции выполнены!"
