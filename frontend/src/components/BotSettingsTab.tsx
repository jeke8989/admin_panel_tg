import { useState, useEffect } from 'react';
import type { Bot } from '../types';
import { updateBotSettings } from '../utils/api';
import { useToast } from './ToastProvider';

interface BotSettingsTabProps {
  bot: Bot;
}

export const BotSettingsTab = ({ bot }: BotSettingsTabProps) => {
  const { showToast } = useToast();
  const [notificationGroupId, setNotificationGroupId] = useState(bot.notificationGroupId || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    setNotificationGroupId(bot.notificationGroupId || '');
  }, [bot.id, bot.notificationGroupId]);

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      await updateBotSettings(bot.id, {
        notificationGroupId: notificationGroupId.trim() || null,
      });
      showToast('Настройки сохранены', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Ошибка при сохранении настроек', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Настройки уведомлений */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Уведомления</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              ID Telegram группы для уведомлений
            </label>
            <input
              type="text"
              value={notificationGroupId}
              onChange={(e) => setNotificationGroupId(e.target.value)}
              placeholder="Например: -1001234567890"
              className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-2">
              При получении сообщения от пользователя в эту группу будет отправлено уведомление с username пользователя и текстом сообщения
            </p>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isSavingSettings ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>
    </div>
  );
};

