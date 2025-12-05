import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { TelegramModule } from './telegram/telegram.module';
import { TemplatesModule } from './templates/templates.module';
import { TagsModule } from './tags/tags.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    ChatsModule,
    TelegramModule,
    TemplatesModule,
    TagsModule,
    WorkflowsModule,
    BroadcastsModule,
    UploadsModule,
  ],
})
export class AppModule {}

