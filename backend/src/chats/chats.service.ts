import { Injectable, NotFoundException, forwardRef, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Chat } from '../entities/Chat.entity';
import { Message, MessageType } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { MessageReaction } from '../entities/MessageReaction.entity';
import { ChatUnreadCount } from '../entities/ChatUnreadCount.entity';
import { Tag } from '../entities/Tag.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { deleteFiles } from '../utils/file-storage.util';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  /**
   * Возвращает чат только если бот активен.
   * Используем NotFound, чтобы скрыть чаты отключенных ботов.
   */
  private async getActiveChatOrThrow(chatId: string, relations: string[] = []) {
    const uniqueRelations = Array.from(new Set([...relations, 'bot']));
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: uniqueRelations,
    });

    // Скрываем чаты отключенных ботов
    if (!chat || !chat.bot || chat.bot.isActive !== true) {
      throw new NotFoundException('Чат не найден');
    }

    return chat;
  }

  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private messageReadRepository: Repository<MessageRead>,
    @InjectRepository(MessageReaction)
    private messageReactionRepository: Repository<MessageReaction>,
    @InjectRepository(ChatUnreadCount)
    private chatUnreadCountRepository: Repository<ChatUnreadCount>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
  ) {}

  async findAll(tagId?: string) {
    this.logger.log(`[DEBUG_CHATS] findAll called with tagId: ${tagId}`);
    const queryBuilder = this.chatRepository
      .createQueryBuilder('chat')
      .innerJoinAndSelect('chat.bot', 'bot')
      .leftJoinAndSelect('chat.user', 'user')
      .addSelect('user.startParam')
      .leftJoinAndSelect('chat.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.sender', 'sender')
      .leftJoinAndSelect('chat.tags', 'tags')
      .where('bot.isActive = :isActive', { isActive: true });

    if (tagId) {
      queryBuilder.andWhere('tags.id = :tagId', { tagId });
    }

    const chats = await queryBuilder
      .orderBy('chat.lastMessageAt', 'DESC')
      .getMany();

    if (chats.length > 0) {
      this.logger.log(`[DEBUG_CHATS] Found ${chats.length} chats.`);
      const chatWithUser = chats.find(c => c.user);
      if (chatWithUser) {
         this.logger.log(`[DEBUG_CHATS] First user: ${JSON.stringify(chatWithUser.user)}`);
      } else {
         this.logger.log('[DEBUG_CHATS] No chats with user relation found.');
      }
    } else {
       this.logger.log('[DEBUG_CHATS] No chats found.');
    }

    // Добавляем количество непрочитанных сообщений для каждого чата
    // Считаем только сообщения от пользователей (не от админов)
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await this.messageRepository.count({
          where: {
            chatId: chat.id,
            isFromAdmin: false,
            isRead: false, // Считаем непрочитанные сообщения от пользователей
          },
        });

        return {
          ...chat,
          unreadCount,
        };
      }),
    );

    return chatsWithUnread;
  }

  async findMessagesByChatId(chatId: string, dto: GetMessagesDto) {
    await this.getActiveChatOrThrow(chatId);

    const page = dto.page || 1;
    const limit = dto.limit || 50;
    const skip = (page - 1) * limit;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { chatId },
      relations: ['sender', 'chat', 'replyToMessage', 'replyToMessage.sender'],
      order: {
        createdAt: 'DESC',
      },
      skip,
      take: limit,
    });

    return {
      messages: messages.reverse(), // Возвращаем в хронологическом порядке
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Пометить все сообщения чата как прочитанные (для всех админов)
  async markChatAsRead(chatId: string) {
    await this.getActiveChatOrThrow(chatId);

    // Помечаем все непрочитанные сообщения от пользователя как прочитанные
    await this.messageRepository.update(
      {
        chatId,
        isFromAdmin: false,
        isRead: false,
      },
      {
        isRead: true,
      },
    );

    return { success: true };
  }

  async createMessage(
    chatId: string,
    adminId: string,
    dto: CreateMessageDto,
    file?: Express.Multer.File,
  ) {
    console.log(`[ChatsService] createMessage called. Text: "${dto.text}", MessageType: "${dto.messageType}", File: ${!!file}`);
    
    const chat = await this.getActiveChatOrThrow(chatId, ['user']);

    // Добавляем префикс "Оператор Legal NDS" к сообщениям от админа
    const operatorPrefix = '<b>Оператор Legal NDS</b>\n\n';

    // Сохраняем оригинальный текст для логирования
    const originalText = dto.text;
    const originalCaption = dto.caption;

    // ВСЕГДА применяем префикс к тексту сообщения перед отправкой
    // Функция для добавления префикса, если его еще нет
    const ensurePrefix = (text: string | null | undefined): string => {
      if (!text || !text.trim()) {
        return operatorPrefix.trim();
      }
      const trimmed = text.trim();
      if (trimmed.includes('Оператор Legal NDS')) {
        return trimmed; // Префикс уже есть
      }
      return operatorPrefix + trimmed;
    };

    // Применяем префикс к тексту сообщения
    if (dto.text) {
      dto.text = ensurePrefix(dto.text);
      console.log(`[OPERATOR_PREFIX] Text after prefix: "${dto.text.substring(0, 100)}..."`);
    }

    // Применяем префикс к подписи медиа
    if (dto.caption) {
      dto.caption = ensurePrefix(dto.caption);
      console.log(`[OPERATOR_PREFIX] Caption after prefix: "${dto.caption.substring(0, 100)}..."`);
    }

    // Если это ответ на сообщение, получаем telegramMessageId оригинального сообщения
    let replyToTelegramMessageId: number | undefined;
    if (dto.replyToMessageId) {
      console.log('🔗 Reply to message ID:', dto.replyToMessageId);
      const replyToMessage = await this.messageRepository.findOne({
        where: { id: dto.replyToMessageId },
      });
      if (replyToMessage) {
        replyToTelegramMessageId = Number(replyToMessage.telegramMessageId);
        console.log('✅ Found original message, Telegram ID:', replyToTelegramMessageId);
      } else {
        console.log('❌ Original message not found in DB');
      }
    }

    // Определяем тип сообщения
    let messageType = MessageType.TEXT;
    let fileId: string | null = null;
    let caption: string | null = null;

    if (dto.messageType) {
      messageType = dto.messageType;
    } else if (file) {
      // Определяем тип на основе MIME типа файла
      if (file.mimetype.startsWith('image/')) {
        messageType = MessageType.PHOTO;
      } else if (file.mimetype.startsWith('video/')) {
        messageType = MessageType.VIDEO;
      } else if (file.mimetype.startsWith('audio/')) {
        if (file.mimetype === 'audio/ogg' || file.mimetype === 'audio/mpeg') {
          messageType = MessageType.VOICE;
        } else {
          messageType = MessageType.AUDIO;
        }
      } else {
        messageType = MessageType.DOCUMENT;
      }
    }

    // Используем dto.caption (который уже содержит префикс)
    if (dto.caption) {
      caption = dto.caption;
    }

    // Функция для гарантированного добавления префикса перед отправкой
    const ensurePrefixBeforeSend = (text: string | null | undefined): string => {
      if (!text || !text.trim()) {
        return operatorPrefix.trim();
      }
      const trimmed = text.trim();
      if (trimmed.includes('Оператор Legal NDS')) {
        return trimmed;
      }
      return operatorPrefix + trimmed;
    };

    // Отправляем сообщение через Telegram бота
    let sentMessage: any;
    try {
      if (messageType === MessageType.TEXT && dto.text) {
        // Гарантируем наличие префикса перед отправкой
        const finalText = ensurePrefixBeforeSend(dto.text);
        console.log(`[OPERATOR_PREFIX] Sending text message to Telegram: "${finalText.substring(0, 150)}..."`);
        sentMessage = await this.telegramService.sendMessage(
          chat.botId,
          chat.telegramChatId,
          finalText,
          replyToTelegramMessageId,
        );
      } else if (file) {
        // Используем буфер файла для отправки
        const inputFile = { source: file.buffer, filename: file.originalname };
        
        switch (messageType) {
          case MessageType.PHOTO:
            // Гарантируем наличие префикса в подписи перед отправкой
            const photoCaption = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending photo with caption: "${photoCaption.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendPhoto(
              chat.botId,
              chat.telegramChatId,
              inputFile as any,
              photoCaption,
              replyToTelegramMessageId,
            );
            fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
            break;
          case MessageType.VIDEO:
            const videoCaption = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending video with caption: "${videoCaption.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendVideo(
              chat.botId,
              chat.telegramChatId,
              inputFile as any,
              videoCaption,
              replyToTelegramMessageId,
            );
            fileId = sentMessage.video.file_id;
            break;
          case MessageType.VOICE:
            // Voice не поддерживает caption, но можем добавить префикс как текст после отправки
            sentMessage = await this.telegramService.sendVoice(
              chat.botId,
              chat.telegramChatId,
              inputFile as any,
              replyToTelegramMessageId,
            );
            fileId = sentMessage.voice.file_id;
            break;
          case MessageType.AUDIO:
            const audioCaption = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending audio with caption: "${audioCaption.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendAudio(
              chat.botId,
              chat.telegramChatId,
              inputFile as any,
              audioCaption,
              replyToTelegramMessageId,
            );
            fileId = sentMessage.audio.file_id;
            break;
          case MessageType.DOCUMENT:
            const documentCaption = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending document with caption: "${documentCaption.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendDocument(
              chat.botId,
              chat.telegramChatId,
              inputFile as any,
              documentCaption,
              replyToTelegramMessageId,
            );
            fileId = sentMessage.document.file_id;
            break;
          case MessageType.ANIMATION:
            const animationCaption = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending animation with caption: "${animationCaption.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendAnimation(
              chat.botId,
              chat.telegramChatId,
              inputFile as any,
              animationCaption,
              replyToTelegramMessageId,
            );
            fileId = sentMessage.animation.file_id;
            break;
        }
      } else if (dto.fileId) {
        // Используем существующий fileId из Telegram
        fileId = dto.fileId;
        switch (messageType) {
          case MessageType.PHOTO:
            const photoCaptionFileId = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending photo (fileId) with caption: "${photoCaptionFileId.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendPhoto(
              chat.botId,
              chat.telegramChatId,
              dto.fileId,
              photoCaptionFileId,
              replyToTelegramMessageId,
            );
            break;
          case MessageType.VIDEO:
            const videoCaptionFileId = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending video (fileId) with caption: "${videoCaptionFileId.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendVideo(
              chat.botId,
              chat.telegramChatId,
              dto.fileId,
              videoCaptionFileId,
              replyToTelegramMessageId,
            );
            break;
          case MessageType.VOICE:
            sentMessage = await this.telegramService.sendVoice(
              chat.botId,
              chat.telegramChatId,
              dto.fileId,
              replyToTelegramMessageId,
            );
            break;
          case MessageType.AUDIO:
            const audioCaptionFileId = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending audio (fileId) with caption: "${audioCaptionFileId.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendAudio(
              chat.botId,
              chat.telegramChatId,
              dto.fileId,
              audioCaptionFileId,
              replyToTelegramMessageId,
            );
            break;
          case MessageType.DOCUMENT:
            const documentCaptionFileId = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending document (fileId) with caption: "${documentCaptionFileId.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendDocument(
              chat.botId,
              chat.telegramChatId,
              dto.fileId,
              documentCaptionFileId,
              replyToTelegramMessageId,
            );
            break;
          case MessageType.ANIMATION:
            const animationCaptionFileId = ensurePrefixBeforeSend(caption);
            console.log(`[OPERATOR_PREFIX] Sending animation (fileId) with caption: "${animationCaptionFileId.substring(0, 150)}..."`);
            sentMessage = await this.telegramService.sendAnimation(
              chat.botId,
              chat.telegramChatId,
              dto.fileId,
              animationCaptionFileId,
              replyToTelegramMessageId,
            );
            break;
        }
      }
    } catch (error) {
      console.error('❌ Ошибка при отправке сообщения через Telegram:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Проверяем, заблокирован ли бот пользователем
      if (error.response && error.response.description && 
          error.response.description.includes('bot was blocked by the user')) {
        // Помечаем чат как заблокированный
        await this.chatRepository.update(chatId, { isBotBlocked: true });
        throw new Error('Бот заблокирован пользователем');
      }
      
      // Передаем более подробную информацию об ошибке
      const errorMessage = error.response?.description || error.message || 'Не удалось отправить сообщение через Telegram';
      throw new Error(errorMessage);
    }

    // Если сообщение успешно отправлено, помечаем что бот не заблокирован
    if (chat.isBotBlocked) {
      await this.chatRepository.update(chatId, { isBotBlocked: false });
    }

    // Получаем URL файла если есть fileId
    let fileUrl: string | null = null;
    if (fileId) {
      fileUrl = await this.telegramService.getFileUrl(chat.botId, fileId);
    }

    // Сохраняем сообщение в БД
    // Используем текст/подпись с префиксом для сохранения
    const textForDb = messageType === MessageType.TEXT ? (dto.text || '') : null;
    const captionForDb = messageType !== MessageType.TEXT ? (caption || null) : null;
    
    const message = this.messageRepository.create({
      chatId,
      botId: chat.botId,
      senderId: chat.userId, // Админ пишет от имени бота
      text: textForDb,
      caption: captionForDb,
      messageType,
      fileId,
      fileUrl,
      fileName: file ? file.originalname : null,
      telegramMessageId: sentMessage.message_id,
      isFromAdmin: true,
      isFromBot: false, // сообщения из админки видны
      isDelivered: true, // Сообщение доставлено если Telegram API вернул успех
      replyToMessageId: dto.replyToMessageId || null,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Обновляем последнее сообщение в чате
    await this.chatRepository.update(chatId, {
      lastMessageId: savedMessage.id,
      lastMessageAt: new Date(),
    });

    return this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender', 'chat'],
    });
  }

  async deleteChat(chatId: string) {
    console.log(`Попытка удалить чат: ${chatId}`);
    
    try {
      await this.getActiveChatOrThrow(chatId);

      console.log(`Чат найден, начинаем удаление: ${chatId}`);

    // Получаем все сообщения чата с информацией о файлах
    const messages = await this.messageRepository.find({
      where: { chatId },
      select: ['id', 'filePath', 'fileUrl', 'messageType'],
    });
    const messageIds = messages.map((m) => m.id);

    // Собираем пути к файлам для удаления
    const filePaths: string[] = [];
    const uniquePaths = new Set<string>();

    messages.forEach((message) => {
      // Добавляем filePath если он есть
      if (message.filePath && message.filePath.trim() !== '') {
        uniquePaths.add(message.filePath);
      }
      // Если fileUrl указывает на локальный файл (не HTTP/HTTPS), также добавляем его
      if (
        message.fileUrl &&
        message.fileUrl.trim() !== '' &&
        !message.fileUrl.startsWith('http://') &&
        !message.fileUrl.startsWith('https://')
      ) {
        uniquePaths.add(message.fileUrl);
      }
    });

    filePaths.push(...Array.from(uniquePaths));

    // Удаляем физические файлы перед удалением из БД
    if (filePaths.length > 0) {
      console.log(`Попытка удалить ${filePaths.length} файлов для чата ${chatId}`);
      try {
        await deleteFiles(filePaths);
        console.log(
          `Удалено ${filePaths.length} файлов для чата ${chatId}`,
        );
      } catch (error) {
        console.error('Ошибка при удалении файлов:', error);
        // Продолжаем удаление даже если не удалось удалить файлы
        // Файлы могут быть уже удалены или находиться в другом месте
      }
    } else {
      console.log(`Нет файлов для удаления для чата ${chatId}`);
    }

    // ВАЖНО: Сначала обнуляем last_message_id в чате, чтобы избежать ошибки внешнего ключа
    console.log(`Обнуляем last_message_id для чата ${chatId}`);
    await this.chatRepository.update(chatId, { lastMessage: null });

    // Удаляем связанные данные (каскадное удаление)
    // MessageRead удалятся автоматически благодаря ON DELETE CASCADE при удалении сообщений
    if (messageIds.length > 0) {
      // Явно удаляем записи о прочтении сообщений для надежности
      console.log(`Удаляем ${messageIds.length} записей MessageRead`);
      await this.messageReadRepository.delete({ messageId: In(messageIds) });
    }

    // Удаляем счетчики непрочитанных сообщений
    console.log(`Удаляем счетчики непрочитанных для чата ${chatId}`);
    await this.chatUnreadCountRepository.delete({ chatId });

    // Удаляем все сообщения чата
    // Благодаря ON DELETE CASCADE в БД, связанные записи (MessageRead) удалятся автоматически
    console.log(`Удаляем все сообщения чата ${chatId}`);
    await this.messageRepository.delete({ chatId });

    // Удаляем чат
    // Благодаря ON DELETE CASCADE в БД, связанные записи (Message, ChatUnreadCount) уже удалены
    console.log(`Удаляем чат ${chatId}`);
    await this.chatRepository.delete(chatId);

    console.log(
      `Чат ${chatId} удален: ${messages.length} сообщений, ${filePaths.length} файлов`,
    );

      return {
        message: 'Чат успешно удален',
        deletedMessages: messages.length,
        deletedFiles: filePaths.length,
      };
    } catch (error) {
      console.error(`Критическая ошибка при удалении чата ${chatId}:`, error);
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<{ message: string }> {
    // Находим сообщение с релейшенами
    const messageToDelete = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chat', 'bot'],
    });

    if (!messageToDelete) {
      throw new Error('Сообщение не найдено');
    }

    // Удаляем из Telegram, если есть telegramMessageId
    if (messageToDelete.telegramMessageId && messageToDelete.chat && messageToDelete.bot) {
      try {
        await this.telegramService.deleteMessage(
          messageToDelete.bot.id,
          Number(messageToDelete.chat.telegramChatId),
          messageToDelete.telegramMessageId,
        );
      } catch (error) {
        console.error('Ошибка при удалении сообщения из Telegram:', error);
        // Продолжаем удаление из БД даже если не удалось удалить из Telegram
      }
    }

    // Удаляем файл, если он есть
    if (messageToDelete.filePath) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'uploads', messageToDelete.filePath);
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Ошибка при удалении файла:', error);
      }
    }

    // Проверяем, является ли это последним сообщением в чате
    const chat = messageToDelete.chat;
    if (chat && chat.lastMessageId === messageId) {
      // Находим предпоследнее сообщение
      const allMessages = await this.messageRepository.find({
        where: { chatId: chat.id },
        order: { createdAt: 'DESC' },
        take: 2,
      });
      
      // Берем второе сообщение (первое - это удаляемое)
      const previousMessage = allMessages.length > 1 ? allMessages[1] : null;

      // Обновляем lastMessage в чате
      chat.lastMessageId = previousMessage ? previousMessage.id : null;
      chat.lastMessageAt = previousMessage ? previousMessage.createdAt : chat.createdAt;
      await this.chatRepository.save(chat);
    }

    // Удаляем сообщение из БД
    await this.messageRepository.delete(messageId);

    return { message: 'Сообщение успешно удалено' };
  }

  async clearChatHistory(chatId: string): Promise<{ message: string; deletedMessages: number }> {
    // Находим чат
    const chat = await this.getActiveChatOrThrow(chatId);

    // Получаем все сообщения чата
    const messages = await this.messageRepository.find({
      where: { chatId },
    });

    // Удаляем сообщения из Telegram
    for (const message of messages) {
      if (message.telegramMessageId && chat.bot) {
        try {
          await this.telegramService.deleteMessage(
            chat.bot.id,
            Number(chat.telegramChatId),
            message.telegramMessageId,
          );
        } catch (error) {
          console.error(`Ошибка при удалении сообщения ${message.id} из Telegram:`, error);
        }
      }

      // Удаляем файл, если есть
      if (message.filePath) {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const filePath = path.join(process.cwd(), 'uploads', message.filePath);
          await fs.unlink(filePath);
        } catch (error) {
          console.error('Ошибка при удалении файла:', error);
        }
      }
    }

    // Сбрасываем lastMessage в чате
    chat.lastMessageId = null;
    chat.lastMessageAt = chat.createdAt;
    await this.chatRepository.save(chat);

    // Удаляем все сообщения из БД
    await this.messageRepository.delete({ chatId });

    return {
      message: 'История чата успешно очищена',
      deletedMessages: messages.length,
    };
  }

  // Методы для работы с реакциями
  async addReaction(messageId: string, adminId: string, addReactionDto: AddReactionDto) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chat', 'chat.bot', 'reactions'],
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    // Проверяем, не поставил ли админ уже эту реакцию
    const existingReaction = message.reactions?.find(
      (r) => r.adminId === adminId && r.emoji === addReactionDto.emoji,
    );

    if (existingReaction) {
      // Если реакция уже есть, удаляем её (toggle для конкретной реакции)
      await this.messageReactionRepository.remove(existingReaction);
    } else {
      // Создаем новую реакцию
      const reaction = this.messageReactionRepository.create({
        messageId,
        adminId,
        emoji: addReactionDto.emoji,
        isFromTelegram: false,
      });

      await this.messageReactionRepository.save(reaction);
    }

    // Получаем обновленное сообщение со всеми реакциями
    const updatedMessage = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['reactions'],
    });

    // Отправляем ВСЕ реакции в Telegram (Telegram API требует все реакции сразу)
    if (message.chat?.bot && updatedMessage) {
      try {
        // Собираем уникальные эмодзи из всех реакций
        const uniqueEmojis = Array.from(
          new Set(updatedMessage.reactions?.map((r) => r.emoji) || [])
        );

        // Отправляем все реакции в Telegram
        const telegramReactions = uniqueEmojis.map((emoji) => ({
          type: 'emoji' as const,
          emoji: emoji,
        }));

        await this.telegramService.setMessageReaction(
          message.chat.bot.id,
          Number(message.chat.telegramChatId),
          message.telegramMessageId,
          telegramReactions,
        );
      } catch (error) {
        console.error('Ошибка при отправке реакций в Telegram:', error);
      }
    }

    return updatedMessage;
  }

  async removeReaction(messageId: string, reactionId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chat', 'chat.bot', 'reactions'],
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    const reaction = await this.messageReactionRepository.findOne({
      where: { id: reactionId, messageId },
    });

    if (!reaction) {
      throw new NotFoundException('Реакция не найдена');
    }

    await this.messageReactionRepository.remove(reaction);

    // Получаем обновленное сообщение со всеми оставшимися реакциями
    const updatedMessage = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['reactions'],
    });

    // Отправляем ВСЕ оставшиеся реакции в Telegram
    if (message.chat?.bot && updatedMessage) {
      try {
        // Собираем уникальные эмодзи из всех оставшихся реакций
        const uniqueEmojis = Array.from(
          new Set(updatedMessage.reactions?.map((r) => r.emoji) || [])
        );

        // Отправляем все оставшиеся реакции в Telegram
        const telegramReactions = uniqueEmojis.map((emoji) => ({
          type: 'emoji' as const,
          emoji: emoji,
        }));

        await this.telegramService.setMessageReaction(
          message.chat.bot.id,
          Number(message.chat.telegramChatId),
          message.telegramMessageId,
          telegramReactions,
        );
      } catch (error) {
        console.error('Ошибка при отправке реакций в Telegram:', error);
      }
    }

    return updatedMessage;
  }

  // Методы для работы с тегами
  async getAllTags() {
    return this.tagRepository.find({
      order: {
        tagType: 'ASC',
      },
    });
  }

  async addTagToChat(chatId: string, tagId: string) {
    const chat = await this.getActiveChatOrThrow(chatId, ['tags']);

    const tag = await this.tagRepository.findOne({
      where: { id: tagId },
    });

    if (!tag) {
      throw new NotFoundException('Тег не найден');
    }

    // Проверяем, не добавлен ли уже тег
    if (!chat.tags.some((t) => t.id === tagId)) {
      chat.tags.push(tag);
      await this.chatRepository.save(chat);
    }

    return this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['tags'],
    });
  }

  async removeTagFromChat(chatId: string, tagId: string) {
    const chat = await this.getActiveChatOrThrow(chatId, ['tags']);

    chat.tags = chat.tags.filter((tag) => tag.id !== tagId);
    await this.chatRepository.save(chat);

    return this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['tags'],
    });
  }
}

