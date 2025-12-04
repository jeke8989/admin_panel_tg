import { useState, useRef, useEffect } from 'react';
import type { Chat, Message, Template, Tag } from '../types';
import { MessageList } from './MessageList';
import { MessageInput, type MessageInputRef } from './MessageInput';
import { DeleteChatModal } from './DeleteChatModal';
import { ClearHistoryModal } from './ClearHistoryModal';
import { ChatMenu } from './ChatMenu';
import { TemplatesBar } from './TemplatesBar';
import { getAllTags, addTagToChat, removeTagFromChat } from '../utils/api';

interface ChatWindowProps {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (text: string, files?: File[], replyToMessageId?: string) => void;
  onDeleteChat?: (chatId: string) => void;
  onClearHistory?: (chatId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onMessageUpdate?: (updatedMessage: unknown) => void;
  onChatUpdate?: (updatedChat: Chat) => void;
  onTagFilterChange?: (filter: 'none' | 'hot' | 'warm' | 'cold') => void;
  onReloadChats?: () => void;
  scrollTrigger?: number;
}

export const ChatWindow = ({
  chat,
  messages,
  onSendMessage,
  onDeleteChat,
  onClearHistory,
  onDeleteMessage,
  onMessageUpdate,
  onChatUpdate,
  onTagFilterChange,
  onReloadChats,
  scrollTrigger,
}: ChatWindowProps) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const messageInputRef = useRef<MessageInputRef>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const [isUpdatingTag, setIsUpdatingTag] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const allTags = await getAllTags();
      // Показываем все теги для возможности присвоения
      setTags(allTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleTagToggle = async (tagId: string) => {
    if (!chat || !onChatUpdate) return;

    const isTagAssigned = chat.tags?.some((t) => t.id === tagId);
    setIsUpdatingTag(true);

    try {
      if (isTagAssigned) {
        // Снимаем тег - чат попадет в категорию "Без категории"
        await removeTagFromChat(chat.id, tagId);
        // После снятия тега переключаемся на "Без категории"
        if (onTagFilterChange) {
          onTagFilterChange('none');
        }
      } else {
        // Присваиваем тег
        await addTagToChat(chat.id, tagId);
        
        // Определяем тип присвоенного тега для переключения фильтра
        const assignedTag = tags.find((t) => t.id === tagId);
        if (assignedTag && onTagFilterChange) {
          onTagFilterChange(assignedTag.tagType);
        }
      }
      
      // Перезагружаем список чатов для обновления данных
      if (onReloadChats) {
        onReloadChats();
      }
      
      // Закрываем выпадающее окно
      setIsTagsDropdownOpen(false);
    } catch (error) {
      console.error('Error updating tag:', error);
      alert('Ошибка при обновлении тега');
    } finally {
      setIsUpdatingTag(false);
    }
  };

  if (!chat) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-900 text-gray-500">
        <p>Выберите чат для начала общения</p>
      </div>
    );
  }

  const handleSendMessage = (text: string, files?: File[], replyToMessageId?: string) => {
    onSendMessage(text, files, replyToMessageId);
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleClearHistoryClick = () => {
    setIsClearHistoryModalOpen(true);
  };

  const handleClearHistoryConfirm = async () => {
    if (!onClearHistory) {
      console.error('onClearHistory не передан в ChatWindow');
      return;
    }

    setIsClearing(true);
    try {
      await onClearHistory(chat.id);
      setIsClearHistoryModalOpen(false);
    } catch (error: unknown) {
      console.error('Error clearing history:', error);
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        (error as { message?: string })?.message ||
        'Ошибка при очистке истории';
      alert(errorMessage);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDeleteChat) {
      console.error('onDeleteChat не передан в ChatWindow');
      return;
    }

    setIsDeleting(true);
    try {
      console.log('Начинаем удаление чата:', chat.id);
      await onDeleteChat(chat.id);
      console.log('Чат успешно удален:', chat.id);
      setIsDeleteModalOpen(false);
    } catch (error: unknown) {
      console.error('Error deleting chat:', error);
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        (error as { message?: string })?.message ||
        'Ошибка при удалении чата';
      console.error('Error details:', errorMessage);
      // Показываем ошибку пользователю
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    if (messageInputRef.current) {
      await messageInputRef.current.insertTemplate(template);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-gray-900 overflow-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {chat.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-medium truncate">
                {chat.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-400 text-xs">был(а) недавно</p>
                {chat.tags && chat.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {chat.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : '#3B82F620',
                          color: tag.color || '#3B82F6',
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                {chat.user?.startParam && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded-full flex-shrink-0 shadow-sm">
                    {chat.user.startParam}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Выбор тегов */}
            <div className="relative">
              <button
                onClick={() => setIsTagsDropdownOpen(!isTagsDropdownOpen)}
                disabled={isUpdatingTag}
                className="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                title="Теги"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </button>
              {isTagsDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsTagsDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                    <div className="p-2">
                      <div className="text-gray-400 text-xs px-2 py-1 mb-1 font-medium">Присвоить тег</div>
                      {tags.length === 0 ? (
                        <div className="text-gray-500 text-sm px-3 py-2">Нет доступных тегов</div>
                      ) : (
                        tags.map((tag) => {
                          const isSelected = chat.tags?.some((t) => t.id === tag.id);
                          return (
                            <button
                              key={tag.id}
                              onClick={async () => {
                                await handleTagToggle(tag.id);
                                // Не закрываем выпадающий список, чтобы можно было выбрать несколько тегов подряд
                              }}
                              disabled={isUpdatingTag}
                              className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 flex items-center justify-between transition-colors disabled:opacity-50 ${
                                isSelected ? 'bg-gray-700/50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: tag.color || '#3B82F6' }}
                                />
                                <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                                  {tag.name}
                                </span>
                              </div>
                              {isSelected && (
                                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          );
                        })
                      )}
                      {chat.tags && chat.tags.length > 0 && (
                        <>
                          <div className="border-t border-gray-700 my-2" />
                          <button
                            onClick={async () => {
                              // Удаляем все теги из чата - чат попадет в категорию "Без категории"
                              if (!chat) return;
                              setIsUpdatingTag(true);
                              try {
                                // Удаляем все теги по очереди
                                for (const tag of chat.tags || []) {
                                  await removeTagFromChat(chat.id, tag.id);
                                }
                                
                                // Переключаемся на категорию "Без категории"
                                if (onTagFilterChange) {
                                  onTagFilterChange('none');
                                }
                                
                                // Перезагружаем список чатов для обновления данных
                                if (onReloadChats) {
                                  onReloadChats();
                                }
                                
                                // Закрываем выпадающее окно
                                setIsTagsDropdownOpen(false);
                              } catch (error) {
                                console.error('Error removing all tags:', error);
                                alert('Ошибка при сбросе тегов');
                              } finally {
                                setIsUpdatingTag(false);
                              }
                            }}
                            disabled={isUpdatingTag}
                            className="w-full text-left px-3 py-2 rounded hover:bg-red-700/20 text-red-400 text-sm transition-colors disabled:opacity-50"
                          >
                            Сбросить все теги
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {(onDeleteChat || onClearHistory) && (
              <ChatMenu
                onClearHistory={handleClearHistoryClick}
                onDeleteChat={handleDeleteClick}
              />
            )}
          </div>
        </div>
        <MessageList 
          messages={messages} 
          chatId={chat.id} 
          scrollTrigger={scrollTrigger}
          onDeleteMessage={onDeleteMessage}
          onReactionUpdate={onMessageUpdate}
          onReply={handleReply}
        />
        <TemplatesBar onTemplateSelect={handleTemplateSelect} />
        <MessageInput 
          ref={messageInputRef} 
          onSendMessage={handleSendMessage}
          replyToMessage={replyToMessage}
          onCancelReply={handleCancelReply}
        />
      </div>
      <ClearHistoryModal
        chatName={chat.name}
        isOpen={isClearHistoryModalOpen}
        onClose={() => setIsClearHistoryModalOpen(false)}
        onConfirm={handleClearHistoryConfirm}
        isLoading={isClearing}
      />
      <DeleteChatModal
        chatName={chat.name}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </>
  );
};

