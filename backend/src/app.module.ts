import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { TelegramModule } from './telegram/telegram.module';
import { TemplatesModule } from './templates/templates.module';
import { TagsModule } from './tags/tags.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    AuthModule,
    ChatsModule,
    TelegramModule,
    TemplatesModule,
    TagsModule,
    WorkflowsModule,
    BroadcastsModule,
  ],
})
export class AppModule {}

