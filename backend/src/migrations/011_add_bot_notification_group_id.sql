-- Добавляем поле notification_group_id в таблицу bots
ALTER TABLE bots 
ADD COLUMN IF NOT EXISTS notification_group_id VARCHAR(255) NULL;

-- Комментарий к полю
COMMENT ON COLUMN bots.notification_group_id IS 'ID Telegram группы для отправки уведомлений о новых сообщениях от пользователей';
