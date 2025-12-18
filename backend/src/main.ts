import 'reflect-metadata';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BroadcastsService } from './broadcasts/broadcasts.service';

config();

async function bootstrap() {
  // Создаём папку uploads, если её нет
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory: ${uploadsDir}`);
  }

  const app = await NestFactory.create(AppModule);
  
  // Устанавливаем глобальный префикс для API
  app.setGlobalPrefix('api');

  // Логируем все запросы
  app.use((req, res, next) => {
    console.log(`Request: ${req.method} ${req.originalUrl} from ${req.get('origin')}`);
    next();
  });
  
  // Включаем валидацию для DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(', ');
        });
        return new BadRequestException(messages.join('; '));
      },
    }),
  );
  
  // Включаем CORS для работы с фронтендом
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const origins = frontendUrl.includes(',') 
    ? frontendUrl.split(',').map(url => url.trim()) 
    : frontendUrl;

  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);

  // Запускаем периодическую проверку запланированных рассылок
  const broadcastsService = app.get(BroadcastsService);
  // Проверяем каждую минуту
  setInterval(async () => {
    try {
      await broadcastsService.processScheduledBroadcasts();
    } catch (error) {
      console.error('Ошибка при обработке запланированных рассылок:', error);
    }
  }, 60000); // 60 секунд = 1 минута

  console.log('Scheduler для запланированных рассылок запущен (проверка каждую минуту)');
}

bootstrap();
