import type { Broadcast } from '../types';

interface BroadcastItemProps {
  broadcast: Broadcast;
  isActive: boolean;
  onClick: () => void;
}

export const BroadcastItem = ({ broadcast, isActive, onClick }: BroadcastItemProps) => {
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/20 text-gray-400';
      case 'sending':
        return 'bg-blue-500/20 text-blue-400';
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Черновик';
      case 'sending':
        return 'Отправка';
      case 'completed':
        return 'Завершена';
      case 'failed':
        return 'Ошибка';
      default:
        return status;
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
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold text-lg">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-medium truncate">
            {broadcast.name}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ml-2 ${getStatusColor(
              broadcast.status,
            )}`}
          >
            {getStatusLabel(broadcast.status)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-gray-400 text-sm truncate">
            {broadcast.messageType === 'text' ? 'Текст' : 
             broadcast.messageType === 'photo' ? 'Фото' :
             broadcast.messageType === 'video' ? 'Видео' :
             broadcast.messageType === 'document' ? 'Документ' :
             broadcast.messageType === 'audio' ? 'Аудио' :
             broadcast.messageType === 'voice' ? 'Голосовое' :
             broadcast.messageType === 'animation' ? 'Анимация' : 'Сообщение'}
          </p>
          <span className="text-gray-500 text-xs flex-shrink-0">
            {broadcast.totalRecipients} {broadcast.totalRecipients === 1 ? 'получатель' : 'получателей'}
          </span>
        </div>
        <div className="text-gray-500 text-xs mt-1">
          Создан: {formatDate(broadcast.createdAt)}
          {broadcast.status === 'completed' && ` • Отправлено: ${broadcast.sentCount}`}
        </div>
      </div>
    </div>
  );
};

