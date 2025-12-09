import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { BroadcastsService } from './broadcasts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { SkipValidationPipe } from '../common/pipes/skip-validation.pipe';

@Controller('broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Get('test')
  test() {
    return { message: 'Broadcasts controller is working' };
  }

  @Post()
  @UsePipes(new SkipValidationPipe())
  @UseGuards(JwtAuthGuard)
  async createBroadcast(
    @Body() rawBody: Record<string, unknown> | undefined,
    @CurrentAdmin() admin: { id: string },
  ) {
    const body = rawBody || {};
    console.log('[BroadcastsController] POST /broadcasts called');
    console.log('[BroadcastsController] Body:', JSON.stringify(body, null, 2));
    console.log('[BroadcastsController] Admin ID:', admin.id);

    // Парсим segments из JSON строки если есть
    let segments = null;
    if (body.segments) {
      try {
        segments = typeof body.segments === 'string' 
          ? JSON.parse(body.segments) 
          : body.segments;
      } catch (e) {
        console.error('[BroadcastsController] Error parsing segments:', e);
        segments = body.segments;
      }
    }

    const dto: CreateBroadcastDto = {
      name: (body.name as string) || '',
      text: (body.text as string) || '',
      segments: segments || undefined,
      sendImmediately: body.sendImmediately === 'true' || body.sendImmediately === true,
    };

    console.log('[BroadcastsController] DTO:', JSON.stringify(dto, null, 2));

    return this.broadcastsService.createBroadcast(dto, admin.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getBroadcasts(@CurrentAdmin() admin: { id: string; role: string }) {
    // Admin может видеть все рассылки, user - только свои
    const adminId = admin.role === 'admin' ? undefined : admin.id;
    return this.broadcastsService.getBroadcasts(adminId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBroadcastById(@Param('id') id: string) {
    return this.broadcastsService.getBroadcastById(id);
  }

  @Get(':id/statistics')
  @UseGuards(JwtAuthGuard)
  async getBroadcastStatistics(@Param('id') id: string) {
    return this.broadcastsService.getBroadcastStatistics(id);
  }

  @Get(':id/recipients')
  @UseGuards(JwtAuthGuard)
  async getBroadcastRecipients(@Param('id') id: string) {
    const broadcast = await this.broadcastsService.getBroadcastById(id);
    return broadcast.recipients;
  }

  @Post(':id/send')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendBroadcast(@Param('id') id: string) {
    // Запускаем отправку асинхронно
    this.broadcastsService.sendBroadcast(id).catch((error) => {
      console.error(`Ошибка при отправке рассылки ${id}:`, error);
    });
    return { message: 'Рассылка запущена' };
  }

  @Post(':id/copy')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async copyBroadcast(
    @Param('id') id: string,
    @CurrentAdmin() admin: { id: string },
  ) {
    try {
      return await this.broadcastsService.copyBroadcast(id, admin.id);
    } catch (error) {
      console.error(`[BroadcastsController] Error copying broadcast ${id}:`, error);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBroadcast(@Param('id') id: string) {
    try {
      await this.broadcastsService.deleteBroadcast(id);
    } catch (error) {
      console.error(`[BroadcastsController] Error deleting broadcast ${id}:`, error);
      throw error;
    }
  }
}

