# Frontend - Панель администратора Telegram

React приложение для управления Telegram ботами, чатами, рассылками и workflow.

## Требования

- Node.js версии 18 или выше
- npm или yarn

## Установка

1. Перейдите в папку frontend:
```bash
cd frontend
```

2. Установите зависимости:
```bash
npm install
```

## Локальный запуск

### Режим разработки

Запустите dev-сервер:
```bash
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:5173`

Vite автоматически проксирует запросы к `/api` на бэкенд по адресу `http://localhost:3000` (настроено в `vite.config.ts`).

### Переменные окружения

Для настройки API endpoint создайте файл `.env` в папке `frontend`:

```env
# Режим работы: 'dev' или 'live'
VITE_APP_MODE=dev

# URL API для production режима (используется только если VITE_APP_MODE=live)
VITE_API_URL_LIVE=http://144.124.249.43:4000/api
```

**Примечание:** В режиме `dev` (по умолчанию) используется прокси на `http://localhost:3000/api`, поэтому переменные окружения не обязательны для локальной разработки.

### Предварительный просмотр production сборки

1. Соберите проект:
```bash
npm run build
```

2. Запустите preview сервер:
```bash
npm run preview
```

## Доступные команды

- `npm run dev` - запуск dev-сервера с hot-reload
- `npm run build` - сборка production версии в папку `dist`
- `npm run preview` - предварительный просмотр production сборки
- `npm run lint` - проверка кода линтером

## Структура проекта

```
frontend/
├── src/
│   ├── components/     # React компоненты
│   ├── pages/         # Страницы приложения
│   ├── contexts/      # React контексты
│   ├── utils/         # Утилиты (API клиент и т.д.)
│   ├── types/         # TypeScript типы
│   └── data/          # Моковые данные
├── public/            # Статические файлы
├── index.html         # HTML шаблон
├── vite.config.ts     # Конфигурация Vite
├── tailwind.config.js # Конфигурация Tailwind CSS
└── package.json       # Зависимости и скрипты
```

## Технологии

- **React 19** - UI библиотека
- **TypeScript** - типизация
- **Vite** - сборщик и dev-сервер
- **Tailwind CSS** - стилизация
- **React Router** - маршрутизация
- **Axios** - HTTP клиент
- **React Flow** - визуальный редактор workflow

## Подключение к бэкенду

Убедитесь, что бэкенд запущен на порту 3000. Если бэкенд работает на другом порту, обновите настройки прокси в `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:ВАШ_ПОРТ',
      changeOrigin: true,
    },
  },
}
```

## Troubleshooting

### Проблемы с зависимостями

Если возникают проблемы при установке зависимостей:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Проблемы с портом

Если порт 5173 занят, Vite автоматически предложит использовать другой порт. Или укажите порт явно:
```bash
npm run dev -- --port 3001
```

### Ошибки подключения к API

Убедитесь, что:
1. Бэкенд запущен и доступен
2. CORS настроен правильно на бэкенде
3. Прокси настроен корректно в `vite.config.ts`

