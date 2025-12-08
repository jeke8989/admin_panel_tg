import type { Bot } from '../types';

interface BotItemProps {
  bot: Bot & { chatCount?: number };
  isActive: boolean;
  onClick: () => void;
}

export const BotItem = ({ bot, isActive, onClick }: BotItemProps) => {
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 cursor-pointer transition-colors
        ${isActive ? 'bg-blue-600/20' : 'hover:bg-gray-700/50'}
        border-b border-gray-700/50
      `}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-medium truncate">
            @{bot.username || 'Unknown'}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ml-2 ${
              bot.isActive
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {bot.isActive ? 'Активен' : 'Неактивен'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-gray-400 text-sm truncate">
            {bot.firstName || 'Telegram Bot'}
          </p>
          {bot.chatCount !== undefined && (
            <span className="text-gray-500 text-xs flex-shrink-0">
              {bot.chatCount} {bot.chatCount === 1 ? 'чат' : 'чатов'}
            </span>
          )}
        </div>
        <div className="text-gray-500 text-xs mt-1">
          Создан: {formatDate(bot.createdAt)}
        </div>
      </div>
    </div>
  );
};

