import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bots/:botId/workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  findAll(@Param('botId', ParseUUIDPipe) botId: string) {
    return this.workflowsService.findAll(botId);
  }

  @Post()
  create(
    @Param('botId', ParseUUIDPipe) botId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowsService.create(botId, createWorkflowDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(id, updateWorkflowDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.remove(id);
  }

  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.toggleActive(id, true);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowsService.toggleActive(id, false);
  }

  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
    },
  }))
  @UseGuards(JwtAuthGuard)
  async uploadFile(
    @Param('botId', ParseUUIDPipe) botId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    console.log('[WorkflowsController] File upload request:', { 
      botId, 
      fileName: file?.originalname, 
      fileSize: file?.size,
      mimetype: file?.mimetype 
    });
    
    if (!file) {
      console.error('[WorkflowsController] File is missing');
      throw new BadRequestException('Файл не предоставлен');
    }
    
    try {
      const result = await this.workflowsService.uploadFileToTelegram(botId, file);
      console.log('[WorkflowsController] File upload success:', result);
      return result;
    } catch (error) {
      console.error('[WorkflowsController] File upload error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Преобразуем ошибки в HTTP исключения
      if (errorMessage.includes('не найден')) {
        throw new NotFoundException(errorMessage);
      }
      if (errorMessage.includes('Не найден чат')) {
        throw new BadRequestException(errorMessage);
      }
      
      throw new BadRequestException(`Ошибка при загрузке файла: ${errorMessage}`);
    }
  }

  @Get('files/:fileId/url')
  async getFileUrl(
    @Param('botId', ParseUUIDPipe) botId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.workflowsService.getFileUrl(botId, fileId);
  }
}

