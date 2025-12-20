import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createReadStream } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { Broadcast, BroadcastStatus } from '../entities/Broadcast.entity';
import {
  BroadcastRecipient,
  BroadcastRecipientStatus,
} from '../entities/BroadcastRecipient.entity';
import { User } from '../entities/User.entity';
import { Chat } from '../entities/Chat.entity';
import { Bot } from '../entities/Bot.entity';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { TelegramService } from '../telegram/telegram.service';
import { Message, MessageType } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { Message as TelegramMessage } from 'telegraf/typings/core/types/typegram';

// Лимиты символов для Telegram
const MAX_TEXT_LENGTH = 4096; // Для текстовых сообщений
const MAX_CAPTION_LENGTH = 1024; // Для подписей к изображениям

@Injectable()
export class BroadcastsService {
  private readonly logger = new Logger(BroadcastsService.name);

  constructor(
    @InjectRepository(Broadcast)
    private broadcastRepository: Repository<Broadcast>,
    @InjectRepository(BroadcastRecipient)
    private recipientRepository: Repository<BroadcastRecipient>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(MessageRead)
    private messageReadRepository: Repository<MessageRead>,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
  ) {}

  async createBroadcast(
    dto: CreateBroadcastDto,
    adminId: string,
  ): Promise<Broadcast> {
    // Валидация: либо текст, либо файл должен быть
    if ((!dto.text || !dto.text.trim()) && !dto.fileId) {
      throw new BadRequestException('Текст сообщения или изображение обязательны');
    }

    // Валидация длины текста
    if (dto.text) {
      const maxLength = dto.fileId ? MAX_CAPTION_LENGTH : MAX_TEXT_LENGTH;
      if (dto.text.length > maxLength) {
        throw new BadRequestException(
          dto.fileId
            ? `Подпись к изображению не может превышать ${MAX_CAPTION_LENGTH} символов. Текущая длина: ${dto.text.length}`
            : `Текст сообщения не может превышать ${MAX_TEXT_LENGTH} символов. Текущая длина: ${dto.text.length}`,
        );
      }
    }

    // Определяем тип сообщения
    let messageType = MessageType.TEXT;
    if (dto.fileId) {
      // Проверяем, является ли файл изображением по URL
      if (dto.fileUrl && (dto.fileUrl.includes('.jpg') || dto.fileUrl.includes('.jpeg') || 
          dto.fileUrl.includes('.png') || dto.fileUrl.includes('.gif') || 
          dto.fileUrl.includes('.webp'))) {
        messageType = MessageType.PHOTO;
      }
    }

    // Подсчитываем получателей на основе сегментации
    const recipients = await this.getRecipients(dto.segments || {});
    const totalRecipients = recipients.length;

    // Определяем статус рассылки
    let status = BroadcastStatus.DRAFT;
    if (dto.sendImmediately) {
      status = BroadcastStatus.SENDING;
    } else if (dto.scheduledAt) {
      const scheduledDate = new Date(dto.scheduledAt);
      const now = new Date();
      if (scheduledDate <= now) {
        throw new BadRequestException('Дата и время планирования должны быть в будущем');
      }
      status = BroadcastStatus.SCHEDULED;
    }

    // Создаем рассылку
    const broadcast = this.broadcastRepository.create({
      name: dto.name,
      text: dto.text || null,
      messageType,
      fileId: dto.fileId || null,
      fileUrl: dto.fileUrl || null,
      caption: dto.fileId ? (dto.text || null) : null, // Если есть файл, текст становится caption
      inlineButtons: dto.inlineButtons || null,
      segments: dto.segments || null,
      status,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      createdById: adminId,
      totalRecipients,
    });

    const savedBroadcast = await this.broadcastRepository.save(broadcast);

    // Для запланированных рассылок получателей формируем в момент запуска
    if (status === BroadcastStatus.SCHEDULED) {
      return savedBroadcast;
    }

    // Создаем получателей для черновика или немедленной отправки
    await this.createRecipients(savedBroadcast, recipients);

    // Если нужно отправить сразу, запускаем отправку
    if (dto.sendImmediately) {
      // Запускаем отправку асинхронно
      this.sendBroadcast(savedBroadcast.id).catch((error) => {
        this.logger.error(`Ошибка при отправке рассылки ${savedBroadcast.id}:`, error);
        this.broadcastRepository.update(savedBroadcast.id, {
          status: BroadcastStatus.FAILED,
        });
      });
    }

    return savedBroadcast;
  }

  async updateBroadcast(
    id: string,
    dto: UpdateBroadcastDto,
  ): Promise<Broadcast> {
    const broadcast = await this.broadcastRepository.findOne({
      where: { id },
    });

    if (!broadcast) {
      throw new NotFoundException('Рассылка не найдена');
    }

    // Можно редактировать только черновики и запланированные рассылки
    if (
      broadcast.status !== BroadcastStatus.DRAFT &&
      broadcast.status !== BroadcastStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        'Редактировать можно только черновики и запланированные рассылки',
      );
    }

    // Обновляем поля, если они переданы
    if (dto.name !== undefined) {
      broadcast.name = dto.name;
    }

    if (dto.text !== undefined) {
      broadcast.text = dto.text || null;
    }

    if (dto.fileId !== undefined) {
      broadcast.fileId = dto.fileId || null;
    }

    if (dto.fileUrl !== undefined) {
      broadcast.fileUrl = dto.fileUrl || null;
    }

    // Обновляем messageType и caption в зависимости от наличия файла
    if (dto.fileId !== undefined || dto.fileUrl !== undefined) {
      if (broadcast.fileId) {
        broadcast.messageType = MessageType.PHOTO;
        broadcast.caption = broadcast.text || null;
      } else {
        broadcast.messageType = MessageType.TEXT;
        broadcast.caption = null;
      }
    }

    // Валидация: либо текст, либо файл должен быть
    if ((!broadcast.text || !broadcast.text.trim()) && !broadcast.fileId) {
      throw new BadRequestException('Текст сообщения или изображение обязательны');
    }

    // Валидация длины текста
    if (broadcast.text) {
      const maxLength = broadcast.fileId ? MAX_CAPTION_LENGTH : MAX_TEXT_LENGTH;
      if (broadcast.text.length > maxLength) {
        throw new BadRequestException(
          broadcast.fileId
            ? `Подпись к изображению не может превышать ${MAX_CAPTION_LENGTH} символов. Текущая длина: ${broadcast.text.length}`
            : `Текст сообщения не может превышать ${MAX_TEXT_LENGTH} символов. Текущая длина: ${broadcast.text.length}`,
        );
      }
    }

    if (dto.segments !== undefined) {
      broadcast.segments = dto.segments || null;
    }

    if (dto.inlineButtons !== undefined) {
      broadcast.inlineButtons = dto.inlineButtons || null;
    }

    // Обновляем scheduledAt и статус, если передано
    if (dto.scheduledAt !== undefined) {
      if (dto.scheduledAt) {
        const scheduledDate = new Date(dto.scheduledAt);
        const now = new Date();
        if (scheduledDate <= now) {
          throw new BadRequestException(
            'Дата и время планирования должны быть в будущем',
          );
        }
        broadcast.scheduledAt = scheduledDate;
        broadcast.status = BroadcastStatus.SCHEDULED;
      } else {
        // Если scheduledAt удален, меняем статус на черновик
        broadcast.scheduledAt = null;
        broadcast.status = BroadcastStatus.DRAFT;
      }
    }

    // Пересчитываем получателей, если изменилась сегментация
    if (dto.segments !== undefined) {
      const recipients = await this.getRecipients(dto.segments || {});
      broadcast.totalRecipients = recipients.length;

      // Удаляем старых получателей и создаем новых
      await this.recipientRepository.delete({ broadcastId: id });

      // Для запланированных рассылок получателей формируем в момент запуска
      if (broadcast.status !== BroadcastStatus.SCHEDULED) {
        await this.createRecipients(broadcast, recipients);
      }
    }

    return await this.broadcastRepository.save(broadcast);
  }

  async getRecipients(segments: {
    startParams?: string[];
    botIds?: string[];
    tagTypes?: (string | null)[];
  }): Promise<Array<{ user: User; chat: Chat; bot: Bot }>> {
    // Начинаем с базового запроса для пользователей, которые взаимодействовали с ботами
    let queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.chats', 'chat')
      .innerJoin('chat.bot', 'bot')
      .where('bot.isActive = :isActive', { isActive: true })
      .andWhere('user.isBot = :isBot', { isBot: false });

    // Фильтрация по startParam
    if (segments.startParams && segments.startParams.length > 0) {
      queryBuilder = queryBuilder.andWhere('user.startParam IN (:...startParams)', {
        startParams: segments.startParams,
      });
    }

    // Фильтрация по ботам
    if (segments.botIds && segments.botIds.length > 0) {
      queryBuilder = queryBuilder.andWhere('bot.id IN (:...botIds)', {
        botIds: segments.botIds,
      });
    }

    // Фильтрация по категориям (tagTypes)
    if (segments.tagTypes && segments.tagTypes.length > 0) {
      const hasNull = segments.tagTypes.includes(null);
      const tagTypes = segments.tagTypes.filter((t): t is string => t !== null);

      if (hasNull && tagTypes.length > 0) {
        // Если выбраны и категории, и "Без категории"
        queryBuilder = queryBuilder.andWhere(
          `(
            EXISTS (
              SELECT 1 FROM chat_tags ct
              INNER JOIN tags t ON ct.tag_id = t.id
              WHERE ct.chat_id = chat.id AND t.tag_type IN (:...tagTypes)
            )
            OR NOT EXISTS (
              SELECT 1 FROM chat_tags ct
              INNER JOIN tags t ON ct.tag_id = t.id
              WHERE ct.chat_id = chat.id AND t.tag_type IN ('hot', 'warm', 'cold')
            )
          )`,
          { tagTypes },
        );
      } else if (hasNull) {
        // Только "Без категории" - чаты без тегов категорий hot/warm/cold
        queryBuilder = queryBuilder.andWhere(
          `NOT EXISTS (
            SELECT 1 FROM chat_tags ct
            INNER JOIN tags t ON ct.tag_id = t.id
            WHERE ct.chat_id = chat.id AND t.tag_type IN ('hot', 'warm', 'cold')
          )`,
        );
      } else if (tagTypes.length > 0) {
        // Только конкретные категории
        queryBuilder = queryBuilder.andWhere(
          `EXISTS (
            SELECT 1 FROM chat_tags ct
            INNER JOIN tags t ON ct.tag_id = t.id
            WHERE ct.chat_id = chat.id AND t.tag_type IN (:...tagTypes)
          )`,
          { tagTypes },
        );
      }
    }

    // Получаем уникальных пользователей с их чатами и ботами
    const results = await queryBuilder
      .select([
        'user.id',
        'user.telegramId',
        'user.firstName',
        'user.lastName',
        'user.username',
        'user.startParam',
        'chat.id',
        'chat.telegramChatId',
        'bot.id',
        'bot.token',
      ])
      .getRawMany();

    // Группируем по пользователям и выбираем один чат на пользователя (самый свежий)
    const userChatMap = new Map<
      string,
      { user: User; chat: Chat; bot: Bot }
    >();

    for (const row of results) {
      const userId = row.user_id;
      if (!userChatMap.has(userId)) {
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });
        const chat = await this.chatRepository.findOne({
          where: { id: row.chat_id },
          relations: ['bot'],
        });
        const bot = await this.botRepository.findOne({
          where: { id: row.bot_id },
        });

        if (user && chat && bot) {
          userChatMap.set(userId, { user, chat, bot });
        }
      }
    }

    return Array.from(userChatMap.values());
  }

  async createRecipients(
    broadcast: Broadcast,
    recipients: Array<{ user: User; chat: Chat; bot: Bot }>,
  ): Promise<void> {
    const recipientEntities = recipients.map(({ user, chat, bot }) =>
      this.recipientRepository.create({
        broadcastId: broadcast.id,
        userId: user.id,
        chatId: chat.id,
        botId: bot.id,
        status: BroadcastRecipientStatus.PENDING,
      }),
    );

    await this.recipientRepository.save(recipientEntities);
  }

  async sendBroadcast(broadcastId: string): Promise<void> {
    const broadcast = await this.broadcastRepository.findOne({
      where: { id: broadcastId },
      relations: ['recipients', 'recipients.user', 'recipients.chat', 'recipients.bot'],
    });

    if (!broadcast) {
      throw new NotFoundException('Рассылка не найдена');
    }

    if (broadcast.status === BroadcastStatus.COMPLETED) {
      throw new BadRequestException('Рассылка уже завершена');
    }

    // Если рассылка запланирована, проверяем, наступило ли время отправки
    if (broadcast.status === BroadcastStatus.SCHEDULED && broadcast.scheduledAt) {
      const now = new Date();
      const scheduledTime = new Date(broadcast.scheduledAt);
      if (scheduledTime > now) {
        throw new BadRequestException(
          `Рассылка запланирована на ${scheduledTime.toLocaleString()}. Время еще не наступило.`,
        );
      }
    }

    // Обновляем статус на "отправка"
    await this.broadcastRepository.update(broadcastId, {
      status: BroadcastStatus.SENDING,
      sentAt: new Date(),
    });

    const recipients = await this.recipientRepository.find({
      where: { broadcastId },
      relations: ['user', 'chat', 'bot'],
    });

    let sentCount = 0;
    let deliveredCount = 0;
    const readCount = 0; // TODO: Реализовать отслеживание прочтения через MessageRead

    // Отправляем сообщения
    for (const recipient of recipients) {
      try {
        let sentMessage: TelegramMessage;

        // Отправляем сообщение в зависимости от типа
        if (broadcast.messageType === MessageType.PHOTO && broadcast.fileId) {
          // Отправляем фото с подписью
          let photoSource: string | { source: ReturnType<typeof createReadStream>; filename?: string };
          
          const filePathOrUrl = broadcast.fileUrl || broadcast.fileId;
          
          // Проверяем, содержит ли URL путь /uploads/ (может быть как относительный, так и полный URL)
          const uploadsMatch = filePathOrUrl.match(/\/uploads\/([^\/\?]+)/);
          if (uploadsMatch) {
            // Извлекаем имя файла из пути /uploads/
            const fileName = uploadsMatch[1];
            const uploadsPath = join(process.cwd(), 'uploads');
            const filePath = join(uploadsPath, fileName);
            
            if (existsSync(filePath)) {
              photoSource = {
                source: createReadStream(filePath),
                filename: fileName,
              };
            } else {
              throw new Error(`Файл не найден: ${filePath}`);
            }
          } else if (filePathOrUrl && (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://'))) {
            // Используем полный HTTP/HTTPS URL напрямую (для внешних файлов, не из /uploads/)
            photoSource = filePathOrUrl;
          } else if (filePathOrUrl && filePathOrUrl.startsWith('/uploads/')) {
            // Относительный путь /uploads/
            const uploadsPath = join(process.cwd(), 'uploads');
            const filePath = join(uploadsPath, filePathOrUrl.replace('/uploads/', ''));
            
            if (existsSync(filePath)) {
              photoSource = {
                source: createReadStream(filePath),
                filename: filePathOrUrl.split('/').pop() || 'photo.jpg',
              };
            } else {
              throw new Error(`Файл не найден: ${filePath}`);
            }
          } else {
            // Если это не /uploads/ и не HTTP URL, пытаемся найти файл локально
            // Это может быть относительный путь или просто имя файла
            const uploadsPath = join(process.cwd(), 'uploads');
            const possiblePath = filePathOrUrl.startsWith('/') 
              ? join(process.cwd(), filePathOrUrl) 
              : join(uploadsPath, filePathOrUrl);
            
            if (existsSync(possiblePath)) {
              photoSource = {
                source: createReadStream(possiblePath),
                filename: filePathOrUrl.split('/').pop() || 'photo.jpg',
              };
            } else {
              throw new Error(`Файл не найден и не является валидным URL: ${filePathOrUrl}`);
            }
          }
          
          sentMessage = await this.telegramService.sendPhoto(
            recipient.bot.id,
            recipient.chat.telegramChatId,
            photoSource,
            broadcast.caption || broadcast.text || undefined,
            undefined,
            broadcast.inlineButtons || undefined,
          );
        } else {
          // Отправляем текстовое сообщение
          if (!broadcast.text) {
            throw new Error('Текст сообщения не указан');
          }
          sentMessage = await this.telegramService.sendMessage(
            recipient.bot.id,
            recipient.chat.telegramChatId,
            broadcast.text,
            undefined,
            broadcast.inlineButtons || undefined,
          );
        }

        // Сохраняем сообщение в базу данных для отслеживания прочтения
        let savedMessage: Message | null = null;
        try {
          // Получаем URL файла если есть
          let fileUrl: string | null = null;
          if (broadcast.messageType === MessageType.PHOTO && 'photo' in sentMessage) {
            // Для фото получаем file_id из отправленного сообщения
            const photoArray = sentMessage.photo;
            if (photoArray && photoArray.length > 0) {
              const largestPhoto = photoArray[photoArray.length - 1];
              fileUrl =
                (await this.telegramService.getFileUrl(
                  recipient.bot.id,
                  largestPhoto.file_id,
                )) || null;
            }
          } else if (broadcast.fileId) {
            fileUrl =
              (await this.telegramService.getFileUrl(
                recipient.bot.id,
                broadcast.fileId,
              )) || null;
          }

          const message = this.messageRepository.create({
            chatId: recipient.chat.id,
            botId: recipient.bot.id,
            senderId: recipient.user.id, // Сообщение от бота (рассылка)
            text: broadcast.text || null,
            caption: broadcast.caption || null,
            messageType: broadcast.messageType,
            fileId: broadcast.messageType === MessageType.PHOTO && 'photo' in sentMessage
              ? sentMessage.photo[sentMessage.photo.length - 1].file_id
              : (broadcast.fileId || null),
            fileUrl: fileUrl || null,
            telegramMessageId: sentMessage.message_id,
            isFromAdmin: true, // Сообщения из рассылок считаются от админа
            isDelivered: true,
            isRead: false,
          });

          savedMessage = await this.messageRepository.save(message);

          // Обновляем последнее сообщение в чате
          await this.chatRepository.update(recipient.chat.id, {
            lastMessageId: savedMessage.id,
            lastMessageAt: new Date(),
          });
        } catch (dbError) {
          this.logger.error(
            `Ошибка при сохранении сообщения в БД для получателя ${recipient.id}:`,
            dbError,
          );
          // Не прерываем выполнение, если не удалось сохранить в БД
        }

        // Обновляем статус получателя
        await this.recipientRepository.update(recipient.id, {
          status: BroadcastRecipientStatus.SENT,
          telegramMessageId: sentMessage.message_id,
          messageId: savedMessage?.id || null,
          sentAt: new Date(),
        });

        sentCount++;

        // Если сообщение успешно отправлено, снимаем флаг блокировки бота (если был установлен)
        const chat = await this.chatRepository.findOne({
          where: { id: recipient.chatId },
        });
        if (chat && chat.isBotBlocked) {
          await this.chatRepository.update(recipient.chatId, { isBotBlocked: false });
          this.logger.log(
            `Чат ${recipient.chatId} разблокирован для бота ${recipient.botId}`,
          );
        }

        // Сообщение считается доставленным сразу после отправки (Telegram не предоставляет точную информацию о доставке)
        await this.recipientRepository.update(recipient.id, {
          status: BroadcastRecipientStatus.DELIVERED,
          deliveredAt: new Date(),
        });
        deliveredCount++;

        // Небольшая задержка между отправками, чтобы не превысить лимиты Telegram
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        this.logger.error(
          `Ошибка при отправке сообщения получателю ${recipient.id}:`,
          error,
        );
        
        // Проверяем, заблокирован ли бот пользователем
        const isBlockedError = this.isBotBlockedError(error);
        if (isBlockedError) {
          // Помечаем чат как заблокированный
          await this.chatRepository.update(recipient.chatId, { isBotBlocked: true });
          this.logger.warn(
            `Чат ${recipient.chatId} помечен как заблокированный для бота ${recipient.botId}`,
          );
        }
        
        await this.recipientRepository.update(recipient.id, {
          status: BroadcastRecipientStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Обновляем статистику рассылки
    await this.broadcastRepository.update(broadcastId, {
      status: BroadcastStatus.COMPLETED,
      sentCount,
      deliveredCount,
      readCount,
    });

    this.logger.log(
      `Рассылка ${broadcastId} завершена. Отправлено: ${sentCount}, Доставлено: ${deliveredCount}`,
    );
  }

  async getBroadcasts(adminId?: string): Promise<Broadcast[]> {
    const queryBuilder = this.broadcastRepository
      .createQueryBuilder('broadcast')
      .leftJoinAndSelect('broadcast.createdBy', 'createdBy')
      .orderBy('broadcast.createdAt', 'DESC');

    if (adminId) {
      queryBuilder.where('broadcast.createdById = :adminId', { adminId });
    }

    return queryBuilder.getMany();
  }

  async getBroadcastById(id: string): Promise<Broadcast> {
    const broadcast = await this.broadcastRepository.findOne({
      where: { id },
      relations: ['createdBy', 'recipients', 'recipients.user', 'recipients.chat', 'recipients.bot'],
    });

    if (!broadcast) {
      throw new NotFoundException('Рассылка не найдена');
    }

    return broadcast;
  }

  async getBroadcastStatistics(id: string) {
    const broadcast = await this.getBroadcastById(id);

    const recipients = await this.recipientRepository.find({
      where: { broadcastId: id },
      relations: ['user', 'chat', 'bot'],
    });

    // Загружаем сообщения для проверки прочтения
    const messageIds = recipients
      .map((r) => r.messageId)
      .filter((id): id is string => id !== null);
    const messages = messageIds.length > 0
      ? await this.messageRepository.find({
          where: messageIds.map((id) => ({ id })),
        })
      : [];
    const messagesMap = new Map(messages.map((m) => [m.id, m]));

    // Загружаем записи MessageRead для получения точного времени прочтения
    // Важно: MessageRead связан с конкретным пользователем, поэтому фильтруем по userId получателя
    const messageReads = messageIds.length > 0 && recipients.length > 0
      ? await this.messageReadRepository
          .createQueryBuilder('mr')
          .where('mr.messageId IN (:...messageIds)', { messageIds })
          .andWhere('mr.userId IN (:...userIds)', { 
            userIds: recipients.map((r) => r.userId) 
          })
          .orderBy('mr.readAt', 'DESC')
          .getMany()
      : [];
    
    // Создаем карту: ключ = messageId + userId, значение = MessageRead
    const messageReadsMap = new Map<string, MessageRead>();
    messageReads.forEach((mr) => {
      const key = `${mr.messageId}_${mr.userId}`;
      messageReadsMap.set(key, mr);
    });

    // Обновляем статистику прочтения на основе Message.isRead и MessageRead
    const updatedRecipients = await Promise.all(recipients.map(async (r) => {
      let isRead = false;
      let readAt: Date | null = null;

      if (r.messageId) {
        // Проверяем прочтение через Message
        const message = messagesMap.get(r.messageId);
        if (message && message.isRead) {
          isRead = true;
          // Ищем MessageRead для конкретного пользователя и сообщения
          const key = `${r.messageId}_${r.userId}`;
          const messageRead = messageReadsMap.get(key);
          if (messageRead) {
            readAt = messageRead.readAt;
          } else {
            // Если MessageRead нет, но isRead = true, используем updatedAt сообщения
            readAt = message.updatedAt || null;
          }
        }
      }

      // Обновляем статус получателя если сообщение прочитано
      if (isRead && r.status !== BroadcastRecipientStatus.READ) {
        this.recipientRepository.update(r.id, {
          status: BroadcastRecipientStatus.READ,
          readAt: readAt || new Date(),
        }).catch((err) => {
          this.logger.error(`Ошибка при обновлении статуса получателя ${r.id}:`, err);
        });
      }

      return {
        id: r.id,
        user: {
          id: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          username: r.user.username,
          startParam: r.user.startParam,
        },
        status: isRead ? BroadcastRecipientStatus.READ : r.status,
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        readAt: isRead ? (readAt ?? r.readAt) : r.readAt,
        errorMessage: r.errorMessage,
        isRead,
      };
    }));

    const readCount = updatedRecipients.filter((r) => r.isRead).length;

    // Обновляем счетчики в рассылке
    if (readCount !== broadcast.readCount) {
      await this.broadcastRepository.update(id, {
        readCount,
      });
    }

    const readPercentage =
      broadcast.deliveredCount > 0
        ? Math.round((readCount / broadcast.deliveredCount) * 100)
        : 0;

    const statistics = {
      total: broadcast.totalRecipients,
      sent: broadcast.sentCount,
      delivered: broadcast.deliveredCount,
      read: readCount,
      failed: recipients.filter((r) => r.status === BroadcastRecipientStatus.FAILED).length,
      readPercentage,
      recipients: updatedRecipients.map(({ isRead, ...rest }) => rest),
    };

    return statistics;
  }

  async copyBroadcast(id: string, adminId: string): Promise<Broadcast> {
    try {
      const originalBroadcast = await this.getBroadcastById(id);

      // Создаем новую рассылку с теми же настройками
      const newBroadcast = this.broadcastRepository.create({
        name: `${originalBroadcast.name} (копия)`,
        text: originalBroadcast.text,
        messageType: originalBroadcast.messageType,
        fileId: originalBroadcast.fileId,
        fileUrl: originalBroadcast.fileUrl,
        caption: originalBroadcast.caption,
        inlineButtons: originalBroadcast.inlineButtons,
        segments: originalBroadcast.segments,
        status: BroadcastStatus.DRAFT,
        createdById: adminId,
        totalRecipients: 0,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
      });

      const savedBroadcast = await this.broadcastRepository.save(newBroadcast);

      // Подсчитываем получателей на основе сегментации
      const segments = originalBroadcast.segments || {};
      const recipients = await this.getRecipients(segments);
      await this.createRecipients(savedBroadcast, recipients);
      await this.broadcastRepository.update(savedBroadcast.id, {
        totalRecipients: recipients.length,
      });

      this.logger.log(`Рассылка ${id} успешно скопирована как ${savedBroadcast.id}`);
      return savedBroadcast;
    } catch (error) {
      this.logger.error(`Ошибка при копировании рассылки ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Не удалось скопировать рассылку: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteBroadcast(id: string): Promise<void> {
    const broadcast = await this.broadcastRepository.findOne({
      where: { id },
      relations: ['recipients'],
    });

    if (!broadcast) {
      throw new NotFoundException('Рассылка не найдена');
    }

    try {
      // Удаляем всех получателей (должно удалиться каскадно, но на всякий случай удаляем явно)
      // Используем транзакцию для безопасного удаления
      await this.recipientRepository
        .createQueryBuilder()
        .delete()
        .from('broadcast_recipients')
        .where('broadcast_id = :broadcastId', { broadcastId: id })
        .execute();
      
      // Удаляем саму рассылку
      await this.broadcastRepository.remove(broadcast);
      this.logger.log(`Рассылка ${id} успешно удалена`);
    } catch (error) {
      this.logger.error(`Ошибка при удалении рассылки ${id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Проверяем тип ошибки для более точного сообщения
      if (errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
        throw new BadRequestException(
          'Не удалось удалить рассылку: существуют связанные записи. Попробуйте позже.',
        );
      }
      
      throw new BadRequestException(
        `Не удалось удалить рассылку: ${errorMessage}`,
      );
    }
  }

  private async getFirstActiveBotId(): Promise<string> {
    const bot = await this.botRepository.findOne({
      where: { isActive: true },
    });

    if (!bot) {
      throw new BadRequestException('Нет активных ботов');
    }

    return bot.id;
  }

  /**
   * Проверяет и отправляет запланированные рассылки, время которых наступило
   * Этот метод должен вызываться периодически (например, каждую минуту)
   */
  async processScheduledBroadcasts(): Promise<void> {
    const now = new Date();
    const scheduledBroadcasts = await this.broadcastRepository.find({
      where: {
        status: BroadcastStatus.SCHEDULED,
      },
    });

    for (const broadcast of scheduledBroadcasts) {
      if (broadcast.scheduledAt && new Date(broadcast.scheduledAt) <= now) {
        this.logger.log(
          `Время отправки запланированной рассылки ${broadcast.id} наступило. Запускаем отправку.`,
        );
        try {
          // Формируем получателей перед отправкой
          const recipients = await this.getRecipients(broadcast.segments || {});
          await this.createRecipients(broadcast, recipients);
          await this.broadcastRepository.update(broadcast.id, {
            totalRecipients: recipients.length,
          });
        } catch (err) {
          this.logger.error(
            `Ошибка при формировании получателей для запланированной рассылки ${broadcast.id}:`,
            err,
          );
          await this.broadcastRepository.update(broadcast.id, {
            status: BroadcastStatus.FAILED,
          });
          continue;
        }
        // Запускаем отправку асинхронно
        this.sendBroadcast(broadcast.id).catch((error) => {
          this.logger.error(
            `Ошибка при отправке запланированной рассылки ${broadcast.id}:`,
            error,
          );
          this.broadcastRepository.update(broadcast.id, {
            status: BroadcastStatus.FAILED,
          });
        });
      }
    }
  }

  /**
   * Отправляет тестовое сообщение рассылки в группу, указанную в настройках бота
   * @param text Текст рассылки для тестирования
   * @param botId ID бота, в группу которого отправить тест (опционально, если не указан - берется первый активный бот с notificationGroupId)
   * @param fileId ID файла (опционально)
   * @param fileUrl URL файла (опционально)
   * @param inlineButtons Inline кнопки (опционально)
   */
  async testBroadcast(
    text: string, 
    botId?: string, 
    fileId?: string, 
    fileUrl?: string,
    inlineButtons?: Array<Array<{ text: string; callback_data?: string }>>
  ): Promise<{ success: boolean; message: string }> {
    // Валидация: либо текст, либо файл должен быть
    if ((!text || !text.trim()) && !fileId) {
      throw new BadRequestException('Текст рассылки или изображение обязательны для тестирования');
    }

    // Валидация длины текста
    if (text) {
      const maxLength = fileId ? MAX_CAPTION_LENGTH : MAX_TEXT_LENGTH;
      if (text.length > maxLength) {
        throw new BadRequestException(
          fileId
            ? `Подпись к изображению не может превышать ${MAX_CAPTION_LENGTH} символов. Текущая длина: ${text.length}`
            : `Текст сообщения не может превышать ${MAX_TEXT_LENGTH} символов. Текущая длина: ${text.length}`,
        );
      }
    }

    // Находим бота для тестирования
    let bot: Bot | null = null;
    if (botId) {
      bot = await this.botRepository.findOne({
        where: { id: botId, isActive: true },
      });
      if (!bot) {
        throw new NotFoundException(`Активный бот с ID ${botId} не найден`);
      }
    } else {
      // Ищем первый активный бот с настроенной группой для уведомлений
      bot = await this.botRepository.findOne({
        where: { isActive: true },
      });
      
      // Если не нашли активного бота, ищем любой бот с notificationGroupId
      if (!bot) {
        bot = await this.botRepository
          .createQueryBuilder('bot')
          .where('bot.notificationGroupId IS NOT NULL')
          .andWhere('bot.notificationGroupId != :empty', { empty: '' })
          .getOne();
      } else if (!bot.notificationGroupId) {
        // Если у активного бота нет группы, ищем другой с группой
        const botWithGroup = await this.botRepository
          .createQueryBuilder('bot')
          .where('bot.notificationGroupId IS NOT NULL')
          .andWhere('bot.notificationGroupId != :empty', { empty: '' })
          .getOne();
        if (botWithGroup) {
          bot = botWithGroup;
        }
      }
    }

    if (!bot) {
      throw new NotFoundException('Не найден активный бот для тестирования');
    }

    if (!bot.notificationGroupId) {
      throw new BadRequestException(
        `У бота ${bot.username || bot.id} не настроена группа для уведомлений. Пожалуйста, укажите ID группы в настройках бота.`,
      );
    }

    try {
      const groupId = parseInt(bot.notificationGroupId, 10);
      if (isNaN(groupId)) {
        throw new BadRequestException(
          `Неверный формат ID группы: ${bot.notificationGroupId}. ID группы должен быть числом.`,
        );
      }
      
      // Отправляем тестовое сообщение в зависимости от типа
      if (fileId && fileUrl) {
        // Отправляем фото с подписью
        let photoSource: string | { source: ReturnType<typeof createReadStream>; filename?: string };
        
        const filePathOrUrl = fileUrl || fileId;
        
        // Проверяем, содержит ли URL путь /uploads/ (может быть как относительный, так и полный URL)
        const uploadsMatch = filePathOrUrl.match(/\/uploads\/([^\/\?]+)/);
        if (uploadsMatch) {
          // Извлекаем имя файла из пути /uploads/
          const fileName = uploadsMatch[1];
          const uploadsPath = join(process.cwd(), 'uploads');
          const filePath = join(uploadsPath, fileName);
          
          if (existsSync(filePath)) {
            photoSource = {
              source: createReadStream(filePath),
              filename: fileName,
            };
          } else {
            throw new BadRequestException(`Файл не найден: ${filePath}`);
          }
        } else if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
          // Используем полный HTTP/HTTPS URL напрямую (для внешних файлов, не из /uploads/)
          photoSource = filePathOrUrl;
        } else if (filePathOrUrl.startsWith('/uploads/')) {
          // Относительный путь /uploads/
          const uploadsPath = join(process.cwd(), 'uploads');
          const filePath = join(uploadsPath, filePathOrUrl.replace('/uploads/', ''));
          
          if (existsSync(filePath)) {
            photoSource = {
              source: createReadStream(filePath),
              filename: filePathOrUrl.split('/').pop() || 'photo.jpg',
            };
          } else {
            throw new BadRequestException(`Файл не найден: ${filePath}`);
          }
        } else {
          // Если это не /uploads/ и не HTTP URL, пытаемся найти файл локально
          const uploadsPath = join(process.cwd(), 'uploads');
          const possiblePath = filePathOrUrl.startsWith('/') 
            ? join(process.cwd(), filePathOrUrl) 
            : join(uploadsPath, filePathOrUrl);
          
          if (existsSync(possiblePath)) {
            photoSource = {
              source: createReadStream(possiblePath),
              filename: filePathOrUrl.split('/').pop() || 'photo.jpg',
            };
          } else {
            throw new BadRequestException(`Файл не найден и не является валидным URL: ${filePathOrUrl}`);
          }
        }
        
        await this.telegramService.sendPhoto(
          bot.id,
          groupId,
          photoSource,
          `🧪 <b>Тестовая рассылка</b>\n\n${text || ''}`,
          undefined,
          inlineButtons || undefined,
        );
      } else {
        // Отправляем текстовое сообщение
        const testMessage = `🧪 <b>Тестовая рассылка</b>\n\n${text}`;
        await this.telegramService.sendMessage(
          bot.id, 
          groupId, 
          testMessage,
          undefined,
          inlineButtons || undefined,
        );
      }

      this.logger.log(
        `Тестовая рассылка отправлена в группу ${bot.notificationGroupId} бота ${bot.username || bot.id}`,
      );

      return {
        success: true,
        message: `Тестовое сообщение успешно отправлено в группу ${bot.notificationGroupId} бота ${bot.username || bot.id}`,
      };
    } catch (error) {
      this.logger.error('Ошибка при отправке тестовой рассылки:', error);
      throw new BadRequestException(
        `Ошибка при отправке тестового сообщения: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Подсчитывает количество пользователей для сегментации
   * Возвращает:
   * - total: общее количество всех пользователей (без сегментации)
   * - byStartParam: количество пользователей для каждого startParam
   * - byBotId: количество пользователей для каждого botId
   * - selectedTotal: общее количество пользователей для выбранных сегментов
   */
  async getSegmentationCounts(segments?: {
    startParams?: string[];
    botIds?: string[];
    tagTypes?: (string | null)[];
  }): Promise<{
    total: number;
    byStartParam: Record<string, number>;
    byBotId: Record<string, number>;
    byTagType: Record<string, number>;
    selectedTotal: number;
  }> {
    // Базовый запрос для всех пользователей
    const baseQueryBuilder = this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.chats', 'chat')
      .innerJoin('chat.bot', 'bot')
      .where('bot.isActive = :isActive', { isActive: true })
      .andWhere('user.isBot = :isBot', { isBot: false });

    // Общее количество всех пользователей
    const totalResult = await baseQueryBuilder
      .select('COUNT(DISTINCT user.id)', 'count')
      .getRawOne();
    const total = parseInt(totalResult?.count || '0', 10);

    // Подсчет по каждому startParam
    const byStartParam: Record<string, number> = {};
    const allStartParams = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.chats', 'chat')
      .innerJoin('chat.bot', 'bot')
      .where('bot.isActive = :isActive', { isActive: true })
      .andWhere('user.isBot = :isBot', { isBot: false })
      .andWhere('user.startParam IS NOT NULL')
      .select('DISTINCT user.startParam', 'startParam')
      .getRawMany();

    for (const row of allStartParams) {
      const startParam = row.startParam;
      if (startParam) {
        const countResult = await this.userRepository
          .createQueryBuilder('user')
          .innerJoin('user.chats', 'chat')
          .innerJoin('chat.bot', 'bot')
          .where('bot.isActive = :isActive', { isActive: true })
          .andWhere('user.isBot = :isBot', { isBot: false })
          .andWhere('user.startParam = :startParam', { startParam })
          .select('COUNT(DISTINCT user.id)', 'count')
          .getRawOne();
        byStartParam[startParam] = parseInt(countResult?.count || '0', 10);
      }
    }

    // Подсчет по каждому боту
    const byBotId: Record<string, number> = {};
    const allBots = await this.botRepository.find({
      where: { isActive: true },
    });

    for (const bot of allBots) {
      const countResult = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.chats', 'chat')
        .innerJoin('chat.bot', 'bot')
        .where('bot.isActive = :isActive', { isActive: true })
        .andWhere('user.isBot = :isBot', { isBot: false })
        .andWhere('bot.id = :botId', { botId: bot.id })
        .select('COUNT(DISTINCT user.id)', 'count')
        .getRawOne();
      byBotId[bot.id] = parseInt(countResult?.count || '0', 10);
    }

    // Подсчет по категориям (tagTypes)
    const byTagType: Record<string, number> = {};
    
    // Подсчет для каждой категории
    const tagTypes = ['hot', 'warm', 'cold'];
    for (const tagType of tagTypes) {
      const countResult = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.chats', 'chat')
        .innerJoin('chat.bot', 'bot')
        .innerJoin('chat.tags', 'tag')
        .where('bot.isActive = :isActive', { isActive: true })
        .andWhere('user.isBot = :isBot', { isBot: false })
        .andWhere('tag.tagType = :tagType', { tagType })
        .select('COUNT(DISTINCT user.id)', 'count')
        .getRawOne();
      byTagType[tagType] = parseInt(countResult?.count || '0', 10);
    }

    // Подсчет для "Без категории" (пользователи без тегов hot/warm/cold)
    const noCategoryCountResult = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.chats', 'chat')
      .innerJoin('chat.bot', 'bot')
      .leftJoin('chat.tags', 'tag', "tag.tagType IN ('hot', 'warm', 'cold')")
      .where('bot.isActive = :isActive', { isActive: true })
      .andWhere('user.isBot = :isBot', { isBot: false })
      .andWhere('tag.id IS NULL')
      .select('COUNT(DISTINCT user.id)', 'count')
      .getRawOne();
    byTagType['none'] = parseInt(noCategoryCountResult?.count || '0', 10);

    // Подсчет общего количества для выбранных сегментов
    let selectedTotal = total;
    if (segments && (segments.startParams?.length || segments.botIds?.length || segments.tagTypes?.length)) {
      let selectedQueryBuilder = this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.chats', 'chat')
        .innerJoin('chat.bot', 'bot')
        .where('bot.isActive = :isActive', { isActive: true })
        .andWhere('user.isBot = :isBot', { isBot: false });

      // Если выбраны startParams, фильтруем по ним
      if (segments.startParams && segments.startParams.length > 0) {
        selectedQueryBuilder = selectedQueryBuilder.andWhere(
          'user.startParam IN (:...startParams)',
          { startParams: segments.startParams },
        );
      }

      // Если выбраны botIds, фильтруем по ним
      if (segments.botIds && segments.botIds.length > 0) {
        selectedQueryBuilder = selectedQueryBuilder.andWhere(
          'bot.id IN (:...botIds)',
          { botIds: segments.botIds },
        );
      }

      // Фильтрация по категориям (tagTypes)
      if (segments.tagTypes && segments.tagTypes.length > 0) {
        const hasNull = segments.tagTypes.includes(null);
        const tagTypes = segments.tagTypes.filter((t): t is string => t !== null);

        if (hasNull && tagTypes.length > 0) {
          // Если выбраны и категории, и "Без категории"
          selectedQueryBuilder = selectedQueryBuilder.andWhere(
            `(
              EXISTS (
                SELECT 1 FROM chat_tags ct
                INNER JOIN tags t ON ct.tag_id = t.id
                WHERE ct.chat_id = chat.id AND t.tag_type IN (:...tagTypes)
              )
              OR NOT EXISTS (
                SELECT 1 FROM chat_tags ct
                INNER JOIN tags t ON ct.tag_id = t.id
                WHERE ct.chat_id = chat.id AND t.tag_type IN ('hot', 'warm', 'cold')
              )
            )`,
            { tagTypes },
          );
        } else if (hasNull) {
          // Только "Без категории"
          selectedQueryBuilder = selectedQueryBuilder.andWhere(
            `NOT EXISTS (
              SELECT 1 FROM chat_tags ct
              INNER JOIN tags t ON ct.tag_id = t.id
              WHERE ct.chat_id = chat.id AND t.tag_type IN ('hot', 'warm', 'cold')
            )`,
          );
        } else if (tagTypes.length > 0) {
          // Только конкретные категории
          selectedQueryBuilder = selectedQueryBuilder.andWhere(
            `EXISTS (
              SELECT 1 FROM chat_tags ct
              INNER JOIN tags t ON ct.tag_id = t.id
              WHERE ct.chat_id = chat.id AND t.tag_type IN (:...tagTypes)
            )`,
            { tagTypes },
          );
        }
      }

      const selectedResult = await selectedQueryBuilder
        .select('COUNT(DISTINCT user.id)', 'count')
        .getRawOne();
      selectedTotal = parseInt(selectedResult?.count || '0', 10);
    }

    return {
      total,
      byStartParam,
      byBotId,
      byTagType,
      selectedTotal,
    };
  }

  /**
   * Проверяет, является ли ошибка ошибкой блокировки бота пользователем
   */
  private isBotBlockedError(error: any): boolean {
    if (!error) return false;

    // Проверяем код ошибки (403 обычно означает блокировку)
    const errorCode = error.response?.error_code || error.error_code;
    
    // Получаем сообщение об ошибке из различных источников
    const errorMessage = 
      error.response?.description || 
      error.description || 
      error.message || 
      String(error);

    if (!errorMessage) {
      // Если нет сообщения, но есть код 403, считаем это блокировкой
      return errorCode === 403;
    }

    const lowerErrorMessage = errorMessage.toLowerCase();

    // Паттерны ошибок, указывающих на блокировку бота
    const blockedPatterns = [
      'bot was blocked by the user',
      'bot blocked by the user',
      'user is deactivated',
      'chat not found',
      'forbidden: bot was blocked',
      'forbidden: user is deactivated',
      'forbidden: chat not found',
      'forbidden: the group chat was deleted',
      'bad request: chat not found',
      'bad request: group chat was deleted',
    ];

    // Проверяем код ошибки (403 обычно означает блокировку)
    if (errorCode === 403) {
      // 403 может означать разные вещи, проверяем описание
      if (lowerErrorMessage.includes('blocked') || 
          lowerErrorMessage.includes('deactivated') ||
          lowerErrorMessage.includes('chat not found')) {
        return true;
      }
    }

    // Проверяем по паттернам
    return blockedPatterns.some(pattern => 
      lowerErrorMessage.includes(pattern.toLowerCase())
    );
  }
}

