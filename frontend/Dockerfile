# Multi-stage build для сборки и запуска frontend

# Стадия 1: Сборка приложения
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Стадия 2: Production образ с nginx
FROM nginx:alpine

# Устанавливаем curl для healthcheck
RUN apk add --no-cache curl tzdata

# Устанавливаем временную зону
ENV TZ=Europe/Moscow

# Копируем собранный frontend из стадии сборки
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
