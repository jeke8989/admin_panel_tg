import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotSettingsDto } from './dto/update-bot-settings.dto';

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get()
  async getAllBots() {
    return this.telegramService.getAllBots();
  }

  @Get(':id')
  async getBotInfo(@Param('id') id: string) {
    return this.telegramService.getBotInfo(id);
  }

  @Get(':id/statistics')
  async getBotStatistics(@Param('id') id: string) {
    return this.telegramService.getBotStatistics(id);
  }

  @Post()
  async createBot(@Body() dto: CreateBotDto) {
    return this.telegramService.createBot(dto.token);
  }

  @Post(':id/toggle-status')
  @HttpCode(HttpStatus.OK)
  async toggleBotStatus(@Param('id') id: string) {
    return this.telegramService.toggleBotStatus(id);
  }

  @Patch(':id/settings')
  @HttpCode(HttpStatus.OK)
  async updateBotSettings(
    @Param('id') id: string,
    @Body() dto: UpdateBotSettingsDto,
  ) {
    return this.telegramService.updateBotSettings(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteBot(@Param('id') id: string) {
    await this.telegramService.deleteBot(id);
    return { message: 'Бот успешно удален' };
  }
}

