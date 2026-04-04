import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { Response } from 'express';
import axios from 'axios';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('tagId') tagId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.chatsService.findAll(
      tagId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('test-route')
  testRoute() {
    return { message: 'Test route works!' };
  }

  // Endpoints для работы с тегами - должны быть ПЕРЕД параметризованными роутами
  @Get('tags-list')
  @UseGuards(JwtAuthGuard)
  async getAllTags() {
    return this.chatsService.getAllTags();
  }

  // Прокси для загрузки файлов с Telegram (обход CORS)
  @Get('proxy-telegram-file')
  async proxyTelegramFile(
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    try {
      // Проверяем, что URL относится к Telegram
      if (!url || !url.includes('api.telegram.org')) {
        return res.status(400).json({ error: 'Invalid URL' });
      }

      // Загружаем файл с Telegram
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      // Устанавливаем заголовки
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Кешируем на 1 день

      // Отправляем файл
      res.send(Buffer.from(response.data));
    } catch (error) {
      console.error('Error proxying Telegram file:', error);
      res.status(500).json({ error: 'Failed to load file' });
    }
  }

  // Специфичные роуты ПЕРЕД параметризованными
  @Get(':chatId/messages')
  @UseGuards(JwtAuthGuard)
  findMessagesByChatId(
    @Param('chatId') chatId: string,
    @Query() dto: GetMessagesDto,
  ) {
    return this.chatsService.findMessagesByChatId(chatId, dto);
  }

  @Post(':chatId/messages')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  createMessage(
    @Param('chatId') chatId: string,
    @CurrentAdmin() admin: { id: string; email: string },
    @Body() dto: CreateMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.chatsService.createMessage(chatId, admin.id, dto, file);
  }

  @Post(':chatId/mark-as-read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  markChatAsRead(@Param('chatId') chatId: string) {
    return this.chatsService.markChatAsRead(chatId);
  }

  // POST для удаления ПОСЛЕ всех специфичных роутов
  @Post(':id/delete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteChat(@Param('id') chatId: string) {
    console.log(`POST /chats/${chatId}/delete вызван`);
    try {
      const result = await this.chatsService.deleteChat(chatId);
      console.log(`POST /chats/${chatId}/delete успешно выполнен`);
      return result;
    } catch (error) {
      console.error(`Ошибка в POST /chats/${chatId}/delete:`, error);
      throw error;
    }
  }

  @Post('messages/:messageId/delete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteMessage(@Param('messageId') messageId: string) {
    return this.chatsService.deleteMessage(messageId);
  }

  @Post(':chatId/clear-history')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async clearChatHistory(@Param('chatId') chatId: string) {
    return this.chatsService.clearChatHistory(chatId);
  }

  // Endpoints для реакций
  @Post('messages/:messageId/reactions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async addReaction(
    @Param('messageId') messageId: string,
    @CurrentAdmin() admin: { id: string; email: string },
    @Body() addReactionDto: AddReactionDto,
  ) {
    return this.chatsService.addReaction(messageId, admin.id, addReactionDto);
  }

  @Delete('messages/:messageId/reactions/:reactionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeReaction(
    @Param('messageId') messageId: string,
    @Param('reactionId') reactionId: string,
  ) {
    return this.chatsService.removeReaction(messageId, reactionId);
  }

  @Post(':chatId/tags/:tagId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async addTagToChat(
    @Param('chatId') chatId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.chatsService.addTagToChat(chatId, tagId);
  }

  @Delete(':chatId/tags/:tagId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeTagFromChat(
    @Param('chatId') chatId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.chatsService.removeTagFromChat(chatId, tagId);
  }
}

