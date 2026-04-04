FROM node:20-alpine

# Устанавливаем curl для healthcheck, tzdata для временной зоны, pg-client для миграций
RUN apk add --no-cache curl tzdata postgresql-client su-exec

# Устанавливаем временную зону
ENV TZ=Europe/Moscow

# Создаем непривилегированного пользователя сразу
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Копируем package.json и package-lock.json (кэшируется если не менялись)
COPY package*.json ./

# Устанавливаем зависимости (кэшируется если package.json не менялся)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Копируем entrypoint скрипт и миграции
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY src/migrations /app/src/migrations
RUN chmod +x /app/docker-entrypoint.sh

# Создаем директорию для загрузок и меняем владельца только нужных файлов
RUN mkdir -p /app/uploads && \
    chown -R nestjs:nodejs /app/uploads /app/dist /app/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/broadcasts/test || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
