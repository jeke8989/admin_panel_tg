-- Добавляем флаг is_from_bot для сообщений, чтобы отличать системные ответы бота
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_from_bot BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN messages.is_from_bot IS 'Сообщение отправлено ботом (workflow/автоответ)';
