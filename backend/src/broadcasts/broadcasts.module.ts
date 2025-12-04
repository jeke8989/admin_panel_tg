import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BroadcastsService } from './broadcasts.service';
import { BroadcastsController } from './broadcasts.controller';
import { Broadcast } from '../entities/Broadcast.entity';
import { BroadcastRecipient } from '../entities/BroadcastRecipient.entity';
import { User } from '../entities/User.entity';
import { Chat } from '../entities/Chat.entity';
import { Bot } from '../entities/Bot.entity';
import { Admin } from '../entities/Admin.entity';
import { Message } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Broadcast,
      BroadcastRecipient,
      User,
      Chat,
      Bot,
      Admin,
      Message,
      MessageRead,
    ]),
    forwardRef(() => TelegramModule),
  ],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
  exports: [BroadcastsService],
})
export class BroadcastsModule {}

