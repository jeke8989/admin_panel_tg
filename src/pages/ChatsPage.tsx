import { useState, useMemo, useEffect } from 'react';
import { useToast } from '../components/ToastProvider';
import { ConfirmModal } from '../components/ConfirmModal';
import { useSearchParams } from 'react-router-dom';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { DeleteMessageModal } from '../components/DeleteMessageModal';
import { Tabs } from '../components/Tabs';
import { BotList } from '../components/BotList';
import { BotDetails } from '../components/BotDetails';
import { AddBotModal } from '../components/AddBotModal';
import { DeleteBotModal } from '../components/DeleteBotModal';
import { BroadcastsPage } from './BroadcastsPage';
import { WorkflowsPage } from './WorkflowsPage';
import { BroadcastDetails } from '../components/BroadcastDetails';
import { WorkflowEditor } from '../components/WorkflowEditor';
import { getBroadcastById, getBroadcastStatistics, sendBroadcast, deleteBroadcast, copyBroadcast, getWorkflowById } from '../utils/api';
import type { Broadcast, BroadcastStatistics } from '../types';
import { api, sendMessageWithMedia, markChatAsRead, deleteMessage, clearChatHistory, getBots, createBot, deleteBot, toggleBotStatus, getBotStatistics, getAllTags } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import type { Chat, Message, MessageReaction, Bot, BotStatistics, Tag, BotWorkflow } from '../types';
import { MessageType } from '../types';

type TabType = 'chats' | 'bots' | 'broadcasts' | 'workflows';

const isValidTab = (tab: string | null): tab is TabType => {
  return tab === 'chats' || tab === 'bots' || tab === 'broadcasts' || tab === 'workflows';
};

export const ChatsPage = () => {
  const { logout, admin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  
  // Tab state - читаем из URL или используем значение по умолчанию
  const tabFromUrl = searchParams.get('tab');
  const initialTab: TabType = isValidTab(tabFromUrl) ? tabFromUrl : 'chats';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  
  // Chats state
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<'none' | 'hot' | 'warm' | 'cold'>('none');
  const [tags, setTags] = useState<Tag[]>([]);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Bots state
  const [bots, setBots] = useState<(Bot & { chatCount?: number })[]>([]);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [botStatistics, setBotStatistics] = useState<BotStatistics | null>(null);
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<Bot | null>(null);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [isDeletingBot, setIsDeletingBot] = useState(false);

  // Broadcasts state
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [broadcastStatistics, setBroadcastStatistics] = useState<BroadcastStatistics | null>(null);

  // Workflows state
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<BotWorkflow | null>(null);
  const [broadcastToDeleteId, setBroadcastToDeleteId] = useState<string | null>(null);
  const [isDeletingBroadcast, setIsDeletingBroadcast] = useState(false);

  // Синхронизация таба с URL параметром при загрузке и браузерной навигации
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && isValidTab(tabFromUrl) && tabFromUrl !== activeTab) {
      // Если в URL есть валидный таб и он отличается от текущего - обновляем состояние
      setActiveTab(tabFromUrl);
    } else if (!tabFromUrl && activeTab !== 'chats') {
      // Если в URL нет параметра tab, но активный таб не 'chats', обновляем URL
      setSearchParams({ tab: activeTab }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Только при изменении searchParams (браузерная навигация)

  // При первой загрузке, если в URL нет параметра tab, добавляем его
  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: 'chats' }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Только при монтировании

  useEffect(() => {
    loadTags();
    loadChats();
    // Автообновление списка чатов каждые 5 секунд
    const chatsInterval = setInterval(() => {
      loadChats();
    }, 5000);

    return () => clearInterval(chatsInterval);
  }, []);

  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
    }
  }, [activeChatId]);

  // Автообновление сообщений активного чата каждые 3 секунды
  useEffect(() => {
    if (!activeChatId) return;

    const messagesInterval = setInterval(() => {
      loadMessages(activeChatId);
    }, 3000);

    return () => clearInterval(messagesInterval);
  }, [activeChatId]);

  // Автоматически выбираем первый чат при загрузке
  useEffect(() => {
    if (chats.length > 0 && !activeChatId && activeTab === 'chats') {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId, activeTab]);

  // Загрузка ботов при переключении на таб "Боты"
  useEffect(() => {
    if (activeTab === 'bots') {
      loadBots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Автоматически выбираем первого бота при загрузке
  useEffect(() => {
    if (bots.length > 0 && !activeBotId && activeTab === 'bots') {
      setActiveBotId(bots[0].id);
    }
  }, [bots, activeBotId, activeTab]);

  // Загрузка статистики при выборе бота
  useEffect(() => {
    if (activeBotId) {
      loadBotStatistics(activeBotId);
    }
  }, [activeBotId]);

  const loadTags = async () => {
    try {
      const allTags = await getAllTags();
      setTags(allTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadChats = async () => {
    try {
      // Всегда загружаем все чаты, фильтрация происходит на фронтенде
      const response = await api.get('/chats');
      interface ChatResponse {
        id: string;
        title?: string | null;
        user?: { 
          id?: string;
          firstName?: string; 
          startParam?: string | null;
          telegramId?: number;
          username?: string | null;
          lastName?: string | null;
        };
        lastMessage?: { text?: string };
        lastMessageAt?: string | null;
        bot?: { username?: string | null };
        isBotBlocked?: boolean;
        unreadCount?: number;
        tags?: Tag[];
      }
      const chatsData = response.data.map((chat: ChatResponse) => {
        const mappedChat = {
          id: chat.id,
          name: chat.title || chat.user?.firstName || 'Без названия',
          avatar: chat.user?.firstName?.[0]?.toUpperCase() || '?',
          lastMessage: chat.lastMessage?.text || '',
          lastMessageTime: chat.lastMessageAt
            ? new Date(chat.lastMessageAt)
            : undefined,
          unreadCount: chat.unreadCount || 0,
          botUsername: chat.bot?.username,
          isBotBlocked: chat.isBotBlocked || false,
          tags: chat.tags || [],
          user: chat.user ? {
            id: chat.user.id || '',
            telegramId: chat.user.telegramId || 0,
            username: chat.user.username || null,
            firstName: chat.user.firstName || '',
            lastName: chat.user.lastName || null,
            startParam: chat.user.startParam || null,
          } : undefined,
        };
        // Отладка: выводим startParam если он есть
        if (mappedChat.user?.startParam) {
          console.log(`[DEBUG] Chat ${mappedChat.name} has startParam:`, mappedChat.user.startParam);
        }
        return mappedChat;
      });
      setChats(chatsData);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Интерфейс для ответа от backend при создании сообщения
  interface CreateMessageResponse {
    id: string;
    chatId: string;
    text?: string | null;
    senderId: string;
    createdAt: string;
    messageType: MessageType;
    fileId?: string | null;
    fileUrl?: string | null;
    filePath?: string | null;
    fileName?: string | null;
    caption?: string | null;
    isFromAdmin?: boolean;
    isDelivered?: boolean;
    replyToMessageId?: string | null;
    replyToMessage?: {
      id: string;
      text?: string | null;
      senderId: string;
      isFromAdmin?: boolean;
      messageType: MessageType;
      fileId?: string | null;
      fileUrl?: string | null;
      fileName?: string | null;
      caption?: string | null;
    } | null;
  }

  // Функция для преобразования replyToMessage из backend формата
  const convertReplyToMessage = (replyMsg: {
    id: string;
    text?: string | null;
    senderId: string;
    isFromAdmin?: boolean;
    messageType: MessageType;
    fileId?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    caption?: string | null;
  } | null | undefined): Message['replyToMessage'] => {
    if (!replyMsg) return null;
    return {
      id: replyMsg.id,
      chatId: '', // Не нужно для отображения
      text: replyMsg.text || null,
      senderId: replyMsg.senderId,
      timestamp: new Date(), // Не критично для отображения
      isRead: false,
      messageType: replyMsg.messageType,
      fileId: replyMsg.fileId,
      fileUrl: replyMsg.fileUrl,
      fileName: replyMsg.fileName,
      caption: replyMsg.caption,
      isFromAdmin: replyMsg.isFromAdmin || false,
    };
  };

  const loadMessages = async (chatId: string) => {
    try {
      const response = await api.get(`/chats/${chatId}/messages`, {
        params: { page: 1, limit: 100 },
      });
      interface MessageResponse {
        id: string;
        chatId: string;
        text?: string | null;
        senderId: string;
        createdAt: string;
        messageType: MessageType;
        fileId?: string | null;
        fileUrl?: string | null;
        filePath?: string | null;
        fileName?: string | null;
        caption?: string | null;
        isFromAdmin?: boolean;
        isDelivered?: boolean;
        isRead?: boolean;
        reactions?: MessageReaction[];
        replyToMessageId?: string | null;
        replyToMessage?: {
          id: string;
          text?: string | null;
          senderId: string;
          isFromAdmin?: boolean;
          messageType: MessageType;
          fileId?: string | null;
          fileUrl?: string | null;
          fileName?: string | null;
          caption?: string | null;
        } | null;
      }
      interface MessagesResponse {
        messages: MessageResponse[];
      }
      
      const messagesData = (response.data as MessagesResponse).messages.map((msg: MessageResponse) => ({
        id: msg.id,
        chatId: msg.chatId,
        text: msg.text || '',
        senderId: msg.senderId,
        timestamp: new Date(msg.createdAt),
        isRead: msg.isRead || false,
        isDelivered: msg.isDelivered,
        messageType: msg.messageType || MessageType.TEXT,
        fileId: msg.fileId,
        fileUrl: msg.fileUrl,
        filePath: msg.filePath,
        fileName: msg.fileName,
        caption: msg.caption,
        isFromAdmin: msg.isFromAdmin,
        reactions: msg.reactions || [],
        replyToMessageId: msg.replyToMessageId || null,
        replyToMessage: convertReplyToMessage(msg.replyToMessage),
      }));
      setMessages((prev) => ({
        ...prev,
        [chatId]: messagesData,
      }));
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Подсчет непрочитанных сообщений по категориям
  const unreadCountsByCategory = useMemo(() => {
    const counts = {
      none: 0,
      hot: 0,
      warm: 0,
      cold: 0,
    };

    chats.forEach((chat) => {
      const unreadCount = chat.unreadCount || 0;
      
      if (!chat.tags || chat.tags.length === 0) {
        // Чат без тегов - категория "Без категории"
        counts.none += unreadCount;
      } else {
        // Чат с тегами - считаем для каждого типа тега
        chat.tags.forEach((tag) => {
          if (tag.tagType === 'hot') {
            counts.hot += unreadCount;
          } else if (tag.tagType === 'warm') {
            counts.warm += unreadCount;
          } else if (tag.tagType === 'cold') {
            counts.cold += unreadCount;
          }
        });
      }
    });

    return counts;
  }, [chats]);

  // Фильтрация чатов по поисковому запросу и тегам
  const filteredChats = useMemo(() => {
    let filtered = chats;

    // Фильтрация по тегам
    if (selectedTagFilter === 'none') {
      // "Без категории" - показываем только чаты без тегов
      filtered = filtered.filter((chat) => {
        return !chat.tags || chat.tags.length === 0;
      });
    } else {
      // Фильтруем по выбранному типу тега
      const tagType = selectedTagFilter;
      filtered = filtered.filter((chat) => {
        return chat.tags?.some((tag) => tag.tagType === tagType) || false;
      });
    }

    // Фильтрация по поисковому запросу
    if (!searchQuery.trim()) return filtered;
    
    const query = searchQuery.toLowerCase().trim();
    return filtered.filter((chat) => {
      // Поиск по названию чата
      if (chat.name.toLowerCase().includes(query)) return true;
      
      // Поиск по последнему сообщению
      if (chat.lastMessage.toLowerCase().includes(query)) return true;
      
      // Поиск по названию бота
      if (chat.botUsername && chat.botUsername.toLowerCase().includes(query)) return true;
      
      return false;
    });
  }, [chats, searchQuery, selectedTagFilter]);

  const activeChat = useMemo(() => {
    return chats.find((chat) => chat.id === activeChatId) || null;
  }, [chats, activeChatId]);

  const activeChatMessages = useMemo(() => {
    if (!activeChatId) return [];
    return (messages[activeChatId] || []).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [activeChatId, messages]);

  const handleChatUpdate = (updatedChat: Chat) => {
    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id === updatedChat.id) {
          // Объединяем обновленный чат с существующим, сохраняя все поля
          return {
            ...chat,
            ...updatedChat,
            // Убеждаемся, что lastMessageTime правильно обработан
            lastMessageTime: updatedChat.lastMessageTime || chat.lastMessageTime,
          };
        }
        return chat;
      })
    );
  };

  const handleChatSelect = async (chatId: string) => {
    setActiveChatId(chatId);
    
    // Триггер для скролла (работает даже если тот же чат)
    setScrollTrigger(prev => prev + 1);
    
    // Помечаем чат как прочитанный
    try {
      await markChatAsRead(chatId);
      
      // Обновляем счетчик непрочитанных в локальном состоянии
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
        )
      );
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  };

  const handleSendMessage = async (text: string, files?: File[], replyToMessageId?: string) => {
    if (!activeChatId) return;

    try {
      // Если есть файлы, отправляем каждый файл отдельным сообщением
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const response = await sendMessageWithMedia(
            activeChatId,
            '', // Пустой текст для файлов
            file,
            undefined, // messageType
            undefined, // caption
            // Отправляем reply только для первого файла
            i === 0 ? replyToMessageId : undefined
          );

          const newMessage: Message = {
            id: response.id,
            chatId: activeChatId,
            text: response.text,
            senderId: response.senderId,
            timestamp: new Date(response.createdAt),
            isRead: false,
            isDelivered: response.isDelivered,
            messageType: response.messageType || MessageType.TEXT,
            fileId: response.fileId,
            fileUrl: response.fileUrl,
            filePath: response.filePath,
            fileName: response.fileName,
            caption: response.caption,
            isFromAdmin: response.isFromAdmin,
            replyToMessageId: (response as CreateMessageResponse).replyToMessageId || null,
            replyToMessage: (response as CreateMessageResponse).replyToMessage ? convertReplyToMessage((response as CreateMessageResponse).replyToMessage) : null,
          };

          setMessages((prev) => ({
            ...prev,
            [activeChatId]: [...(prev[activeChatId] || []), newMessage],
          }));
        }
      }

      // Если есть текст, отправляем его отдельным сообщением
      // Но если уже отправляли файлы, не дублируем reply
      if (text.trim()) {
        const response = await sendMessageWithMedia(
          activeChatId,
          text,
          undefined, // file
          undefined, // messageType
          undefined, // caption
          // Отправляем reply только если не было файлов
          (files && files.length > 0) ? undefined : replyToMessageId
        );

      const newMessage: Message = {
          id: response.id,
        chatId: activeChatId,
          text: response.text,
          senderId: response.senderId,
          timestamp: new Date(response.createdAt),
        isRead: false,
          isDelivered: response.isDelivered,
          messageType: response.messageType || MessageType.TEXT,
          fileId: response.fileId,
          fileUrl: response.fileUrl,
          filePath: response.filePath,
          fileName: response.fileName,
          caption: response.caption,
          isFromAdmin: response.isFromAdmin,
          replyToMessageId: (response as CreateMessageResponse).replyToMessageId || null,
          replyToMessage: (response as CreateMessageResponse).replyToMessage ? convertReplyToMessage((response as CreateMessageResponse).replyToMessage) : null,
      };

      setMessages((prev) => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), newMessage],
      }));
      }

      // Обновляем счетчик непрочитанных сразу после отправки
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id === activeChatId) {
            return {
              ...chat,
              lastMessage: text || '[Медиа]',
              lastMessageTime: new Date(),
              unreadCount: 0, // Обнуляем счетчик при отправке админом
            };
          }
          return chat;
        })
      );

      // Перезагружаем список чатов для обновления порядка
      loadChats();
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Ошибка при отправке сообщения. Проверьте подключение.', 'error');
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    console.log('handleDeleteChat вызван для chatId:', chatId);
    try {
      console.log('Отправляем POST запрос на /chats/' + chatId + '/delete');
      const response = await api.post(`/chats/${chatId}/delete`);
      console.log('Ответ от сервера:', response.data);
      
      // Если удаленный чат был активным, выбираем следующий чат
      const wasActive = activeChatId === chatId;
      const chatIndex = chats.findIndex((chat) => chat.id === chatId);
      
      // Удаляем чат из списка
      const updatedChats = chats.filter((chat) => chat.id !== chatId);
      setChats(updatedChats);
      console.log('Чат удален из списка, осталось чатов:', updatedChats.length);
      
      // Удаляем сообщения чата
      setMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[chatId];
        return newMessages;
      });

      // Если удаленный чат был активным, выбираем следующий чат
      if (wasActive) {
        if (updatedChats.length > 0) {
          // Выбираем чат на той же позиции или последний доступный
          const nextIndex = Math.min(chatIndex, updatedChats.length - 1);
          setActiveChatId(updatedChats[nextIndex].id);
          console.log('Выбран следующий чат:', updatedChats[nextIndex].id);
        } else {
          setActiveChatId(null);
          console.log('Нет больше чатов, activeChatId установлен в null');
        }
      }

      // Логируем информацию об удалении
      if (response.data) {
        console.log(
          `Чат удален: ${response.data.deletedMessages || 0} сообщений, ${
            response.data.deletedFiles || 0
          } файлов`,
        );
      }
    } catch (error: unknown) {
      console.error('Error deleting chat:', error);
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error('Error response:', err.response);
      console.error('Error message:', err.message);
      throw error;
    }
  };

  const handleDeleteMessageClick = (messageId: string) => {
    setMessageToDelete(messageId);
  };

  const handleDeleteMessageConfirm = async () => {
    if (!messageToDelete || !activeChatId) return;

    setIsDeleting(true);
    try {
      await deleteMessage(messageToDelete);
      
      // Удаляем сообщение из локального состояния
      setMessages((prev) => ({
        ...prev,
        [activeChatId]: prev[activeChatId]?.filter((msg) => msg.id !== messageToDelete) || [],
      }));

      // Обновляем чаты, чтобы обновить lastMessage если нужно
      await loadChats();
      
      setMessageToDelete(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      showToast('Ошибка при удалении сообщения', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMessageUpdate = (updatedMessage: unknown) => {
    if (!activeChatId) return;

    // Преобразуем данные с бэкенда в формат фронтенда
    const backendMessage = updatedMessage as {
      id: string;
      chatId: string;
      text: string | null;
      senderId: string;
      createdAt: string | Date;
      isRead: boolean;
      isDelivered?: boolean;
      messageType: MessageType;
      fileId?: string | null;
      fileUrl?: string | null;
      filePath?: string | null;
      fileName?: string | null;
      caption?: string | null;
      isFromAdmin?: boolean;
      reactions?: MessageReaction[];
    };

    const messageWithDate: Message = {
      ...backendMessage,
      timestamp: backendMessage.createdAt instanceof Date 
        ? backendMessage.createdAt 
        : new Date(backendMessage.createdAt),
    };

    // Обновляем сообщение в локальном состоянии
    setMessages((prev) => ({
      ...prev,
      [activeChatId]: prev[activeChatId]?.map((msg) =>
        msg.id === backendMessage.id ? messageWithDate : msg
      ) || [],
    }));
  };

  const handleClearHistory = async (chatId: string) => {
    try {
      await clearChatHistory(chatId);
      
      // Очищаем сообщения из локального состояния
      setMessages((prev) => ({
        ...prev,
        [chatId]: [],
      }));

      // Обновляем чаты, чтобы обновить lastMessage
      await loadChats();
    } catch (error) {
      console.error('Error clearing chat history:', error);
      showToast('Ошибка при очистке истории чата', 'error');
    }
  };

  // Bot management functions
  const loadBots = async () => {
    try {
      const botsData = await getBots();
      
      // Получаем количество чатов для каждого бота
      const botsWithChatCount = await Promise.all(
        botsData.map(async (bot) => {
          const chatCount = chats.filter((chat) => chat.botUsername === bot.username).length;
          return { ...bot, chatCount };
        })
      );
      
      setBots(botsWithChatCount);
    } catch (error) {
      console.error('Error loading bots:', error);
    }
  };

  const loadBotStatistics = async (botId: string) => {
    try {
      const stats = await getBotStatistics(botId);
      setBotStatistics(stats);
    } catch (error) {
      console.error('Error loading bot statistics:', error);
      setBotStatistics(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    // Пользователь с ролью user видит только вкладку чатов
    if (admin?.role === 'user' && tab === 'bots') {
      return;
    }
    
    // Обновляем URL параметр
    setSearchParams({ tab });
    
    setActiveTab(tab);
    // Сбрасываем выбранные элементы при переключении табов
    if (tab !== 'broadcasts') {
      setActiveBroadcastId(null);
      setSelectedBroadcast(null);
      setBroadcastStatistics(null);
    }
    // При открытии таба "Рассылки" всегда очищаем выбор
    if (tab === 'broadcasts') {
      setActiveBroadcastId(null);
      setSelectedBroadcast(null);
      setBroadcastStatistics(null);
    }
    if (tab !== 'bots') {
      setActiveBotId(null);
      setBotStatistics(null);
    }
    if (tab !== 'chats') {
      setActiveChatId(null);
    }
    if (tab !== 'workflows') {
      setActiveWorkflowId(null);
      setSelectedWorkflow(null);
    }
  };

  const handleBroadcastSelect = async (id: string) => {
    setActiveBroadcastId(id);
    try {
      const [broadcast, statistics] = await Promise.all([
        getBroadcastById(id),
        getBroadcastStatistics(id),
      ]);
      setSelectedBroadcast(broadcast);
      setBroadcastStatistics(statistics);
    } catch (error) {
      console.error('Error loading broadcast details:', error);
    }
  };

  const handleWorkflowSelect = async (id: string) => {
    try {
      setActiveWorkflowId(id);
      const workflow = await getWorkflowById(id);
      console.log('[ChatsPage] Workflow loaded:', workflow);
      setSelectedWorkflow(workflow);
    } catch (error) {
      console.error('[ChatsPage] Error loading workflow details:', error);
      showToast('Ошибка при загрузке сценария. Проверьте консоль для деталей.', 'error');
      setActiveWorkflowId(null);
      setSelectedWorkflow(null);
    }
  };

  const handleSendBroadcast = async (id: string) => {
    try {
      await sendBroadcast(id);
      if (activeBroadcastId === id) {
        const [broadcast, statistics] = await Promise.all([
          getBroadcastById(id),
          getBroadcastStatistics(id),
        ]);
        setSelectedBroadcast(broadcast);
        setBroadcastStatistics(statistics);
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      showToast('Ошибка при отправке рассылки', 'error');
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    setBroadcastToDeleteId(id);
  };

  const confirmDeleteBroadcast = async () => {
    if (!broadcastToDeleteId) return;
    setIsDeletingBroadcast(true);
    try {
      await deleteBroadcast(broadcastToDeleteId);
      
      // Очищаем состояние если удаляемая рассылка была выбрана
      if (activeBroadcastId === broadcastToDeleteId) {
        setActiveBroadcastId(null);
        setSelectedBroadcast(null);
        setBroadcastStatistics(null);
      }
      showToast('Рассылка удалена', 'success');
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Ошибка при удалении рассылки';
      showToast(errorMessage || 'Ошибка при удалении рассылки', 'error');
    } finally {
      setIsDeletingBroadcast(false);
      setBroadcastToDeleteId(null);
    }
  };

  const handleCopyBroadcast = async (id: string) => {
    try {
      const copiedBroadcast = await copyBroadcast(id);
      showToast('Рассылка успешно скопирована!', 'success');
      // Выбираем скопированную рассылку
      await handleBroadcastSelect(copiedBroadcast.id);
    } catch (error) {
      console.error('Error copying broadcast:', error);
      showToast('Ошибка при копировании рассылки', 'error');
    }
  };

  const handleBotSelect = (botId: string) => {
    setActiveBotId(botId);
  };

  const handleAddBot = () => {
    setIsAddBotModalOpen(true);
  };

  const handleAddBotConfirm = async (token: string) => {
    setIsAddingBot(true);
    try {
      await createBot(token);
      await loadBots();
      setIsAddBotModalOpen(false);
    } catch (error) {
      console.error('Error adding bot:', error);
      showToast('Ошибка при добавлении бота. Проверьте токен.', 'error');
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleToggleBotStatus = async (botId: string) => {
    try {
      const updatedBot = await toggleBotStatus(botId);
      
      // Обновляем бота в локальном состоянии
      setBots(prevBots => 
        prevBots.map(bot => bot.id === botId ? { ...bot, isActive: updatedBot.isActive } : bot)
      );
    } catch (error) {
      console.error('Error toggling bot status:', error);
      throw error;
    }
  };

  const handleDeleteBotClick = () => {
    const bot = bots.find((b) => b.id === activeBotId);
    if (bot) {
      setBotToDelete(bot);
    }
  };

  const handleDeleteBotConfirm = async () => {
    if (!botToDelete) return;

    setIsDeletingBot(true);
    try {
      await deleteBot(botToDelete.id);
      
      // Обновляем список ботов
      await loadBots();
      
      // Сбрасываем выбранного бота
      if (activeBotId === botToDelete.id) {
        setActiveBotId(null);
        setBotStatistics(null);
      }
      
      setBotToDelete(null);
    } catch (error) {
      console.error('Error deleting bot:', error);
      showToast('Ошибка при удалении бота', 'error');
    } finally {
      setIsDeletingBot(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Хедер всегда видим */}
      <div className="w-full p-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between flex-shrink-0">
        <h1 className="text-white text-xl font-semibold">Чаты</h1>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-gray-700 transition-colors"
        >
          Выйти
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <>
          <div className="w-1/3 min-w-[320px] max-w-[400px] flex flex-col border-r border-gray-700">
            {/* Табы */}
            <Tabs activeTab={activeTab} onTabChange={handleTabChange} role={admin?.role} />
            
            {/* Контент в зависимости от активного таба */}
            {activeTab === 'chats' ? (
                isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-white">Загрузка чатов...</div>
                </div>
              ) : (
                <ChatList
                    chats={filteredChats}
                  activeChatId={activeChatId}
                  onChatSelect={handleChatSelect}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    tags={tags}
                    selectedTagFilter={selectedTagFilter}
                    onTagFilterChange={setSelectedTagFilter}
                    unreadCounts={unreadCountsByCategory}
                  />
                )
              ) : activeTab === 'broadcasts' ? (
                <BroadcastsPage 
                  activeBroadcastId={activeBroadcastId}
                  onBroadcastSelect={handleBroadcastSelect}
                  onBroadcastDeleted={(id) => {
                    // Очищаем состояние если удаляемая рассылка была выбрана
                    if (activeBroadcastId === id) {
                      setActiveBroadcastId(null);
                      setSelectedBroadcast(null);
                      setBroadcastStatistics(null);
                    }
                  }}
                  onBroadcastCopied={(id) => {
                    handleBroadcastSelect(id);
                  }}
                />
              ) : activeTab === 'workflows' ? (
                <WorkflowsPage 
                  activeWorkflowId={activeWorkflowId}
                  onWorkflowSelect={handleWorkflowSelect}
                  onWorkflowDeleted={(id) => {
                    if (activeWorkflowId === id) {
                      setActiveWorkflowId(null);
                      setSelectedWorkflow(null);
                    }
                  }}
                />
              ) : (
                <BotList
                  bots={bots}
                  activeBotId={activeBotId}
                  onBotSelect={handleBotSelect}
                  onAddBot={handleAddBot}
                />
              )}
            </div>
            
            {/* Правая панель */}
            <div className="flex-1 h-full overflow-hidden">
              {activeTab === 'chats' ? (
                <ChatWindow
                  chat={activeChat}
                  messages={activeChatMessages}
                  onSendMessage={handleSendMessage}
                  onDeleteChat={handleDeleteChat}
                  onClearHistory={handleClearHistory}
                  onDeleteMessage={handleDeleteMessageClick}
                  onMessageUpdate={handleMessageUpdate}
                  onChatUpdate={handleChatUpdate}
                  onTagFilterChange={setSelectedTagFilter}
                  onReloadChats={loadChats}
                  scrollTrigger={scrollTrigger}
                />
              ) : activeTab === 'broadcasts' ? (
                selectedBroadcast ? (
                  <BroadcastDetails
                    broadcast={selectedBroadcast}
                    statistics={broadcastStatistics}
                    onSend={() => selectedBroadcast?.id && handleSendBroadcast(selectedBroadcast.id)}
                    onDelete={() => selectedBroadcast?.id && handleDeleteBroadcast(selectedBroadcast.id)}
                    onCopy={() => selectedBroadcast?.id && handleCopyBroadcast(selectedBroadcast.id)}
                    onRefresh={async () => {
                      if (activeBroadcastId) {
                        const [broadcast, statistics] = await Promise.all([
                          getBroadcastById(activeBroadcastId),
                          getBroadcastStatistics(activeBroadcastId),
                        ]);
                        setSelectedBroadcast(broadcast);
                        setBroadcastStatistics(statistics);
                      }
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-900 text-gray-500">
                    <p>Выберите рассылку для просмотра деталей</p>
                  </div>
                )
              ) : activeTab === 'workflows' ? (
                selectedWorkflow ? (
                  <WorkflowEditor 
                    workflow={selectedWorkflow} 
                    onClose={async () => {
                      setActiveWorkflowId(null);
                      setSelectedWorkflow(null);
                    }} 
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-900 text-gray-500">
                    <p>Выберите сценарий для редактирования</p>
                  </div>
                )
              ) : (
                <BotDetails
                  bot={bots.find((b) => b.id === activeBotId) || null}
                  statistics={botStatistics}
                  onDeleteBot={handleDeleteBotClick}
                  onToggleStatus={handleToggleBotStatus}
                />
              )}
            </div>
          </>
        </div>
      
      {/* Модальные окна */}
      <DeleteMessageModal
        isOpen={!!messageToDelete}
        onClose={() => setMessageToDelete(null)}
        onConfirm={handleDeleteMessageConfirm}
        isLoading={isDeleting}
      />
      
      <AddBotModal
        isOpen={isAddBotModalOpen}
        onClose={() => setIsAddBotModalOpen(false)}
        onConfirm={handleAddBotConfirm}
        isLoading={isAddingBot}
      />
      
      <DeleteBotModal
        isOpen={!!botToDelete}
        onClose={() => setBotToDelete(null)}
        onConfirm={handleDeleteBotConfirm}
        isLoading={isDeletingBot}
        botName={botToDelete?.username ? `@${botToDelete.username}` : ''}
      />
      <ConfirmModal
        isOpen={!!broadcastToDeleteId}
        title="Удалить рассылку?"
        message="Вы уверены, что хотите удалить эту рассылку?"
        confirmText="Удалить"
        cancelText="Отменить"
        isLoading={isDeletingBroadcast}
        onConfirm={confirmDeleteBroadcast}
        onCancel={() => setBroadcastToDeleteId(null)}
      />
    </div>
  );
};

