import type { Bot } from '../types';
import { BotItem } from './BotItem';

interface BotListProps {
  bots: (Bot & { chatCount?: number })[];
  activeBotId: string | null;
  onBotSelect: (id: string) => void;
  onAddBot: () => void;
}

export const BotList = ({ bots, activeBotId, onBotSelect, onAddBot }: BotListProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-800">
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <button
          onClick={onAddBot}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить бота
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {bots.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            <p>Нет ботов</p>
          </div>
        ) : (
          bots.map((bot) => (
            <BotItem
              key={bot.id}
              bot={bot}
              isActive={bot.id === activeBotId}
              onClick={() => onBotSelect(bot.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

