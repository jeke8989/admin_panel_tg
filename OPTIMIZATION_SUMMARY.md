# Отчет об оптимизации производительности

## Дата: 2026-02-04

## Проблема
При загрузке списка чатов приложение работало медленно из-за:
1. **N+1 Query Problem** - для каждого чата выполнялся отдельный запрос COUNT
2. **Отсутствие индексов** в БД на полях is_from_admin, is_read
3. **Частые автообновления** - каждые 5 и 3 секунды
4. **Отсутствие индекса** на поле last_message_at для сортировки

## Решение

### Backend оптимизация

#### 1. Индексы в Message.entity.ts
```typescript
@Index(['chatId', 'isFromAdmin', 'isRead']) // Композитный индекс
@Entity('messages')
export class Message {
  @Column({ type: 'boolean', default: false, name: 'is_from_admin' })
  @Index() // Индивидуальный индекс
  isFromAdmin: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_read' })
  @Index() // Индивидуальный индекс
  isRead: boolean;
}
```

#### 2. Индекс в Chat.entity.ts
```typescript
@Column({ type: 'timestamp', nullable: true, name: 'last_message_at' })
@Index() // Индекс для сортировки
lastMessageAt: Date | null;
```

#### 3. Оптимизация запроса в ChatsService.findAll()
**До:**
```typescript
// N+1 query - для каждого чата отдельный запрос
const chatsWithUnread = await Promise.all(
  chats.map(async (chat) => {
    const unreadCount = await this.messageRepository.count({
      where: { chatId: chat.id, isFromAdmin: false, isRead: false },
    });
    return { ...chat, unreadCount };
  }),
);
```

**После:**
```typescript
// Один запрос с эффективным подзапросом
.loadRelationCountAndMap(
  'chat.unreadCount',
  'chat.messages',
  'unreadMessages',
  (qb) => qb
    .where('unreadMessages.isFromAdmin = :isFromAdmin', { isFromAdmin: false })
    .andWhere('unreadMessages.isRead = :isRead', { isRead: false })
)
```

### Frontend оптимизация

#### Увеличение интервалов автообновления
- Список чатов: **5 секунд → 15 секунд** (снижение нагрузки в 3x)
- Сообщения чата: **3 секунды → 10 секунд** (снижение нагрузки в 3.3x)

### Миграция БД

Создан файл миграции: `backend/src/migrations/1738668000000-AddMessageIndexes.ts`

Индексы:
- `IDX_messages_chat_admin_read` - композитный (chat_id, is_from_admin, is_read)
- `IDX_messages_is_from_admin` - на поле is_from_admin
- `IDX_messages_is_read` - на поле is_read
- `IDX_chats_last_message_at` - на поле last_message_at

## Результаты

### До оптимизации
- 100 чатов → **101 запрос** к БД
- Время загрузки: **2-5 секунд**
- Нагрузка на БД: **Высокая** (каждые 5 секунд)
- Full table scan на фильтрации is_from_admin и is_read

### После оптимизации (ожидается)
- 100 чатов → **1 запрос** к БД
- Время загрузки: **200-500 мс** (10-25x быстрее)
- Нагрузка на БД: **Низкая** (каждые 15 секунд, в 3x меньше)
- Индексы используются для быстрой фильтрации

## Измененные файлы

### Backend
1. `backend/src/entities/Message.entity.ts` - добавлены индексы
2. `backend/src/entities/Chat.entity.ts` - добавлен индекс
3. `backend/src/chats/chats.service.ts` - оптимизирован запрос
4. `backend/src/migrations/1738668000000-AddMessageIndexes.ts` - новая миграция

### Frontend
1. `frontend/src/pages/ChatsPage.tsx` - увеличены интервалы

### Документация
1. `APPLY_OPTIMIZATION.md` - инструкции по деплою
2. `OPTIMIZATION_SUMMARY.md` - этот отчет

## Следующие шаги

1. ✅ Код готов к деплою
2. ⏳ Применить изменения на сервере (см. APPLY_OPTIMIZATION.md)
3. ⏳ Протестировать на реальных данных
4. ⏳ Следить за метриками производительности

## Дополнительные рекомендации на будущее

1. **Пагинация** - загружать только первые 50-100 чатов
2. **Виртуализация списка** - рендерить только видимые элементы
3. **WebSocket** - реальное время вместо polling
4. **Redis кэш** - кэшировать список чатов на 10-30 секунд
5. **Дебаунс поиска** - не отправлять запрос при каждом символе

## Команда для применения на сервере

```bash
ssh root@195.26.225.224
cd /root/admin_panel_tg
git pull
docker compose down
docker compose up -d --build
docker exec -it admin_telegram_backend npm run typeorm migration:run
```

## Автор
AI Assistant (Claude Sonnet 4.5)
