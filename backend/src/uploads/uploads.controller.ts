import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          try {
            // Используем абсолютный путь относительно корня проекта
            const uploadsPath = join(process.cwd(), 'uploads');
            console.log(`[UploadsController] Upload destination: ${uploadsPath}`);
            
            // Создаём папку, если её нет
            if (!existsSync(uploadsPath)) {
              mkdirSync(uploadsPath, { recursive: true });
              console.log(`[UploadsController] Created uploads directory: ${uploadsPath}`);
            }
            
            cb(null, uploadsPath);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[UploadsController] Error creating uploads directory: ${errorMessage}`);
            cb(new Error(`Ошибка при создании директории для загрузки: ${errorMessage}`), null);
          }
        },
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          console.log(`[UploadsController] Generated filename: ${uniqueName}`);
          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
      fileFilter: (req, file, cb) => {
        // Разрешаем изображения, видео, аудио, документы
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'audio/mpeg',
          'audio/ogg',
          'audio/wav',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        
        // Логируем информацию о файле
        console.log(`[UploadsController] File filter: mimetype=${file.mimetype}, originalname=${file.originalname}`);
        
        // Если mimetype не определен, разрешаем загрузку (браузер может не отправлять mimetype)
        if (!file.mimetype || allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          console.error(`[UploadsController] Rejected file: mimetype=${file.mimetype} not in allowed list`);
          cb(new BadRequestException(`Неподдерживаемый тип файла: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    this.logger.log(`Upload request received. File: ${file ? file.originalname : 'null'}`);
    
    if (!file) {
      this.logger.error('File is null or undefined');
      throw new BadRequestException('Файл не загружен');
    }

    try {
      // Проверяем, что файл действительно сохранен
      const uploadsPath = join(process.cwd(), 'uploads');
      const filePath = join(uploadsPath, file.filename);
      
      if (!existsSync(filePath)) {
        this.logger.error(`File was not saved: ${filePath}`);
        throw new InternalServerErrorException('Ошибка при сохранении файла');
      }

      this.logger.log(`File uploaded successfully: ${file.filename}, size: ${file.size}, mimetype: ${file.mimetype}, path: ${filePath}`);

      // Возвращаем URL файла относительно сервера
      const fileUrl = `/uploads/${file.filename}`;
      
      return {
        url: fileUrl,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(`Error in uploadFile: ${error}`);
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Ошибка при обработке загруженного файла');
    }
  }
}

