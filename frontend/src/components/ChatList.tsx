import type { Chat, Tag } from '../types';
import { ChatItem } from './ChatItem';

type TagFilterType = 'none' | 'hot' | 'warm' | 'cold';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tags: Tag[];
  selectedTagFilter: TagFilterType;
  onTagFilterChange: (filter: TagFilterType) => void;
  unreadCounts: {
    none: number;
    hot: number;
    warm: number;
    cold: number;
  };
  totalCounts: {
    none: number;
    hot: number;
    warm: number;
    cold: number;
  };
}

export const ChatList = ({ chats, activeChatId, onChatSelect, searchQuery, onSearchChange, selectedTagFilter, onTagFilterChange, unreadCounts, totalCounts }: ChatListProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Поиск"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            <p>Нет чатов</p>
          </div>
        ) : (
          chats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onClick={() => onChatSelect(chat.id)}
            />
          ))
        )}
      </div>
      {/* Табы фильтрации по тегам внизу */}
      <div className="border-t border-gray-700 bg-gray-800 flex-shrink-0 sticky bottom-0 z-10">
        <div className="flex" style={{ minHeight: '56px' }}>
          <button
            onClick={() => onTagFilterChange('none')}
            className={`flex-1 px-3 text-sm font-medium transition-colors relative flex flex-col items-center justify-center whitespace-nowrap py-2 ${
              selectedTagFilter === 'none'
                ? 'text-white border-t-2 border-blue-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span>Без категории</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-500">{totalCounts.none}</span>
              {unreadCounts.none > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1.5">
                  {unreadCounts.none > 99 ? '99+' : unreadCounts.none}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => onTagFilterChange('hot')}
            className={`flex-1 px-3 text-sm font-medium transition-colors relative flex flex-col items-center justify-center whitespace-nowrap py-2 ${
              selectedTagFilter === 'hot'
                ? 'text-white border-t-2 border-red-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span>Горячие</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-500">{totalCounts.hot}</span>
              {unreadCounts.hot > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1.5">
                  {unreadCounts.hot > 99 ? '99+' : unreadCounts.hot}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => onTagFilterChange('warm')}
            className={`flex-1 px-3 text-sm font-medium transition-colors relative flex flex-col items-center justify-center whitespace-nowrap py-2 ${
              selectedTagFilter === 'warm'
                ? 'text-white border-t-2 border-yellow-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span>Теплые</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-500">{totalCounts.warm}</span>
              {unreadCounts.warm > 0 && (
                <span className="bg-yellow-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1.5">
                  {unreadCounts.warm > 99 ? '99+' : unreadCounts.warm}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => onTagFilterChange('cold')}
            className={`flex-1 px-3 text-sm font-medium transition-colors relative flex flex-col items-center justify-center whitespace-nowrap py-2 ${
              selectedTagFilter === 'cold'
                ? 'text-white border-t-2 border-blue-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span>Холодные</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-500">{totalCounts.cold}</span>
              {unreadCounts.cold > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1.5">
                  {unreadCounts.cold > 99 ? '99+' : unreadCounts.cold}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

