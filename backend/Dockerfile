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

# Удаляем devDependencies после сборки для уменьшения размера образа
RUN npm prune --production

# Создаем директорию для загрузок
RUN mkdir -p /app/uploads && chmod 755 /app/uploads

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Меняем владельца директорий
RUN chown -R nestjs:nodejs /app

# Переключаемся на непривилегированного пользователя
USER nestjs

# Открываем порт
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/broadcasts/test || exit 1

# Запускаем приложение
CMD ["node", "dist/main.js"]
