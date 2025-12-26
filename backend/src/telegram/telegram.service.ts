import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { Telegraf, Context } from 'telegraf';
import { Message as TelegramMessage, Chat as TelegramChat } from 'telegraf/typings/core/types/typegram';
import { Bot } from '../entities/Bot.entity';
import { Chat, ChatType } from '../entities/Chat.entity';
import { User } from '../entities/User.entity';
import { Message, MessageType } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { BroadcastRecipient } from '../entities/BroadcastRecipient.entity';
import { BotWorkflow } from '../entities/BotWorkflow.entity';
import { Tag, TagType } from '../entities/Tag.entity';
import { WorkflowExecutorService } from '../workflows/workflow-executor.service';
import * as iconv from 'iconv-lite';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bots: Map<string, Telegraf> = new Map();

  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private messageReadRepository: Repository<MessageRead>,
    @InjectRepository(BroadcastRecipient)
    private broadcastRecipientRepository: Repository<BroadcastRecipient>,
    @InjectRepository(BotWorkflow)
    private workflowsRepository: Repository<BotWorkflow>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @Inject(forwardRef(() => WorkflowExecutorService))
    private workflowExecutor: WorkflowExecutorService,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.initializeBots();
  }

  async initializeBots() {
    this.logger.log('Инициализация Telegram ботов...');
    const activeBots = await this.botRepository.find({ where: { isActive: true } });

    for (const bot of activeBots) {
      try {
        await this.createBot(bot.token, bot.id);
        this.logger.log(`Бот ${bot.username || bot.id} успешно запущен`);
      } catch (error) {
        this.logger.error(`Ошибка при запуске бота ${bot.id}:`, error);
      }
    }
  }

  async createBot(token: string, botId?: string): Promise<Bot> {
    try {
      const telegrafBot = new Telegraf(token);

      // Получаем информацию о боте с timeout
      const botInfo = await Promise.race([
        telegrafBot.telegram.getMe(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout getting bot info')), 10000)
        )
      ]) as unknown as { username: string; first_name: string };

      // Сохраняем бота в БД, если его еще нет
      let bot: Bot;
      if (botId) {
        bot = await this.botRepository.findOne({ where: { id: botId } });
        if (bot) {
          // Обновляем информацию о боте
          bot.username = botInfo.username;
          bot.firstName = botInfo.first_name;
          await this.botRepository.save(bot);
        }
      } else {
        bot = await this.botRepository.findOne({ where: { token } });
        if (!bot) {
          bot = this.botRepository.create({
            token,
            username: botInfo.username,
            firstName: botInfo.first_name,
            isActive: true,
          });
          bot = await this.botRepository.save(bot);
        }
      }

      // Настраиваем обработчики
      this.setupHandlers(telegrafBot, bot.id);

      // Middleware для логирования всех обновлений (для отладки)
      telegrafBot.use(async (ctx, next) => {
        try {
          if (ctx.callbackQuery) {
            this.logger.debug(`[DEBUG] Incoming callback_query: ${JSON.stringify(ctx.callbackQuery)}`);
          } else if (ctx.message) {
            // this.logger.debug(`[DEBUG] Incoming message: ${JSON.stringify(ctx.message)}`);
          }
        } catch (e) {
          console.error('Error logging update', e);
        }
        await next();
      });

      // Запускаем бота асинхронно
      telegrafBot.launch().then(() => {
        this.logger.log(`Бот @${botInfo.username} (${bot.id}) запущен и готов принимать сообщения`);
      }).catch((error) => {
        this.logger.error(`Ошибка при запуске бота ${bot.id}:`, error);
      });
      
      this.bots.set(bot.id, telegrafBot);

      this.logger.log(`Бот @${botInfo.username} (${bot.id}) инициализирован`);

      return bot;
    } catch (error) {
      this.logger.error(`Ошибка при создании бота:`, error);
      throw error;
    }
  }

  private setupHandlers(telegrafBot: Telegraf, botId: string) {
    // Обработка текстовых сообщений
    telegrafBot.on('text', async (ctx) => {
      await this.handleTextMessage(ctx, botId);
    });

    // Обработка фото
    telegrafBot.on('photo', async (ctx) => {
      await this.handlePhotoMessage(ctx, botId);
    });

    // Обработка видео
    telegrafBot.on('video', async (ctx) => {
      await this.handleVideoMessage(ctx, botId);
    });

    // Обработка голосовых сообщений
    telegrafBot.on('voice', async (ctx) => {
      await this.handleVoiceMessage(ctx, botId);
    });

    // Обработка документов
    telegrafBot.on('document', async (ctx) => {
      await this.handleDocumentMessage(ctx, botId);
    });

    // Обработка аудио
    telegrafBot.on('audio', async (ctx) => {
      await this.handleAudioMessage(ctx, botId);
    });

    // Обработка стикеров
    telegrafBot.on('sticker', async (ctx) => {
      await this.handleStickerMessage(ctx, botId);
    });

    // Обработка видео-заметок
    telegrafBot.on('video_note', async (ctx) => {
      await this.handleVideoNoteMessage(ctx, botId);
    });

    // Обработка GIF анимаций
    telegrafBot.on('animation', async (ctx) => {
      await this.handleAnimationMessage(ctx, botId);
    });

    // Обработка callback queries
    telegrafBot.on('callback_query', async (ctx) => {
      this.logger.log(`[DEBUG] Callback query handler triggered for bot ${botId}`);
      await this.handleCallbackQuery(ctx, botId);
    });
  }

  private async handleCallbackQuery(ctx: Context, botId: string) {
    try {
      const callbackQuery = ctx.callbackQuery;
      if (!callbackQuery) return;

      const from = callbackQuery.from;
      const telegramChatId = callbackQuery.message?.chat.id;
      
      // Get user and chat if possible (for context)
      const user = await this.getOrCreateUser(from);
      let chatId: string | undefined;
      
      if (telegramChatId) {
        const chat = await this.getOrCreateChat(telegramChatId, botId, user.id, callbackQuery.message.chat);
        chatId = chat.id;
      }
      
      const data = 'data' in callbackQuery ? callbackQuery.data : undefined;
      
      this.logger.log(`Callback query received: data='${data}', chatId=${telegramChatId}, userId=${from.id}`);
      
      if (!data) {
        this.logger.warn(`Callback query has no data`);
        await ctx.answerCbQuery();
        return;
      }

      // Обработка callback для категорий пользователей (hot_1, warm_1, cold_1)
      if (data === 'hot_1' || data === 'warm_1' || data === 'cold_1') {
        await this.handleCategoryCallback(ctx, botId, data, chatId, telegramChatId);
        // Ответ на callback query
        await ctx.answerCbQuery();
        return;
      }

      // Execute workflow for button click (callback)
      await this.workflowExecutor.executeWorkflow(botId, 'callback', { 
        callbackQuery, 
        data,
        userId: from.id,
        botId,
        chatId,
        telegramChatId,
        user 
      });

      // Answer callback query to stop loading animation
      await ctx.answerCbQuery();
      
    } catch (error) {
      this.logger.error('Ошибка при обработке callback query:', error);
    }
  }

  /**
   * Обрабатывает callback для категорий пользователей (hot_1, warm_1, cold_1)
   */
  private async handleCategoryCallback(
    ctx: Context,
    botId: string,
    callbackData: string,
    chatId: string | undefined,
    telegramChatId: number | undefined,
  ): Promise<void> {
    try {
      if (!chatId || !telegramChatId) {
        this.logger.warn('Не удалось обработать callback категории: нет chatId или telegramChatId');
        return;
      }

      // Определяем тип категории по callback
      let tagType: TagType;
      if (callbackData === 'hot_1') {
        tagType = TagType.HOT;
      } else if (callbackData === 'warm_1') {
        tagType = TagType.WARM;
      } else if (callbackData === 'cold_1') {
        tagType = TagType.COLD;
      } else {
        this.logger.warn(`Неизвестный callback для категории: ${callbackData}`);
        return;
      }

      // Находим тег по типу
      const tag = await this.tagRepository.findOne({
        where: { tagType },
      });

      if (!tag) {
        this.logger.warn(`Тег с типом ${tagType} не найден в базе данных. Убедитесь, что теги категорий созданы.`);
        return;
      }

      this.logger.log(`Найден тег категории: ${tag.name} (${tag.id}) для типа ${tagType}`);

      // Загружаем чат с тегами
      const chat = await this.chatRepository.findOne({
        where: { id: chatId },
        relations: ['tags'],
      });

      if (!chat) {
        this.logger.warn(`Чат ${chatId} не найден`);
        return;
      }

      // Находим все теги категорий (hot, warm, cold) для удаления
      const categoryTags = await this.tagRepository.find({
        where: { tagType: In([TagType.HOT, TagType.WARM, TagType.COLD]) },
      });

      this.logger.log(
        `Найдено ${categoryTags.length} тегов категорий для удаления из чата ${chatId}`,
      );

      // Удаляем все старые теги категорий через QueryBuilder
      if (categoryTags.length > 0) {
        const categoryTagIds = categoryTags.map((t) => t.id);
        const deleteResult = await this.dataSource
          .createQueryBuilder()
          .delete()
          .from('chat_tags')
          .where('chat_id = :chatId', { chatId })
          .andWhere('tag_id IN (:...tagIds)', { tagIds: categoryTagIds })
          .execute();

        this.logger.log(
          `Удалено ${deleteResult.affected || 0} связей категорий из чата ${chatId}`,
        );
      }

      // Добавляем новый тег через QueryBuilder
      // Сначала проверяем, не добавлен ли уже этот тег (на случай, если он был добавлен до удаления)
      const existingTag = await this.dataSource
        .createQueryBuilder()
        .select('*')
        .from('chat_tags', 'ct')
        .where('ct.chat_id = :chatId', { chatId })
        .andWhere('ct.tag_id = :tagId', { tagId: tag.id })
        .getRawOne();

      if (!existingTag) {
        const insertResult = await this.dataSource
          .createQueryBuilder()
          .insert()
          .into('chat_tags')
          .values({
            chat_id: chatId,
            tag_id: tag.id,
          })
          .execute();

        this.logger.log(
          `Добавлена связь чата ${chatId} с тегом ${tag.name} (${tag.id}). Вставлено записей: ${insertResult.identifiers?.length || 0}`,
        );
      } else {
        this.logger.log(
          `Связь чата ${chatId} с тегом ${tag.name} уже существует`,
        );
      }

      this.logger.log(
        `Пользователь ${chat.userId} перемещен в категорию ${tagType} (чат ${chatId})`,
      );

      this.logger.log(
        `Пользователь ${chat.userId} перемещен в категорию ${tagType} (чат ${chatId})`,
      );

      // Отправляем сообщение пользователю
      const thankYouMessage =
        'Благодарим за обратную связь. Ваше мнение крайне важно. Спасибо, что помогаете нам улучшать сервис! 🤝';

      try {
        await this.sendMessage(botId, telegramChatId, thankYouMessage);
      } catch (error) {
        this.logger.error('Ошибка при отправке сообщения благодарности:', error);
        // Не прерываем выполнение, если не удалось отправить сообщение
      }
    } catch (error) {
      this.logger.error('Ошибка при обработке callback категории:', error);
    }
  }

  private async handleTextMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.TextMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;

      // Получить или создать пользователя
      const user = await this.getOrCreateUser(from);

      // Проверка на команду /start и наличие параметра (deep linking)
      if (telegramMessage.text && telegramMessage.text.startsWith('/start ')) {
        const parts = telegramMessage.text.split(' ');
        if (parts.length > 1) {
          const payload = parts[1].trim();
          // Сохраняем start_param только если он еще не установлен
          if (payload && !user.startParam) {
            user.startParam = payload;
            await this.userRepository.save(user);
            this.logger.log(`Сохранен start_param для пользователя ${user.id}: ${payload}`);
          } else if (payload && user.startParam) {
            this.logger.log(`start_param уже существует для пользователя ${user.id}: ${user.startParam}. Новое значение (${payload}) игнорируется.`);
          }
        }
      }

      // Получить или создать чат
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Создать сообщение
      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        text: telegramMessage.text,
        messageType: MessageType.TEXT,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Обновить последнее сообщение в чате
      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получено текстовое сообщение от ${user.firstName} в чате ${chat.id}`);

      // Отправляем уведомление в группу, если настроено
      await this.sendNotificationToGroup(botId, user, telegramMessage.text);

      // Execute Workflow
      const isCommand = telegramMessage.text.startsWith('/');
      this.logger.log(`[WORKFLOW_DEBUG] Message text: "${telegramMessage.text}", isCommand: ${isCommand}, botId: ${botId}`);
      
      if (isCommand) {
        this.logger.log(`[WORKFLOW_DEBUG] Executing COMMAND workflow`);
        await this.workflowExecutor.executeWorkflow(botId, 'command', { 
            message: telegramMessage, 
            chatId: chat.id,
            telegramChatId: telegramMessage.chat.id, // Added
            botId,
            user 
        });
        this.logger.log(`[WORKFLOW_DEBUG] COMMAND workflow execution completed`);
      } else {
        this.logger.log(`[WORKFLOW_DEBUG] Executing TEXT workflow`);
        await this.workflowExecutor.executeWorkflow(botId, 'text', { 
            message: telegramMessage, 
            chatId: chat.id,
            telegramChatId: telegramMessage.chat.id, // Added
            botId,
            user 
        });
        this.logger.log(`[WORKFLOW_DEBUG] TEXT workflow execution completed`);
      }

    } catch (error) {
      this.logger.error('Ошибка при обработке текстового сообщения:', error);
    }
  }

  async getFileUrl(botId: string, fileId: string): Promise<string | null> {
    try {
      const bot = this.bots.get(botId);
      if (!bot) {
        this.logger.error(`Бот ${botId} не найден`);
        return null;
      }

      const file = await bot.telegram.getFile(fileId);
      if (file.file_path) {
        // Получаем token из базы данных
        const botEntity = await this.botRepository.findOne({ where: { id: botId } });
        if (!botEntity) {
          this.logger.error(`Бот ${botId} не найден в базе данных`);
          return null;
        }
        return `https://api.telegram.org/file/bot${botEntity.token}/${file.file_path}`;
      }
      return null;
    } catch (error) {
      this.logger.error(`Ошибка при получении URL файла ${fileId}:`, error);
      return null;
    }
  }

  private async handlePhotoMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.PhotoMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const photo = telegramMessage.photo[telegramMessage.photo.length - 1]; // Берем фото наибольшего размера

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, photo.file_id);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        text: telegramMessage.caption || null,
        caption: telegramMessage.caption || null,
        messageType: MessageType.PHOTO,
        fileId: photo.file_id,
        fileUniqueId: photo.file_unique_id,
        fileUrl,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получено фото от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке фото:', error);
    }
  }

  private async handleVideoMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.VideoMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const video = telegramMessage.video;

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, video.file_id);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        text: telegramMessage.caption || null,
        caption: telegramMessage.caption || null,
        messageType: MessageType.VIDEO,
        fileId: video.file_id,
        fileUniqueId: video.file_unique_id,
        fileUrl,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получено видео от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке видео:', error);
    }
  }

  private async handleVoiceMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.VoiceMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const voice = telegramMessage.voice;

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, voice.file_id);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        messageType: MessageType.VOICE,
        fileId: voice.file_id,
        fileUniqueId: voice.file_unique_id,
        fileUrl,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получено голосовое сообщение от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке голосового сообщения:', error);
    }
  }

  private async handleDocumentMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.DocumentMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const document = telegramMessage.document;

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, document.file_id);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        text: telegramMessage.caption || null,
        caption: telegramMessage.caption || null,
        messageType: MessageType.DOCUMENT,
        fileId: document.file_id,
        fileUniqueId: document.file_unique_id,
        fileUrl,
        fileName: document.file_name || 'document',
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получен документ от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке документа:', error);
    }
  }

  private async handleAudioMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.AudioMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const audio = telegramMessage.audio;

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, audio.file_id);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        text: telegramMessage.caption || null,
        caption: telegramMessage.caption || null,
        messageType: MessageType.AUDIO,
        fileId: audio.file_id,
        fileUniqueId: audio.file_unique_id,
        fileUrl,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получено аудио от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке аудио:', error);
    }
  }

  private async handleStickerMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.StickerMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const sticker = telegramMessage.sticker;

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Для анимированных стикеров (.tgs) используем thumbnail, если есть
      let fileIdToUse = sticker.file_id;
      if (sticker.is_animated && sticker.thumbnail) {
        fileIdToUse = sticker.thumbnail.file_id;
      }

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, fileIdToUse);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        messageType: MessageType.STICKER,
        fileId: sticker.file_id,
        fileUniqueId: sticker.file_unique_id,
        fileUrl,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получен стикер от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке стикера:', error);
    }
  }

  private async handleVideoNoteMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.VideoNoteMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const videoNote = telegramMessage.video_note;

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, videoNote.file_id);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        messageType: MessageType.VIDEO_NOTE,
        fileId: videoNote.file_id,
        fileUniqueId: videoNote.file_unique_id,
        fileUrl,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получена видео-заметка от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке видео-заметки:', error);
    }
  }

  private async handleAnimationMessage(ctx: Context, botId: string) {
    try {
      const telegramMessage = ctx.message as TelegramMessage.AnimationMessage;
      const from = telegramMessage.from;
      const chatId = telegramMessage.chat.id;
      const animation = telegramMessage.animation;

      const user = await this.getOrCreateUser(from);
      const chat = await this.getOrCreateChat(chatId, botId, user.id, telegramMessage.chat);

      // Получаем URL файла
      const fileUrl = await this.getFileUrl(botId, animation.file_id);

      const message = this.messageRepository.create({
        chatId: chat.id,
        botId,
        senderId: user.id,
        telegramMessageId: telegramMessage.message_id,
        text: telegramMessage.caption || null,
        caption: telegramMessage.caption || null,
        messageType: MessageType.ANIMATION,
        fileId: animation.file_id,
        fileUniqueId: animation.file_unique_id,
        fileUrl,
        isFromAdmin: false,
      });

      const savedMessage = await this.messageRepository.save(message);

      await this.chatRepository.update(chat.id, {
        lastMessageId: savedMessage.id,
        lastMessageAt: new Date(),
      });

      // Пометить все предыдущие сообщения от админа как прочитанные
      await this.markMessagesAsRead(chat.id, user.id);

      this.logger.log(`Получена анимация от ${user.firstName} в чате ${chat.id}`);
    } catch (error) {
      this.logger.error('Ошибка при обработке анимации:', error);
    }
  }

  private async getOrCreateUser(from: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
    is_bot?: boolean;
  }): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { telegramId: from.id },
    });

    if (!user) {
      user = this.userRepository.create({
        telegramId: from.id,
        username: from.username || null,
        firstName: from.first_name,
        lastName: from.last_name || null,
        languageCode: from.language_code || null,
        isBot: from.is_bot || false,
      });
      user = await this.userRepository.save(user);
      this.logger.log(`Создан новый пользователь: ${user.firstName} (${user.telegramId})`);
    }

    return user;
  }

  private async getOrCreateChat(
    telegramChatId: number,
    botId: string,
    userId: string,
    telegramChat: TelegramChat,
  ): Promise<Chat> {
    let chat = await this.chatRepository.findOne({
      where: { telegramChatId, botId },
    });

    if (!chat) {
      const chatType = this.mapChatType(telegramChat.type);
      const chatTitle = 'title' in telegramChat ? telegramChat.title : null;
      chat = this.chatRepository.create({
        telegramChatId,
        botId,
        userId,
        chatType,
        title: chatTitle,
      });
      chat = await this.chatRepository.save(chat);
      this.logger.log(`Создан новый чат: ${chat.id} (${telegramChatId})`);
    }

    return chat;
  }

  private mapChatType(telegramType: string): ChatType {
    switch (telegramType) {
      case 'private':
        return ChatType.PRIVATE;
      case 'group':
        return ChatType.GROUP;
      case 'supergroup':
        return ChatType.SUPERGROUP;
      case 'channel':
        return ChatType.CHANNEL;
      default:
        return ChatType.PRIVATE;
    }
  }

  // Методы для отправки сообщений от админа
  private fixHtmlEntities(text: string): string {
    if (!text) return text;
    
    // 1. Unescape double-escaped entities (&amp;lt; -> &lt; -> <)
    let fixed = text
      .replace(/&amp;lt;/g, '<')
      .replace(/&amp;gt;/g, '>')
      .replace(/&amp;quot;/g, '"')
      .replace(/&amp;amp;/g, '&');

    // 2. Unescape standard entities (&lt; -> <) specifically for HTML tags
    // We want to turn &lt;b&gt; into <b>, but keep "1 &lt; 2" as "1 &lt; 2" ideally.
    // However, since we are trying to fix broken HTML input, we'll be aggressive with known tags.
    
    const tags = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre', 'tg-spoiler'];
    
    tags.forEach(tag => {
        // Opening tags: &lt;b&gt; or &lt;a href="..."&gt;
        const openRegex = new RegExp(`&lt;${tag}(?:\\s+[^&gt;]*)?&gt;`, 'gi');
        fixed = fixed.replace(openRegex, (match) => {
            return match.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        });
        
        // Closing tags: &lt;/b&gt;
        const closeRegex = new RegExp(`&lt;/${tag}&gt;`, 'gi');
        fixed = fixed.replace(closeRegex, `<${tag}>`.replace('<', '</')); // simple replace
        fixed = fixed.replace(new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`);
    });

    // Also brute-force simple cases just in case regex missed
    fixed = fixed
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>')
      .replace(/&lt;i&gt;/g, '<i>').replace(/&lt;\/i&gt;/g, '</i>')
      .replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>')
      .replace(/&lt;s&gt;/g, '<s>').replace(/&lt;\/s&gt;/g, '</s>');

    return fixed;
  }

  /**
   * Получает бота из памяти или переинициализирует его, если он активен
   */
  private async getBotOrReinitialize(botId: string): Promise<Telegraf> {
    let bot = this.bots.get(botId);
    if (!bot) {
      // Пытаемся переинициализировать бота, если он активен
      const botEntity = await this.botRepository.findOne({ where: { id: botId } });
      if (botEntity && botEntity.isActive) {
        this.logger.log(`Бот ${botId} не найден в памяти, переинициализируем...`);
        await this.createBot(botEntity.token, botId);
        bot = this.bots.get(botId);
      }
      if (!bot) {
        throw new Error(`Бот с ID ${botId} не найден или неактивен`);
      }
    }
    return bot;
  }

  // Методы для отправки сообщений от админа
  async sendMessage(
    botId: string, 
    telegramChatId: number, 
    text: string, 
    replyToMessageId?: number,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<TelegramMessage.TextMessage> {
    const bot = await this.getBotOrReinitialize(botId);

    const options: {
      parse_mode?: string;
      reply_parameters?: { message_id: number };
      reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data?: string }>> };
    } = {};
    
    // ВАЖНО: parse_mode должен быть установлен первым
    options.parse_mode = 'HTML';
    
    if (replyToMessageId) {
      options.reply_parameters = { message_id: replyToMessageId };
    }
    if (inlineKeyboard && inlineKeyboard.length > 0) {
      options.reply_markup = {
        inline_keyboard: inlineKeyboard.map(row => 
          row.map(btn => ({
            text: btn.text,
            callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
          }))
        )
      };
    }

    // Fix HTML entities in text if needed
    const processedText = this.fixHtmlEntities(text);

    this.logger.log(`[DEBUG] Sending message with options: ${JSON.stringify(options)}`);
    console.log(`[DEBUG_CONSOLE] Sending message to ${telegramChatId}. Options:`, JSON.stringify(options));
    console.log(`[DEBUG_CONSOLE] Original text:`, text.substring(0, 100));
    console.log(`[DEBUG_CONSOLE] Processed text:`, processedText.substring(0, 100));
    
    try {
      // Используем явную передачу опций
      const sentMessage = await bot.telegram.sendMessage(
        telegramChatId, 
        processedText, 
        {
          parse_mode: 'HTML',
          ...(replyToMessageId && { reply_parameters: { message_id: replyToMessageId } }),
          ...(inlineKeyboard && inlineKeyboard.length > 0 && {
            reply_markup: {
              inline_keyboard: inlineKeyboard.map(row => 
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
                }))
              )
            }
          })
        }
      );
      this.logger.log(`[DEBUG] Message sent successfully with parse_mode: HTML`);
      return sentMessage as TelegramMessage.TextMessage;
    } catch (error) {
      console.error('[ERROR_CONSOLE] Failed to send message:', error);
      this.logger.error(`[ERROR] Failed to send message:`, error);
      this.logger.error(`[ERROR] Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async sendPhoto(
    botId: string,
    telegramChatId: number,
    photo: string | { source: any; filename?: string },
    caption?: string,
    replyToMessageId?: number,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<TelegramMessage.PhotoMessage> {
    const bot = await this.getBotOrReinitialize(botId);

    const sendOptions: {
      parse_mode?: string;
      caption?: string;
      reply_parameters?: { message_id: number };
      reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data?: string }>> };
    } = {
      parse_mode: 'HTML'
    };
    
    if (caption) {
      sendOptions.caption = caption;
    }
    if (replyToMessageId) {
      sendOptions.reply_parameters = { message_id: replyToMessageId };
    }
    if (inlineKeyboard && inlineKeyboard.length > 0) {
      sendOptions.reply_markup = {
        inline_keyboard: inlineKeyboard.map(row => 
          row.map(btn => ({
            text: btn.text,
            callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
          }))
        )
      };
    }

    this.logger.log(`[DEBUG] Sending photo with options: ${JSON.stringify(sendOptions)}`);
    console.log(`[DEBUG_CONSOLE] Sending photo to ${telegramChatId}. Options:`, JSON.stringify(sendOptions));
    
    // Fix HTML entities in caption if needed
    const processedCaption = caption ? this.fixHtmlEntities(caption) : undefined;
    if (processedCaption) {
        console.log(`[DEBUG_CONSOLE] Processed caption:`, processedCaption.substring(0, 100));
    }

    try {
      const sentMessage = await bot.telegram.sendPhoto(
        telegramChatId, 
        photo, 
        {
          parse_mode: 'HTML',
          ...(processedCaption && { caption: processedCaption }),
          ...(replyToMessageId && { reply_parameters: { message_id: replyToMessageId } }),
          ...(inlineKeyboard && inlineKeyboard.length > 0 && {
            reply_markup: {
              inline_keyboard: inlineKeyboard.map(row => 
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
                }))
              )
            }
          })
        }
      );
      this.logger.log(`[DEBUG] Photo sent successfully with parse_mode: HTML`);
      return sentMessage as TelegramMessage.PhotoMessage;
    } catch (error) {
      console.error('[ERROR_CONSOLE] Failed to send photo:', error);
      this.logger.error(`[ERROR] Failed to send photo:`, error);
      this.logger.error(`[ERROR] Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async sendVideo(
    botId: string,
    telegramChatId: number,
    video: string | { source: any; filename?: string },
    caption?: string,
    replyToMessageId?: number,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<TelegramMessage.VideoMessage> {
    const bot = await this.getBotOrReinitialize(botId);

    this.logger.log(`[DEBUG] Sending video with parse_mode: HTML`);
    const processedCaption = caption ? this.fixHtmlEntities(caption) : undefined;
    this.logger.log(`[DEBUG] Caption preview: ${processedCaption ? processedCaption.substring(0, 100) : 'none'}`);
    
    try {
      const sentMessage = await bot.telegram.sendVideo(
        telegramChatId, 
        video, 
        {
          parse_mode: 'HTML',
          ...(processedCaption && { caption: processedCaption }),
          ...(replyToMessageId && { reply_parameters: { message_id: replyToMessageId } }),
          ...(inlineKeyboard && inlineKeyboard.length > 0 && {
            reply_markup: {
              inline_keyboard: inlineKeyboard.map(row => 
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
                }))
              )
            }
          })
        }
      );
      this.logger.log(`[DEBUG] Video sent successfully with parse_mode: HTML`);
      return sentMessage as TelegramMessage.VideoMessage;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to send video:`, error);
      this.logger.error(`[ERROR] Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async sendVoice(
    botId: string,
    telegramChatId: number,
    voice: string | { source: any; filename?: string },
    replyToMessageId?: number,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<TelegramMessage.VoiceMessage> {
    const bot = await this.getBotOrReinitialize(botId);

    this.logger.log(`[DEBUG] Sending voice with parse_mode: HTML`);
    
    try {
      const sentMessage = await bot.telegram.sendVoice(
        telegramChatId, 
        voice, 
        {
          parse_mode: 'HTML',
          ...(replyToMessageId && { reply_parameters: { message_id: replyToMessageId } }),
          ...(inlineKeyboard && inlineKeyboard.length > 0 && {
            reply_markup: {
              inline_keyboard: inlineKeyboard.map(row => 
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
                }))
              )
            }
          })
        }
      );
      this.logger.log(`[DEBUG] Voice sent successfully with parse_mode: HTML`);
      return sentMessage as TelegramMessage.VoiceMessage;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to send voice:`, error);
      this.logger.error(`[ERROR] Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async sendDocument(
    botId: string,
    telegramChatId: number,
    document: string | { source: any; filename?: string },
    caption?: string,
    replyToMessageId?: number,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<TelegramMessage.DocumentMessage> {
    const bot = await this.getBotOrReinitialize(botId);

    this.logger.log(`[DEBUG] Sending document with parse_mode: HTML`);
    const processedCaption = caption ? this.fixHtmlEntities(caption) : undefined;
    this.logger.log(`[DEBUG] Caption preview: ${processedCaption ? processedCaption.substring(0, 100) : 'none'}`);
    
    try {
      const sentMessage = await bot.telegram.sendDocument(
        telegramChatId, 
        document, 
        {
          parse_mode: 'HTML',
          ...(processedCaption && { caption: processedCaption }),
          ...(replyToMessageId && { reply_parameters: { message_id: replyToMessageId } }),
          ...(inlineKeyboard && inlineKeyboard.length > 0 && {
            reply_markup: {
              inline_keyboard: inlineKeyboard.map(row => 
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
                }))
              )
            }
          })
        }
      );
      this.logger.log(`[DEBUG] Document sent successfully with parse_mode: HTML`);
      return sentMessage as TelegramMessage.DocumentMessage;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to send document:`, error);
      this.logger.error(`[ERROR] Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async sendAudio(
    botId: string,
    telegramChatId: number,
    audio: string | { source: any; filename?: string },
    caption?: string,
    replyToMessageId?: number,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<TelegramMessage.AudioMessage> {
    const bot = await this.getBotOrReinitialize(botId);

    this.logger.log(`[DEBUG] Sending audio with parse_mode: HTML`);
    const processedCaption = caption ? this.fixHtmlEntities(caption) : undefined;
    this.logger.log(`[DEBUG] Caption preview: ${processedCaption ? processedCaption.substring(0, 100) : 'none'}`);
    
    try {
      const sentMessage = await bot.telegram.sendAudio(
        telegramChatId, 
        audio, 
        {
          parse_mode: 'HTML',
          ...(processedCaption && { caption: processedCaption }),
          ...(replyToMessageId && { reply_parameters: { message_id: replyToMessageId } }),
          ...(inlineKeyboard && inlineKeyboard.length > 0 && {
            reply_markup: {
              inline_keyboard: inlineKeyboard.map(row => 
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
                }))
              )
            }
          })
        }
      );
      this.logger.log(`[DEBUG] Audio sent successfully with parse_mode: HTML`);
      return sentMessage as TelegramMessage.AudioMessage;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to send audio:`, error);
      this.logger.error(`[ERROR] Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async sendAnimation(
    botId: string,
    telegramChatId: number,
    animation: string | { source: any; filename?: string },
    caption?: string,
    replyToMessageId?: number,
    inlineKeyboard?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<TelegramMessage.AnimationMessage> {
    const bot = await this.getBotOrReinitialize(botId);

    this.logger.log(`[DEBUG] Sending animation with parse_mode: HTML`);
    const processedCaption = caption ? this.fixHtmlEntities(caption) : undefined;
    this.logger.log(`[DEBUG] Caption preview: ${processedCaption ? processedCaption.substring(0, 100) : 'none'}`);
    
    try {
      const sentMessage = await bot.telegram.sendAnimation(
        telegramChatId, 
        animation, 
        {
          parse_mode: 'HTML',
          ...(processedCaption && { caption: processedCaption }),
          ...(replyToMessageId && { reply_parameters: { message_id: replyToMessageId } }),
          ...(inlineKeyboard && inlineKeyboard.length > 0 && {
            reply_markup: {
              inline_keyboard: inlineKeyboard.map(row => 
                row.map(btn => ({
                  text: btn.text,
                  callback_data: btn.callback_data || btn.text.toLowerCase().replace(/\s+/g, '_')
                }))
              )
            }
          })
        }
      );
      this.logger.log(`[DEBUG] Animation sent successfully with parse_mode: HTML`);
      return sentMessage as TelegramMessage.AnimationMessage;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to send animation:`, error);
      this.logger.error(`[ERROR] Error details:`, JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async getBotInfo(botId: string) {
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    return bot;
  }

  async getAllBots() {
    return this.botRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getBotStatistics(botId: string) {
    const totalUsers = await this.chatRepository.count({ where: { botId } });
    const totalMessages = await this.messageRepository.count({ where: { botId } });
    const activeUsers = await this.chatRepository.count({ 
      where: { botId, isBotBlocked: false } 
    });
    const blockedUsers = await this.chatRepository.count({ 
      where: { botId, isBotBlocked: true } 
    });

    return {
      totalUsers,
      totalMessages,
      activeUsers,
      blockedUsers,
    };
  }

  /**
   * Загружает файл в Telegram и возвращает file_id и, при необходимости, URL файла
   * Файл отправляется в первый доступный чат бота (или создается служебный чат)
   */
  async uploadFileToTelegram(
    botId: string,
    file: Express.Multer.File,
  ): Promise<{ fileId: string; fileType: string; fileUrl?: string | null }> {
    this.logger.log(`[uploadFileToTelegram] Starting upload for botId: ${botId}, fileName: ${file?.originalname}`);
    this.logger.log(`[uploadFileToTelegram] Available bots in map: ${Array.from(this.bots.keys()).join(', ')}`);
    
    let bot = this.bots.get(botId);
    if (!bot) {
      // Попробуем переинициализировать бота
      this.logger.warn(`[uploadFileToTelegram] Bot not found in map, trying to reinitialize: ${botId}`);
      const botEntity = await this.botRepository.findOne({ where: { id: botId, isActive: true } });
      if (!botEntity) {
        this.logger.error(`[uploadFileToTelegram] Bot not found in database or inactive: ${botId}`);
        throw new Error(`Бот с ID ${botId} не найден или неактивен. Убедитесь, что бот активен и запущен.`);
      }
      try {
        await this.createBot(botEntity.token, botEntity.id);
        bot = this.bots.get(botId);
        if (!bot) {
          this.logger.error(`[uploadFileToTelegram] Bot still not found after reinitialization: ${botId}`);
          throw new Error(`Бот с ID ${botId} не найден после переинициализации.`);
        }
        this.logger.log(`[uploadFileToTelegram] Bot reinitialized successfully`);
      } catch (reinitError) {
        this.logger.error(`[uploadFileToTelegram] Failed to reinitialize bot:`, reinitError);
        const errorMsg = reinitError instanceof Error ? reinitError.message : String(reinitError);
        throw new Error(`Бот с ID ${botId} не найден. Ошибка переинициализации: ${errorMsg}`);
      }
    }

    try {
      // Находим первый доступный чат бота для загрузки файла
      const chat = await this.chatRepository.findOne({
        where: { botId },
        order: { createdAt: 'ASC' },
      });

      if (!chat) {
        this.logger.error(`[uploadFileToTelegram] No chat found for bot: ${botId}`);
        // Получаем username из базы данных
        const botEntity = await this.botRepository.findOne({ where: { id: botId } });
        const botUsername = botEntity?.username || '...';
        throw new Error(`Не найден ни один активный чат для этого бота. Чтобы загружать файлы, отправьте боту @${botUsername} любое сообщение (например, /start).`);
      }
      
      this.logger.log(`[uploadFileToTelegram] Found chat: ${chat.id}, telegramChatId: ${chat.telegramChatId}`);

      const chatId = chat.telegramChatId;

      // Определяем тип файла и отправляем соответствующим методом
      const mimeType = file.mimetype || '';
      let fileId: string;
      let messageId: number;

      // Исправление кодировки имени файла
      // Multer/Busboy в NestJS имеет известную проблему с кодировкой UTF-8 в заголовках.
      // Он парсит их как latin1 (ISO-8859-1).
      // Используем iconv-lite для корректной перекодировки.
      try {
        if (file.originalname) {
          const originalName = file.originalname;
          const originalBuffer = Buffer.from(originalName, 'latin1');
          const fixedName = iconv.decode(originalBuffer, 'utf8');
          
          this.logger.log(`[DEBUG_UPLOAD] Encoding fix (iconv): "${originalName}" -> "${fixedName}"`);
          file.originalname = fixedName;
        } else {
          file.originalname = `file_${Date.now()}`;
        }
      } catch (e) {
        console.warn('Failed to fix filename encoding:', e);
      }

      if (!file.buffer || file.buffer.length === 0) {
        throw new Error('Файл пуст или поврежден (нулевой размер буфера)');
      }

      this.logger.log(`[uploadFileToTelegram] Sending file: ${file.originalname}, size: ${file.size}, type: ${mimeType}, chatId: ${chatId} (${typeof chatId})`);

      try {
        let sentMessage: TelegramMessage | null = null;

        if (mimeType.startsWith('image/')) {
          // Для изображений используем sendPhoto
          this.logger.log(`[uploadFileToTelegram] Sending photo to chat ${chatId}`);
          sentMessage = await bot.telegram.sendPhoto(chatId, {
            source: file.buffer,
            filename: file.originalname,
          });
          if ('photo' in sentMessage) {
            fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
          } else if ('document' in sentMessage) {
             // Fallback если Telegram сконвертировал в документ
             fileId = (sentMessage as TelegramMessage.DocumentMessage).document.file_id;
          }
          messageId = sentMessage.message_id;
        } else if (mimeType.startsWith('video/')) {
          // Для видео используем sendVideo
          this.logger.log(`[uploadFileToTelegram] Sending video to chat ${chatId}`);
          sentMessage = await bot.telegram.sendVideo(chatId, {
            source: file.buffer,
            filename: file.originalname,
          });
          if ('video' in sentMessage) {
            fileId = sentMessage.video.file_id;
          } else if ('document' in sentMessage) {
            fileId = (sentMessage as TelegramMessage.DocumentMessage).document.file_id;
          }
          messageId = sentMessage.message_id;
        } else if (mimeType.startsWith('audio/')) {
          if (mimeType === 'audio/ogg' || mimeType === 'audio/mpeg') {
            // Для голосовых сообщений
            this.logger.log(`[uploadFileToTelegram] Sending voice to chat ${chatId}`);
            sentMessage = await bot.telegram.sendVoice(chatId, {
              source: file.buffer,
              filename: file.originalname,
            });
            if ('voice' in sentMessage) {
              fileId = sentMessage.voice.file_id;
            } else if ('document' in sentMessage) {
              fileId = (sentMessage as TelegramMessage.DocumentMessage).document.file_id;
            } else if ('audio' in sentMessage) {
              fileId = (sentMessage as TelegramMessage.AudioMessage).audio.file_id;
            }
            messageId = sentMessage.message_id;
          } else {
            // Для аудио файлов
            this.logger.log(`[uploadFileToTelegram] Sending audio to chat ${chatId}`);
            sentMessage = await bot.telegram.sendAudio(chatId, {
              source: file.buffer,
              filename: file.originalname,
            });
            if ('audio' in sentMessage) {
              fileId = sentMessage.audio.file_id;
            } else if ('document' in sentMessage) {
              fileId = (sentMessage as TelegramMessage.DocumentMessage).document.file_id;
            }
            messageId = sentMessage.message_id;
          }
        } else if (mimeType === 'image/gif' || file.originalname.endsWith('.gif')) {
          // Для GIF анимаций
          this.logger.log(`[uploadFileToTelegram] Sending animation to chat ${chatId}`);
          sentMessage = await bot.telegram.sendAnimation(chatId, {
            source: file.buffer,
            filename: file.originalname,
          });
          if ('animation' in sentMessage) {
            fileId = sentMessage.animation.file_id;
          } else if ('document' in sentMessage) {
            fileId = (sentMessage as TelegramMessage.DocumentMessage).document.file_id;
          }
          messageId = sentMessage.message_id;
        } else {
          // Для всех остальных файлов используем sendDocument
          this.logger.log(`[uploadFileToTelegram] Sending document to chat ${chatId}`);
          sentMessage = await bot.telegram.sendDocument(chatId, {
            source: file.buffer,
            filename: file.originalname,
          });
          if ('document' in sentMessage) {
            fileId = sentMessage.document.file_id;
          }
          messageId = sentMessage.message_id;
        }

        if (!fileId && sentMessage) {
           // Попытка найти file_id в других полях, если специфичные не сработали
           if ('document' in sentMessage) fileId = (sentMessage as TelegramMessage.DocumentMessage).document.file_id;
           else if ('photo' in sentMessage) fileId = (sentMessage as TelegramMessage.PhotoMessage).photo[(sentMessage as TelegramMessage.PhotoMessage).photo.length - 1].file_id;
           else if ('video' in sentMessage) fileId = (sentMessage as TelegramMessage.VideoMessage).video.file_id;
           else if ('audio' in sentMessage) fileId = (sentMessage as TelegramMessage.AudioMessage).audio.file_id;
           else if ('voice' in sentMessage) fileId = (sentMessage as TelegramMessage.VoiceMessage).voice.file_id;
           else if ('animation' in sentMessage) fileId = (sentMessage as TelegramMessage.AnimationMessage).animation.file_id;
           else if ('sticker' in sentMessage) fileId = (sentMessage as TelegramMessage.StickerMessage).sticker.file_id;
        }

        if (!fileId) {
          throw new Error('Не удалось получить file_id от Telegram. Возможно, формат файла не поддерживается.');
        }

      } catch (sendError) {
        this.logger.error(`[uploadFileToTelegram] Error sending file to Telegram:`, sendError);
        // Fallback: пробуем отправить как документ, если ошибка была при отправке медиа
        if (!mimeType.startsWith('application/') && !mimeType.startsWith('text/')) {
           this.logger.log(`[uploadFileToTelegram] Retrying as document...`);
           try {
             const sentMessage = await bot.telegram.sendDocument(chatId, {
                source: file.buffer,
                filename: file.originalname,
             });
             if ('document' in sentMessage) {
                fileId = sentMessage.document.file_id;
                messageId = sentMessage.message_id;
             } else {
                throw new Error('Telegram не вернул document object');
             }
           } catch (retryError) {
             this.logger.error(`[uploadFileToTelegram] Error sending as document:`, retryError);
             const errorMsg = sendError instanceof Error ? sendError.message : String(sendError);
             throw new Error(`Ошибка при отправке файла в Telegram: ${errorMsg}`);
           }
        } else {
           const errorMsg = sendError instanceof Error ? sendError.message : String(sendError);
           throw new Error(`Ошибка при отправке файла в Telegram: ${errorMsg}`);
        }
      }

      // Определяем тип файла для использования в workflow
      let fileType = 'document';
      if (mimeType.startsWith('image/')) fileType = 'photo';
      else if (mimeType.startsWith('video/')) fileType = 'video';
      else if (mimeType.startsWith('audio/')) {
        fileType = mimeType === 'audio/ogg' || mimeType === 'audio/mpeg' ? 'voice' : 'audio';
      } else if (mimeType === 'image/gif' || file.originalname.endsWith('.gif')) {
        fileType = 'animation';
      }

      // Получаем URL файла (для превью на фронтенде)
      const fileUrl = await this.getFileUrl(botId, fileId);

      // Удаляем временное сообщение после получения file_id
      if (typeof messageId === 'number') {
        try {
          await bot.telegram.deleteMessage(chatId, messageId);
        } catch (deleteError) {
          // Игнорируем ошибку удаления - не критично
          this.logger.warn(`Не удалось удалить временное сообщение ${messageId}:`, deleteError);
        }
      }

      this.logger.log(`[uploadFileToTelegram] Upload successful: fileId=${fileId}, fileType=${fileType}`);
      return { fileId, fileType, fileUrl };
    } catch (error) {
      this.logger.error(`[uploadFileToTelegram] Error uploading file:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fullError = `Не удалось загрузить файл в Telegram: ${errorMessage}`;
      this.logger.error(`[uploadFileToTelegram] Full error: ${fullError}`);
      throw new Error(fullError);
    }
  }

  /**
   * Помечает все непрочитанные сообщения от админа как прочитанные
   * когда пользователь отправляет новое сообщение
   */
  private async markMessagesAsRead(chatId: string, userId: string) {
    try {
      // Получаем все непрочитанные сообщения от админа в этом чате
      const unreadMessages = await this.messageRepository.find({
        where: {
          chatId,
          isFromAdmin: true,
          isRead: false,
        },
      });

      if (unreadMessages.length === 0) {
        return;
      }

      // Обновляем статус прочтения
      await this.messageRepository
        .createQueryBuilder()
        .update()
        .set({ isRead: true })
        .where('chatId = :chatId', { chatId })
        .andWhere('isFromAdmin = :isFromAdmin', { isFromAdmin: true })
        .andWhere('isRead = :isRead', { isRead: false })
        .execute();

      // Создаем записи MessageRead для каждого прочитанного сообщения
      const messageReads = unreadMessages.map((message) =>
        this.messageReadRepository.create({
          messageId: message.id,
          userId: userId,
        }),
      );

      // Сохраняем записи прочтения (используем save с проверкой на дубликаты)
      for (const messageRead of messageReads) {
        try {
          // Проверяем, существует ли уже запись прочтения
          const existingRead = await this.messageReadRepository.findOne({
            where: {
              messageId: messageRead.messageId,
              userId: messageRead.userId,
            },
          });

          if (!existingRead) {
            await this.messageReadRepository.save(messageRead);
            this.logger.debug(`Создана запись прочтения для сообщения ${messageRead.messageId} пользователем ${userId}`);
          } else {
            this.logger.debug(`Запись прочтения уже существует для сообщения ${messageRead.messageId} пользователем ${userId}`);
          }
        } catch (error) {
          // Игнорируем ошибки уникальности (если запись уже существует)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('23505')) {
            this.logger.debug(`Запись прочтения уже существует для сообщения ${messageRead.messageId} пользователем ${userId}`);
          } else {
            this.logger.warn(`Ошибка при создании записи прочтения для сообщения ${messageRead.messageId}:`, error);
          }
        }
      }

      this.logger.log(`Помечено ${unreadMessages.length} сообщений как прочитанные для пользователя ${userId}`);
    } catch (error) {
      this.logger.error('Ошибка при отметке сообщений как прочитанных:', error);
    }
  }

  async deleteMessage(botId: string, telegramChatId: number, messageId: number): Promise<boolean> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Бот с ID ${botId} не найден`);
    }

    try {
      await bot.telegram.deleteMessage(telegramChatId, messageId);
      this.logger.log(`Сообщение ${messageId} удалено из чата ${telegramChatId}`);
      return true;
    } catch (error) {
      this.logger.error(`Ошибка при удалении сообщения ${messageId}:`, error);
      return false;
    }
  }

  async updateBotSettings(botId: string, settings: { notificationGroupId?: string | null }) {
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new Error('Бот не найден');
    }

    if (settings.notificationGroupId !== undefined) {
      bot.notificationGroupId = settings.notificationGroupId || null;
    }

    await this.botRepository.save(bot);
    this.logger.log(`Настройки бота ${bot.username} (${botId}) обновлены`);

    return bot;
  }

  async toggleBotStatus(botId: string) {
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new Error('Бот не найден');
    }

    const newStatus = !bot.isActive;
    bot.isActive = newStatus;
    await this.botRepository.save(bot);

    if (newStatus) {
      // Включаем бота
      await this.createBot(bot.token, bot.id);
      this.logger.log(`Бот ${bot.username} (${botId}) активирован`);
    } else {
      // Отключаем бота
      const telegrafBot = this.bots.get(botId);
      if (telegrafBot) {
        await telegrafBot.stop();
        this.bots.delete(botId);
      }
      this.logger.log(`Бот ${bot.username} (${botId}) деактивирован`);
    }

    return bot;
  }

  async deleteBot(botId: string) {
    this.logger.log(`Начинаем удаление бота ${botId}`);
    
    // Останавливаем бота если он запущен
    const botInstance = this.bots.get(botId);
    if (botInstance) {
      try {
        await botInstance.stop();
        this.bots.delete(botId);
        this.logger.log(`Бот ${botId} остановлен`);
      } catch (e) {
        this.logger.warn(`Ошибка при остановке бота ${botId}: ${e}`);
      }
    }

    try {
      // Выполняем все удаления через один RAW SQL запрос в правильном порядке
      this.logger.log(`Выполняем удаление всех связанных данных для бота ${botId}`);
      
      await this.dataSource.query(`
        -- 1. Обнуляем reply_to_message_id в сообщениях (самоссылка)
        UPDATE messages SET reply_to_message_id = NULL WHERE bot_id = $1;
        
        -- 2. Обнуляем last_message_id в чатах ПЕРЕД удалением сообщений
        UPDATE chats SET last_message_id = NULL WHERE bot_id = $1;
        
        -- 3. Обнуляем last_read_message_id в chat_unread_counts
        UPDATE chat_unread_counts SET last_read_message_id = NULL 
        WHERE chat_id IN (SELECT id FROM chats WHERE bot_id = $1);
        
        -- 4. Удаляем chat_unread_counts
        DELETE FROM chat_unread_counts WHERE chat_id IN (SELECT id FROM chats WHERE bot_id = $1);
        
        -- 5. Обнуляем message_id в broadcast_recipients
        UPDATE broadcast_recipients SET message_id = NULL 
        WHERE message_id IN (SELECT id FROM messages WHERE bot_id = $1);
        
        -- 6. Удаляем message_reads
        DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE bot_id = $1);
        
        -- 7. Удаляем сообщения
        DELETE FROM messages WHERE bot_id = $1;
        
        -- 8. Удаляем broadcast_recipients по chat_id и bot_id
        DELETE FROM broadcast_recipients WHERE chat_id IN (SELECT id FROM chats WHERE bot_id = $1);
        DELETE FROM broadcast_recipients WHERE bot_id = $1;
        
        -- 9. Удаляем чаты
        DELETE FROM chats WHERE bot_id = $1;
        
        -- 10. Обнуляем bot_id в workflows
        UPDATE bot_workflows SET bot_id = NULL WHERE bot_id = $1;
        
        -- 11. Удаляем бота
        DELETE FROM bots WHERE id = $1;
      `, [botId]);

      // Обновляем workflows, где botId есть в массиве botIds
      const allWorkflows = await this.workflowsRepository.find();
      for (const workflow of allWorkflows) {
        if (Array.isArray(workflow.botIds) && workflow.botIds.includes(botId)) {
          workflow.botIds = workflow.botIds.filter(id => id !== botId);
          await this.workflowsRepository.save(workflow);
          this.logger.log(`Удален botId из массива botIds в workflow ${workflow.id}`);
        }
      }

      this.logger.log(`Бот ${botId} успешно удален`);
    } catch (error) {
      this.logger.error(`Ошибка при удалении бота ${botId}:`, error);
      this.logger.error(`Детали ошибки:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Stack trace:`, errorStack);
      
      throw new Error(`Не удалось удалить бота: ${errorMessage}`);
    }
  }

  async setMessageReaction(
    botId: string, 
    telegramChatId: number, 
    messageId: number, 
    reactions: Array<{ type: 'emoji'; emoji: string }>
  ): Promise<boolean> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Бот с ID ${botId} не найден`);
    }

    try {
      // Telegram API требует пустой массив для удаления реакций
      // или массив с одной реакцией для установки
      // Преобразуем реакции в формат, ожидаемый Telegram API
      // Используем type assertion, так как тип ReactionType требует более строгую типизацию
      // Используем двойное приведение типов для совместимости с Telegram API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await bot.telegram.setMessageReaction(telegramChatId, messageId, reactions as any);
      this.logger.log(
        `Реакция установлена для сообщения ${messageId} в чате ${telegramChatId}: ${reactions.map(r => r.emoji).join(', ')}`
      );
      return true;
    } catch (error) {
      this.logger.error(`Ошибка при установке реакции для сообщения ${messageId}:`, error);
      return false;
    }
  }

  /**
   * Отправляет уведомление в группу при получении сообщения от пользователя
   */
  private async sendNotificationToGroup(botId: string, user: User, messageText: string) {
    try {
      const bot = await this.botRepository.findOne({ where: { id: botId } });
      if (!bot || !bot.notificationGroupId) {
        return; // Группа не настроена, пропускаем
      }

      const telegrafBot = this.bots.get(botId);
      if (!telegrafBot) {
        this.logger.warn(`Бот ${botId} не найден для отправки уведомления`);
        return;
      }

      const groupId = bot.notificationGroupId;
      const username = user.username ? `@${user.username}` : user.firstName;
      const notificationText = `👤 <b>${username}</b>\n\n${messageText}`;

      await telegrafBot.telegram.sendMessage(groupId, notificationText, {
        parse_mode: 'HTML',
      });

      this.logger.log(`Уведомление отправлено в группу ${groupId} от пользователя ${username}`);
    } catch (error) {
      this.logger.error(`Ошибка при отправке уведомления в группу:`, error);
      // Не прерываем выполнение, если уведомление не отправилось
    }
  }
}

