import { useState } from 'react';
import type { Message, MessageReaction } from '../types';
import { AVAILABLE_REACTIONS } from '../types';
import { addReaction } from '../utils/api';

interface MessageReactionsProps {
  message: Message;
  onReactionUpdate: (updatedMessage: unknown) => void;
  isHovered: boolean;
  isOwnMessage: boolean;
}

export const MessageReactions = ({ message, onReactionUpdate, isHovered, isOwnMessage }: MessageReactionsProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleReactionClick = async (emoji: string) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      // Всегда вызываем addReaction - бэкенд сам проверит, поставил ли админ эту реакцию
      // Если реакция уже есть от этого админа - она будет удалена (toggle)
      // Если реакции нет - она будет добавлена
      // Это позволяет ставить несколько разных реакций одновременно
      const updatedMessage = await addReaction(message.id, emoji);
      onReactionUpdate(updatedMessage);
    } catch (error) {
      console.error('Ошибка при обновлении реакции:', error);
      alert('Ошибка при обновлении реакции');
    } finally {
      setIsUpdating(false);
    }
  };

  // Группируем реакции по emoji
  const groupedReactions = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReaction[]>);

  const hasReactions = groupedReactions && Object.keys(groupedReactions).length > 0;

  return (
    <>
      {/* Установленные реакции - всегда видимы, компактные чипы */}
      {hasReactions && (
        <div 
          className={`absolute bottom-1 flex items-center gap-0.5 ${
            isOwnMessage 
              ? 'right-0 -translate-x-full -mr-2' 
              : 'left-0 translate-x-full ml-2'
          }`}
        >
          {Object.entries(groupedReactions).map(([emoji, reactions]) => (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              disabled={isUpdating}
              className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-gray-800/90 hover:bg-gray-700 transition-colors text-xs disabled:opacity-50 border border-gray-600"
              title="Нажмите, чтобы убрать реакцию"
            >
              <span className="text-xs">{emoji}</span>
              {reactions.length > 1 && (
                <span className="text-[9px] text-gray-300 leading-none">{reactions.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Панель быстрого добавления реакций - показывается ТОЛЬКО при наведении */}
      {isHovered && (
        <div 
          className={`absolute bottom-1 flex items-center gap-0.5 bg-gray-800/95 border border-gray-600 rounded-lg px-1 py-0.5 shadow-lg backdrop-blur-sm transition-all duration-200 ease-in-out z-10 ${
            isOwnMessage 
              ? `right-0 -translate-x-full ${hasReactions ? '-mr-24' : '-mr-2'}` 
              : `left-0 translate-x-full ${hasReactions ? 'ml-24' : 'ml-2'}`
          }`}
        >
          {AVAILABLE_REACTIONS.map((emoji) => {
            const hasReaction = message.reactions?.some((r) => r.emoji === emoji);
            return (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                disabled={isUpdating}
                className={`text-sm hover:scale-110 rounded p-0.5 transition-all disabled:opacity-50 ${
                  hasReaction ? 'bg-gray-700 scale-105' : 'hover:bg-gray-700/50'
                }`}
                title={hasReaction ? 'Убрать реакцию' : 'Добавить реакцию'}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
