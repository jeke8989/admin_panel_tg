import { useState } from 'react';
import type { Message } from '../types';
import { MessageType, CURRENT_USER_ID } from '../types';
import { TgsSticker } from './TgsSticker';
import { MessageReactions } from './MessageReactions';

interface MessageItemProps {
  message: Message;
  onDelete?: (messageId: string) => void;
  onReactionUpdate?: (updatedMessage: unknown) => void;
  onReply?: (message: Message) => void;
  onScrollToMessage?: (messageId: string) => void;
}

export const MessageItem = ({ message, onDelete, onReactionUpdate, onReply, onScrollToMessage }: MessageItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isOwnMessage = message.isFromAdmin || message.senderId === CURRENT_USER_ID;
  const time = message.timestamp.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const renderMediaContent = () => {
    if (!message.fileUrl && message.messageType !== MessageType.TEXT) {
      return (
        <div className="text-sm text-gray-400">
          <p>⚠️ Файл недоступен</p>
        </div>
      );
    }

    switch (message.messageType) {
      case MessageType.PHOTO:
        return (
          <div className="mb-2">
            <img
              src={message.fileUrl!}
              alt="Фото"
              className="max-w-full rounded-lg"
              style={{ maxHeight: '300px' }}
            />
            {message.caption && (
              <p className="text-sm mt-2 whitespace-pre-wrap break-words">{message.caption}</p>
            )}
          </div>
        );

      case MessageType.VIDEO:
        return (
          <div className="mb-2">
            <video
              controls
              className="max-w-full rounded-lg"
              style={{ maxHeight: '300px' }}
            >
              <source src={message.fileUrl!} />
              Ваш браузер не поддерживает видео.
            </video>
            {message.caption && (
              <p className="text-sm mt-2 whitespace-pre-wrap break-words">{message.caption}</p>
            )}
          </div>
        );

      case MessageType.VOICE:
        return (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            <audio controls className="flex-1">
              <source src={message.fileUrl!} type="audio/ogg" />
              Ваш браузер не поддерживает аудио.
            </audio>
          </div>
        );

      case MessageType.AUDIO:
        return (
          <div className="mb-2">
            <audio controls className="w-full">
              <source src={message.fileUrl!} />
              Ваш браузер не поддерживает аудио.
            </audio>
            {message.caption && (
              <p className="text-sm mt-2 whitespace-pre-wrap break-words">{message.caption}</p>
            )}
          </div>
        );

      case MessageType.DOCUMENT:
        return (
          <div className="mb-2">
            <a
              href={message.fileUrl!}
              download
              className="flex items-center gap-2 text-blue-300 hover:text-blue-200 underline"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
              </svg>
              <span>{message.fileName || 'Скачать документ'}</span>
            </a>
            {message.caption && (
              <p className="text-sm mt-2 whitespace-pre-wrap break-words">{message.caption}</p>
            )}
          </div>
        );

      case MessageType.STICKER: {
        // Проверяем если это анимированный стикер (.tgs)
        const isAnimatedSticker = message.fileUrl?.endsWith('.tgs');
        
        return (
          <div className="mb-2 flex items-center justify-center">
            {isAnimatedSticker ? (
              <TgsSticker fileUrl={message.fileUrl!} />
            ) : (
              <img
                src={message.fileUrl!}
                alt="Стикер"
                className="max-w-[150px]"
                onError={(e) => {
                  // Если изображение не загрузилось - показываем fallback
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.sticker-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'sticker-fallback flex flex-col items-center justify-center bg-gray-600 rounded-lg p-4 w-[150px] h-[150px]';
                    fallback.innerHTML = '<span class="text-4xl mb-2">🎭</span><span class="text-xs text-gray-400">Стикер</span>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            )}
          </div>
        );
      }

      case MessageType.VIDEO_NOTE:
        return (
          <div className="mb-2">
            <video
              controls
              className="rounded-full"
              style={{ width: '200px', height: '200px' }}
            >
              <source src={message.fileUrl!} />
              Ваш браузер не поддерживает видео.
            </video>
          </div>
        );

      case MessageType.ANIMATION:
        return (
          <div className="mb-2">
            <img
              src={message.fileUrl!}
              alt="GIF"
              className="max-w-full rounded-lg"
              style={{ maxHeight: '300px' }}
            />
            {message.caption && (
              <p className="text-sm mt-2 whitespace-pre-wrap break-words">{message.caption}</p>
            )}
          </div>
        );

      case MessageType.TEXT:
      default:
        return message.text && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        );
    }
  };

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2 px-4 group relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-message-id={message.id}
    >
      <div
        className={`
          max-w-[70%] rounded-lg px-4 py-2 relative
          ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'}
        `}
      >
        {onReply && (
          <button
            onClick={() => onReply(message)}
            className="absolute -top-2 -right-10 bg-blue-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-700"
            title="Ответить"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
            title="Удалить сообщение"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
        {message.replyToMessage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onScrollToMessage && message.replyToMessageId) {
                onScrollToMessage(message.replyToMessageId);
              }
            }}
            className="mb-2 border-l-[3px] border-blue-400 pl-3 pr-2 py-2 bg-gray-800/70 hover:bg-gray-800 rounded-r-md max-w-full overflow-hidden cursor-pointer transition-colors group/reply w-full"
            title="Нажмите, чтобы перейти к исходному сообщению"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <p className="text-xs font-medium text-blue-400 truncate">
                    {message.replyToMessage.isFromAdmin ? 'Вы' : 'Пользователь'}
                  </p>
                </div>
                <p className="text-xs text-gray-300 break-words" style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  maxHeight: '2.5em'
                }}>
                  {message.replyToMessage.text || (message.replyToMessage.messageType !== MessageType.TEXT ? 'Медиафайл' : 'Пустое сообщение')}
                </p>
              </div>
              <svg 
                className="w-4 h-4 text-gray-500 group-hover/reply:text-blue-400 flex-shrink-0 transition-colors mt-0.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        )}
        {renderMediaContent()}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs opacity-70">{time}</span>
          {isOwnMessage && (
            <div className="flex items-center">
              {!message.isDelivered ? (
                // Одна галочка - отправлено
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                // Две галочки - доставлено или прочитано
                <>
            <svg
                    className={`w-4 h-4 ${message.isRead ? 'text-blue-400' : 'text-gray-400'} -mr-2`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <svg
                    className={`w-4 h-4 ${message.isRead ? 'text-blue-400' : 'text-gray-400'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Реакции сбоку от сообщения */}
      {onReactionUpdate && (
        <MessageReactions 
          message={message} 
          onReactionUpdate={onReactionUpdate} 
          isHovered={isHovered}
          isOwnMessage={isOwnMessage}
        />
      )}
    </div>
  );
};

