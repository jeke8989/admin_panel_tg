import { useState } from 'react';
import type { Bot, BotStatistics } from '../types';

interface BotStatisticsTabProps {
  bot: Bot;
  statistics: BotStatistics | null;
  onToggleStatus: (botId: string) => Promise<void>;
  onDeleteBot: () => void;
}

export const BotStatisticsTab = ({ bot, statistics, onToggleStatus, onDeleteBot }: BotStatisticsTabProps) => {
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true);
    try {
      await onToggleStatus(bot.id);
    } catch (error) {
      console.error('Error toggling bot status:', error);
      alert('Ошибка при изменении статуса бота');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-xl font-semibold text-white mb-4">Статистика</h3>
      
      {statistics ? (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Всего пользователей</div>
            <div className="text-3xl font-bold text-white">{statistics.totalUsers}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Всего сообщений</div>
            <div className="text-3xl font-bold text-white">{statistics.totalMessages}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Активных пользователей</div>
            <div className="text-3xl font-bold text-green-400">{statistics.activeUsers}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Заблокировали бота</div>
            <div className="text-3xl font-bold text-red-400">{statistics.blockedUsers}</div>
          </div>
        </div>
      ) : (
        <div className="text-gray-500 mb-8">Загрузка статистики...</div>
      )}

      {/* Status Toggle */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium mb-1">Статус бота</h4>
            <p className="text-gray-400 text-sm">
              {bot.isActive 
                ? 'Бот активен и обрабатывает сообщения' 
                : 'Бот отключен и не обрабатывает сообщения'}
            </p>
          </div>
          <button
            onClick={handleToggleStatus}
            disabled={isTogglingStatus}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${
              bot.isActive ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                bot.isActive ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-white mb-4">Информация</h3>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-400 text-sm mb-1">ID бота</div>
            <div className="text-white font-mono text-sm">{bot.id}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Username</div>
            <div className="text-white">@{bot.username || 'Unknown'}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Создан</div>
            <div className="text-white">{formatDate(bot.createdAt)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Обновлен</div>
            <div className="text-white">{formatDate(bot.updatedAt)}</div>
          </div>
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDeleteBot}
        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Удалить бота
      </button>
    </div>
  );
};

