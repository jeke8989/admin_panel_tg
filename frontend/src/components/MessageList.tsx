import { useEffect, useRef } from 'react';
import type { Message } from '../types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  chatId: string | null;
  scrollTrigger?: number;
  onDeleteMessage?: (messageId: string) => void;
  onReactionUpdate?: (updatedMessage: unknown) => void;
  onReply?: (message: Message) => void;
}

export const MessageList = ({ messages, chatId, scrollTrigger, onDeleteMessage, onReactionUpdate, onReply }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    if (!containerRef.current) return;
    
    // Используем несколько попыток для надежности
    const attemptScroll = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    };

    // Немедленный скролл
    attemptScroll();
    
    // Повторяем через небольшие интервалы для гарантии
    setTimeout(attemptScroll, 50);
    setTimeout(attemptScroll, 100);
    setTimeout(attemptScroll, 200);
  };

  // Скролл к конкретному сообщению по ID
  const scrollToMessage = (messageId: string) => {
    if (!containerRef.current) return;
    
    const messageElement = containerRef.current.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Подсвечиваем сообщение на короткое время
      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
    }
  };

  // Отслеживаем скролл пользователя
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!container) return;
      
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      // Если пользователь прокрутил вверх вручную
      if (scrollTop < lastScrollTopRef.current && !isAtBottom) {
        isUserScrollingRef.current = true;
      }
      
      // Если пользователь вернулся вниз
      if (isAtBottom) {
        isUserScrollingRef.current = false;
      }
      
      lastScrollTopRef.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Скролл при смене чата (ВСЕГДА)
  useEffect(() => {
    if (chatId && chatId !== prevChatIdRef.current) {
      console.log('📍 Смена чата:', { from: prevChatIdRef.current, to: chatId });
      isUserScrollingRef.current = false;
      prevChatIdRef.current = chatId;
      
      // Скроллим через небольшую задержку для загрузки DOM
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [chatId]);

  // Скролл при клике на чат (ВСЕГДА, даже если тот же чат)
  useEffect(() => {
    if (scrollTrigger && scrollTrigger > 0) {
      console.log('🎯 Триггер скролла:', scrollTrigger);
      isUserScrollingRef.current = false;
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [scrollTrigger]);

  // Скролл при новых сообщениях
  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    
    // Если это тот же чат и пользователь не читает историю
    if (chatId === prevChatIdRef.current && !isUserScrollingRef.current) {
      scrollToBottom();
    }
  }, [messages, chatId]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      return 'Сегодня';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.getTime() === yesterday.getTime()) {
      return 'Вчера';
    }
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  };

  const groupedMessages: Array<{ date: Date | null; messages: Message[] }> = [];
  let currentDate: Date | null = null;
  let currentGroup: Message[] = [];

  messages.forEach((message) => {
    const messageDate = new Date(
      message.timestamp.getFullYear(),
      message.timestamp.getMonth(),
      message.timestamp.getDate()
    );

    if (!currentDate || currentDate.getTime() !== messageDate.getTime()) {
      if (currentGroup.length > 0) {
        groupedMessages.push({ date: currentDate, messages: currentGroup });
        currentGroup = [];
      }
      currentDate = messageDate;
    }

    currentGroup.push(message);
  });

  if (currentGroup.length > 0) {
    groupedMessages.push({ date: currentDate, messages: currentGroup });
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-900 py-4">
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.date && (
            <div className="flex justify-center my-4">
              <span className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">
                {formatDate(group.date)}
              </span>
            </div>
          )}
          {group.messages.map((message) => (
            <MessageItem 
              key={message.id} 
              message={message} 
              onDelete={onDeleteMessage}
              onReactionUpdate={onReactionUpdate}
              onReply={onReply}
              onScrollToMessage={scrollToMessage}
            />
          ))}
        </div>
      ))}
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>Нет сообщений</p>
        </div>
      )}
      {/* Невидимый элемент для скролла */}
      <div ref={messagesEndRef} />
    </div>
  );
};

