FROM node:20-alpine

# Устанавливаем curl для healthcheck и tzdata для временной зоны
RUN apk add --no-cache curl tzdata

# Устанавливаем временную зону
ENV TZ=Europe/Moscow

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости (включая devDependencies для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Устанавливаем postgresql-client для pg_isready и выполнения миграций
# Устанавливаем su-exec для переключения пользователя
RUN apk add --no-cache postgresql-client su-exec

# Копируем entrypoint скрипт и миграции
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY src/migrations /app/src/migrations
RUN chmod +x /app/docker-entrypoint.sh

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Создаем директорию для загрузок ПОСЛЕ создания пользователя
RUN mkdir -p /app/uploads && \
    chown -R nestjs:nodejs /app/uploads && \
    chmod 755 /app/uploads

# Меняем владельца всех директорий
RUN chown -R nestjs:nodejs /app

# НЕ переключаемся на nestjs - entrypoint будет запускаться от root
# чтобы иметь возможность изменять права на volume mount
# Переключение на nestjs произойдет в entrypoint скрипте
# USER nestjs

# Открываем порт
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/broadcasts/test || exit 1

# Запускаем приложение через entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
