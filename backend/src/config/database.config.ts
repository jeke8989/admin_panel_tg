import { config } from 'dotenv';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/User.entity';
import { Chat } from '../entities/Chat.entity';
import { Message } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { MessageReaction } from '../entities/MessageReaction.entity';
import { ChatUnreadCount } from '../entities/ChatUnreadCount.entity';
import { Admin } from '../entities/Admin.entity';
import { Bot } from '../entities/Bot.entity';
import { Template } from '../entities/Template.entity';
import { TemplateFile } from '../entities/TemplateFile.entity';
import { Tag } from '../entities/Tag.entity';
import { BotWorkflow } from '../entities/BotWorkflow.entity';
import { WorkflowNode } from '../entities/WorkflowNode.entity';
import { WorkflowConnection } from '../entities/WorkflowConnection.entity';
import { Broadcast } from '../entities/Broadcast.entity';
import { BroadcastRecipient } from '../entities/BroadcastRecipient.entity';

config();

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'admin_telegram',
  entities: [
    User, Chat, Message, MessageRead, MessageReaction, ChatUnreadCount, 
    Admin, Bot, Template, TemplateFile, Tag,
    BotWorkflow, WorkflowNode, WorkflowConnection,
    Broadcast, BroadcastRecipient
  ],
  synchronize: true, // В продакшене должно быть false
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsRun: false,
};

