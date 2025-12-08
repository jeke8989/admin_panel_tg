import type { Bot, BotStatistics } from '../types';
import { BotStatisticsTab } from './BotStatisticsTab';

interface BotDetailsProps {
  bot: Bot | null;
  statistics: BotStatistics | null;
  onDeleteBot: () => void;
  onToggleStatus: (botId: string) => Promise<void>;
}

export const BotDetails = ({ bot, statistics, onDeleteBot, onToggleStatus }: BotDetailsProps) => {
  
  if (!bot) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-900 text-gray-500">
        <p>Выберите бота для просмотра деталей</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-medium truncate">
              @{bot.username || 'Unknown'}
            </h3>
            <p className="text-gray-400 text-xs">{bot.firstName || 'Telegram Bot'}</p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded text-xs font-medium flex-shrink-0 ${
            bot.isActive
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {bot.isActive ? 'Активен' : 'Неактивен'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
          <BotStatisticsTab 
            bot={bot} 
            statistics={statistics} 
            onToggleStatus={onToggleStatus} 
            onDeleteBot={onDeleteBot} 
          />
      </div>
    </div>
  );
};

