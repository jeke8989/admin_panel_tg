import type { Chat } from '../types';

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export const ChatItem = ({ chat, isActive, onClick }: ChatItemProps) => {
  const formatTime = (date: Date | undefined | null): string => {
    if (!date) {
      return '';
    }
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Проверяем, что дата валидна
      if (isNaN(dateObj.getTime())) {
        return '';
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      
      if (messageDate.getTime() === today.getTime()) {
        return dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      }
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (messageDate.getTime() === yesterday.getTime()) {
        return 'Вчера';
      }
      
      return dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
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
        {chat.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center min-w-0">
            <h3 className="text-white font-medium truncate">{chat.name}</h3>
            {chat.user?.startParam && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded-full flex-shrink-0 shadow-sm">
                {chat.user?.startParam}
              </span>
            )}
          </div>
          <span className="text-gray-400 text-xs flex-shrink-0 ml-2">
            {formatTime(chat.lastMessageTime)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-gray-400 text-sm truncate">{chat.lastMessage}</p>
          {chat.unreadCount > 0 && (
            <span className="flex-shrink-0 bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
              {chat.unreadCount}
            </span>
          )}
        </div>
        {chat.botUsername && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-xs truncate">
              @{chat.botUsername}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                chat.isBotBlocked
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {chat.isBotBlocked ? 'Заблокирован' : 'Активен'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

