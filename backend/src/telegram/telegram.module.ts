import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { Bot } from '../entities/Bot.entity';
import { Chat } from '../entities/Chat.entity';
import { User } from '../entities/User.entity';
import { Message } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { BroadcastRecipient } from '../entities/BroadcastRecipient.entity';
import { BotWorkflow } from '../entities/BotWorkflow.entity';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bot, Chat, User, Message, MessageRead, BroadcastRecipient, BotWorkflow]),
    forwardRef(() => WorkflowsModule),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}

