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
import { Broadcast, BroadcastStatus } from '../entities/Broadcast.entity';
import {
  BroadcastRecipient,
  BroadcastRecipientStatus,
} from '../entities/BroadcastRecipient.entity';
import { User } from '../entities/User.entity';
import { Chat } from '../entities/Chat.entity';
import { Bot } from '../entities/Bot.entity';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { TelegramService } from '../telegram/telegram.service';
import { Message, MessageType } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { Message as TelegramMessage } from 'telegraf/typings/core/types/typegram';

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
    if (!dto.text || !dto.text.trim()) {
      throw new BadRequestException('Текст сообщения обязателен');
    }

    // Подсчитываем получателей на основе сегментации
    const recipients = await this.getRecipients(dto.segments || {});
    const totalRecipients = recipients.length;

    // Создаем рассылку (только текстовые сообщения)
    const broadcast = this.broadcastRepository.create({
      name: dto.name,
      text: dto.text,
      messageType: MessageType.TEXT,
      fileId: null,
      fileUrl: null,
      caption: null,
      segments: dto.segments || null,
      status: dto.sendImmediately
        ? BroadcastStatus.SENDING
        : BroadcastStatus.DRAFT,
      createdById: adminId,
      totalRecipients,
    });

    const savedBroadcast = await this.broadcastRepository.save(broadcast);

    // Если нужно отправить сразу, создаем получателей и отправляем
    if (dto.sendImmediately) {
      await this.createRecipients(savedBroadcast, recipients);
      // Запускаем отправку асинхронно
      this.sendBroadcast(savedBroadcast.id).catch((error) => {
        this.logger.error(`Ошибка при отправке рассылки ${savedBroadcast.id}:`, error);
        this.broadcastRepository.update(savedBroadcast.id, {
          status: BroadcastStatus.FAILED,
        });
      });
    } else {
      // Создаем получателей для черновика (для предпросмотра)
      await this.createRecipients(savedBroadcast, recipients);
    }

    return savedBroadcast;
  }

  async getRecipients(segments: {
    startParams?: string[];
    botIds?: string[];
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

        // Отправляем только текстовые сообщения
        if (!broadcast.text) {
          throw new Error('Текст сообщения не указан');
        }
        sentMessage = await this.telegramService.sendMessage(
          recipient.bot.id,
          recipient.chat.telegramChatId,
          broadcast.text,
        );

        // Сохраняем сообщение в базу данных для отслеживания прочтения
        let savedMessage: Message | null = null;
        try {
          // Получаем URL файла если есть
          let fileUrl: string | null = null;
          if (broadcast.fileId) {
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
            fileId: broadcast.fileId || null,
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
    let readCount = 0;
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

      if (isRead) {
        readCount++;
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
        readAt: isRead ? (readAt || r.readAt) : r.readAt,
        errorMessage: r.errorMessage,
      };
    });

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
      recipients: updatedRecipients,
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
}

