import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Chat } from './Chat.entity';
import { Message } from './Message.entity';
import { BotWorkflow } from './BotWorkflow.entity';

@Entity('bots')
export class Bot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  @Index()
  token: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'first_name' })
  firstName: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'notification_group_id' })
  notificationGroupId: string | null;

  @OneToMany(() => Chat, (chat) => chat.bot)
  chats: Chat[];

  @OneToMany(() => Message, (message) => message.bot)
  messages: Message[];

  @OneToMany(() => BotWorkflow, (workflow) => workflow.bot)
  workflows: BotWorkflow[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

