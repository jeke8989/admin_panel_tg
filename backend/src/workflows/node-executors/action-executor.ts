import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeExecutor } from './node-executor.abstract';
import { WorkflowNode } from '../../entities/WorkflowNode.entity';
import { TelegramService } from '../../telegram/telegram.service';
import { Message, MessageType } from '../../entities/Message.entity';
import { Chat } from '../../entities/Chat.entity';
import { Message as TelegramMessage } from 'telegraf/typings/core/types/typegram';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

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
            console.log(`[ActionExecutor] action-message config:`, JSON.stringify(config, null, 2));
            const messageType: string = config.messageType || 'text';
            const text: string = config.text || '';
            // Используем mediaFile, или извлекаем путь из mediaPreviewUrl если mediaFile пустой
            let mediaFile: string | undefined = config.mediaFile;
            if (!mediaFile && config.mediaPreviewUrl) {
              // Извлекаем путь из URL (например, из "http://localhost:3000/uploads/file.png" -> "/uploads/file.png")
              const previewUrl = config.mediaPreviewUrl as string;
              const uploadsMatch = previewUrl.match(/\/uploads\/[^?#]+/);
              if (uploadsMatch) {
                mediaFile = uploadsMatch[0];
                console.log(`[ActionExecutor] Extracted mediaFile from mediaPreviewUrl: ${mediaFile}`);
              }
            }
            const buttons: Array<Array<{ text: string; callback_data?: string }>> | undefined = config.buttons || [];
            
            console.log(`[ActionExecutor] messageType: ${messageType}, mediaFile: ${mediaFile || 'empty'}, text: ${text || 'empty'}`);

            // Для файлов с нашего сервера (/uploads/), создаём поток из локального файла
            // Telegram не может скачать файлы с localhost
            let mediaSource: string | { source: ReturnType<typeof createReadStream>; filename?: string } | undefined;
            let originalFilename: string | undefined;
            
            if (mediaFile && mediaFile.startsWith('/uploads/')) {
              // Путь к файлу на диске
              const localPath = join(process.cwd(), mediaFile);
              console.log(`[ActionExecutor] Checking local file: ${localPath}`);
              
              // Извлекаем имя файла (например, uuid.xlsx)
              const fileName = mediaFile.split('/').pop() || 'file';
              // Определяем расширение файла
              const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : '';
              // Формируем имя файла для Telegram (используем оригинальное имя из конфига или создаём читаемое имя)
              const originalName = config.originalFileName as string;
              if (originalName) {
                originalFilename = originalName;
              } else if (fileExtension) {
                // Создаём читаемое имя на основе расширения
                const extensionNames: Record<string, string> = {
                  'xlsx': 'document.xlsx',
                  'xls': 'document.xls',
                  'doc': 'document.doc',
                  'docx': 'document.docx',
                  'pdf': 'document.pdf',
                  'png': 'image.png',
                  'jpg': 'image.jpg',
                  'jpeg': 'image.jpeg',
                  'gif': 'image.gif',
                  'mp4': 'video.mp4',
                  'mp3': 'audio.mp3',
                };
                originalFilename = extensionNames[fileExtension.toLowerCase()] || `file.${fileExtension}`;
              } else {
                originalFilename = fileName;
              }
              
              if (existsSync(localPath)) {
                // Создаём поток для отправки файла с именем
                mediaSource = { 
                  source: createReadStream(localPath),
                  filename: originalFilename
                };
                console.log(`[ActionExecutor] Using local file stream for: ${localPath}, filename: ${originalFilename}`);
              } else {
                console.error(`[ActionExecutor] Local file not found: ${localPath}`);
                mediaSource = undefined;
              }
            } else if (mediaFile) {
              // Для внешних URL или file_id используем как есть
              mediaSource = mediaFile;
              console.log(`[ActionExecutor] Using external URL or file_id: ${mediaFile}`);
            }

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
                  if (!mediaSource) {
                    console.warn('[ActionExecutor] Media file is missing for photo message, falling back to text');
                    if (text) {
                      // Fallback: отправляем текстовое сообщение
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
                    } else {
                      console.error('[ActionExecutor] No media file and no text - nothing to send');
                      return false;
                    }
                    break;
                  }
                  console.log(`[ActionExecutor] Sending photo message. Caption: "${text}", mediaSource type: ${typeof mediaSource === 'object' ? 'stream' : 'string'}`);
                  const msg = await this.telegramService.sendPhoto(
                    botId,
                    telegramChatId,
                    mediaSource as any,
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
                  if (!mediaSource) {
                    console.error('Media file is required for video message');
                    return false;
                  }
                  const msg = await this.telegramService.sendVideo(
                    botId,
                    telegramChatId,
                    mediaSource as any,
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
                  if (!mediaSource) {
                    console.error('Media file is required for document message');
                    return false;
                  }
                  const msg = await this.telegramService.sendDocument(
                    botId,
                    telegramChatId,
                    mediaSource as any,
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
                  if (!mediaSource) {
                    console.error('Media file is required for audio message');
                    return false;
                  }
                  const msg = await this.telegramService.sendAudio(
                    botId,
                    telegramChatId,
                    mediaSource as any,
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
                  if (!mediaSource) {
                    console.error('Media file is required for voice message');
                    return false;
                  }
                  const msg = await this.telegramService.sendVoice(
                    botId,
                    telegramChatId,
                    mediaSource as any,
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
                  if (!mediaSource) {
                    console.error('Media file is required for animation message');
                    return false;
                  }
                  const msg = await this.telegramService.sendAnimation(
                    botId,
                    telegramChatId,
                    mediaSource as any,
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
                    isFromBot: true,   // Отмечаем как сообщение бота, чтобы скрывать в UI
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

