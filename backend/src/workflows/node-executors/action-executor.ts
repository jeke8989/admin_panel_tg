import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeExecutor } from './node-executor.abstract';
import { WorkflowNode } from '../../entities/WorkflowNode.entity';
import { TelegramService } from '../../telegram/telegram.service';
import { Message, MessageType } from '../../entities/Message.entity';
import { Chat } from '../../entities/Chat.entity';
import { Message as TelegramMessage } from 'telegraf/typings/core/types/typegram';

@Injectable()
export class ActionExecutor extends NodeExecutor {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
  ) {
    super();
  }

  async execute(node: WorkflowNode, context: { botId: string; telegramChatId: number; chatId?: string }): Promise<boolean> {
    const { type, config } = node;
    const { botId, telegramChatId, chatId } = context;

    if (!telegramChatId) {
      console.error('Telegram Chat ID is missing in context');
      return false;
    }

    switch (type) {
        case 'action-message': {
            const messageType: string = config.messageType || 'text';
            const text: string = config.text || '';
            const mediaFile: string | undefined = config.mediaFile;
            const buttons: Array<Array<{ text: string; callback_data?: string }>> | undefined = config.buttons || [];

            // Convert buttons format if needed
            const inlineKeyboard = Array.isArray(buttons) && buttons.length > 0 
              ? buttons.map((row) => 
                  Array.isArray(row) ? row : [row]
                )
              : undefined;

            try {
              let sentMessage: TelegramMessage | null = null;
              let dbMessageType = MessageType.TEXT;
              let fileId: string | null = null;
              let fileUrl: string | null = null;
              let telegramMessageId: number | null = null;

              switch (messageType) {
                case 'text': {
                  console.log(`[ActionExecutor] Sending text message. Content: "${text}"`);
                  const msg = await this.telegramService.sendMessage(
                    botId, 
                    telegramChatId, 
                    text, 
                    undefined, 
                    inlineKeyboard
                  );
                  sentMessage = msg;
                  dbMessageType = MessageType.TEXT;
                  telegramMessageId = msg.message_id;
                  break;
                }

                case 'photo': {
                  if (!mediaFile) {
                    console.error('Media file is required for photo message');
                    return false;
                  }
                  console.log(`[ActionExecutor] Sending photo message. Caption: "${text}"`);
                  const msg = await this.telegramService.sendPhoto(
                    botId,
                    telegramChatId,
                    mediaFile,
                    text || undefined,
                    undefined,
                    inlineKeyboard
                  );
                  sentMessage = msg;
                  dbMessageType = MessageType.PHOTO;
                  fileId = msg.photo[msg.photo.length - 1].file_id;
                  telegramMessageId = msg.message_id;
                  break;
                }

                case 'video': {
                  if (!mediaFile) {
                    console.error('Media file is required for video message');
                    return false;
                  }
                  const msg = await this.telegramService.sendVideo(
                    botId,
                    telegramChatId,
                    mediaFile,
                    text || undefined,
                    undefined,
                    inlineKeyboard
                  );
                  sentMessage = msg;
                  dbMessageType = MessageType.VIDEO;
                  fileId = msg.video.file_id;
                  telegramMessageId = msg.message_id;
                  break;
                }

                case 'document': {
                  if (!mediaFile) {
                    console.error('Media file is required for document message');
                    return false;
                  }
                  const msg = await this.telegramService.sendDocument(
                    botId,
                    telegramChatId,
                    mediaFile,
                    text || undefined,
                    undefined,
                    inlineKeyboard
                  );
                  sentMessage = msg;
                  dbMessageType = MessageType.DOCUMENT;
                  fileId = msg.document.file_id;
                  telegramMessageId = msg.message_id;
                  break;
                }

                case 'audio': {
                  if (!mediaFile) {
                    console.error('Media file is required for audio message');
                    return false;
                  }
                  const msg = await this.telegramService.sendAudio(
                    botId,
                    telegramChatId,
                    mediaFile,
                    text || undefined,
                    undefined,
                    inlineKeyboard
                  );
                  sentMessage = msg;
                  dbMessageType = MessageType.AUDIO;
                  fileId = msg.audio.file_id;
                  telegramMessageId = msg.message_id;
                  break;
                }

                case 'voice': {
                  if (!mediaFile) {
                    console.error('Media file is required for voice message');
                    return false;
                  }
                  const msg = await this.telegramService.sendVoice(
                    botId,
                    telegramChatId,
                    mediaFile,
                    undefined,
                    inlineKeyboard
                  );
                  sentMessage = msg;
                  dbMessageType = MessageType.VOICE;
                  fileId = msg.voice.file_id;
                  telegramMessageId = msg.message_id;
                  break;
                }

                case 'animation': {
                  if (!mediaFile) {
                    console.error('Media file is required for animation message');
                    return false;
                  }
                  const msg = await this.telegramService.sendAnimation(
                    botId,
                    telegramChatId,
                    mediaFile,
                    text || undefined,
                    undefined,
                    inlineKeyboard
                  );
                  sentMessage = msg;
                  dbMessageType = MessageType.ANIMATION;
                  fileId = msg.animation.file_id;
                  telegramMessageId = msg.message_id;
                  break;
                }

                default: {
                  console.error(`Unknown message type: ${messageType}`);
                  return false;
                }
              }

              // Сохраняем сообщение в базу данных, если есть chatId
              if (chatId && sentMessage && telegramMessageId) {
                try {
                  // Получаем URL файла если есть fileId
                  if (fileId) {
                    fileUrl = await this.telegramService.getFileUrl(botId, fileId);
                  }

                  // Получаем chat для получения userId
                  const chat = await this.chatRepository.findOne({
                    where: { id: chatId },
                  });

                  if (chat) {
                    const message = this.messageRepository.create({
                      chatId,
                      botId,
                      senderId: chat.userId, // Сообщение от бота (workflow)
                      text: text || null,
                      caption: (messageType !== 'text' && text) ? text : null,
                      messageType: dbMessageType,
                      fileId,
                      fileUrl,
                      telegramMessageId,
                      isFromAdmin: true, // Сообщения от workflow считаются от админа
                      isDelivered: true,
                    });

                    const savedMessage = await this.messageRepository.save(message);

                    // Обновляем последнее сообщение в чате
                    await this.chatRepository.update(chatId, {
                      lastMessageId: savedMessage.id,
                      lastMessageAt: new Date(),
                    });
                  }
                } catch (dbError) {
                  console.error('Ошибка при сохранении сообщения в БД:', dbError);
                  // Не прерываем выполнение, если не удалось сохранить в БД
                }
              }
            } catch (error) {
              console.error(`Error sending ${messageType} message:`, error);
              return false;
            }
            break;
        }
            
        case 'action-delay': {
            const delay = config.delay || 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            break;
        }
            
        // Add other actions
    }
    return true;
  }
}

