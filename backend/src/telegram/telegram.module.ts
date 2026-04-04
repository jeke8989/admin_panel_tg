import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { config } from 'dotenv';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { Bot } from '../entities/Bot.entity';
import { Chat } from '../entities/Chat.entity';
import { User } from '../entities/User.entity';
import { Message } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { BroadcastRecipient } from '../entities/BroadcastRecipient.entity';
import { BotWorkflow } from '../entities/BotWorkflow.entity';
import { Tag } from '../entities/Tag.entity';
import { WorkflowsModule } from '../workflows/workflows.module';

config();

@Module({
  imports: [
    TypeOrmModule.forFeature([Bot, Chat, User, Message, MessageRead, BroadcastRecipient, BotWorkflow, Tag]),
    forwardRef(() => WorkflowsModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '72h' },
    }),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}

