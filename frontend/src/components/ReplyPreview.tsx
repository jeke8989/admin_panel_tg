import type { Message } from '../types';

interface ReplyPreviewProps {
  message: Message;
  onCancel: () => void;
}

export const ReplyPreview = ({ message, onCancel }: ReplyPreviewProps) => {
  return (
    <div className="p-3 bg-gray-700 border-t border-gray-600 flex items-start gap-3" style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="flex-1 border-l-2 border-blue-500 pl-3" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
        <p className="text-xs text-blue-400 font-medium mb-1 truncate">
          Ответ на: {message.isFromAdmin ? 'Вы' : 'Пользователь'}
        </p>
        <p className="text-sm text-gray-300 truncate" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
          {message.text || 'Медиафайл'}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        title="Отменить ответ"
        style={{ flexShrink: 0 }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

