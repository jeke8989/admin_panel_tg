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
}

export const ChatList = ({ chats, activeChatId, onChatSelect, searchQuery, onSearchChange, selectedTagFilter, onTagFilterChange, unreadCounts }: ChatListProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-800">
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
      <div className="border-t border-gray-700 bg-gray-800 flex-shrink-0">
        <div className="flex">
          <button
            onClick={() => onTagFilterChange('none')}
            className={`flex-1 px-2 py-3 text-xs font-medium transition-colors relative ${
              selectedTagFilter === 'none'
                ? 'text-white border-t-2 border-blue-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Без категории
            {unreadCounts.none > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                {unreadCounts.none > 99 ? '99+' : unreadCounts.none}
              </span>
            )}
          </button>
          <button
            onClick={() => onTagFilterChange('hot')}
            className={`flex-1 px-2 py-3 text-xs font-medium transition-colors relative ${
              selectedTagFilter === 'hot'
                ? 'text-white border-t-2 border-red-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Горячие
            {unreadCounts.hot > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                {unreadCounts.hot > 99 ? '99+' : unreadCounts.hot}
              </span>
            )}
          </button>
          <button
            onClick={() => onTagFilterChange('warm')}
            className={`flex-1 px-2 py-3 text-xs font-medium transition-colors relative ${
              selectedTagFilter === 'warm'
                ? 'text-white border-t-2 border-yellow-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Теплые
            {unreadCounts.warm > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-yellow-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                {unreadCounts.warm > 99 ? '99+' : unreadCounts.warm}
              </span>
            )}
          </button>
          <button
            onClick={() => onTagFilterChange('cold')}
            className={`flex-1 px-2 py-3 text-xs font-medium transition-colors relative ${
              selectedTagFilter === 'cold'
                ? 'text-white border-t-2 border-blue-500 bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Холодные
            {unreadCounts.cold > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                {unreadCounts.cold > 99 ? '99+' : unreadCounts.cold}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

