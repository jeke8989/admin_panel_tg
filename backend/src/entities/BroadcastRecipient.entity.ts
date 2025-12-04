import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Broadcast } from './Broadcast.entity';
import { User } from './User.entity';
import { Chat } from './Chat.entity';
import { Bot } from './Bot.entity';
import { Message } from './Message.entity';

export enum BroadcastRecipientStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('broadcast_recipients')
@Index(['broadcastId', 'userId'])
export class BroadcastRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Broadcast, (broadcast) => broadcast.recipients)
  @JoinColumn({ name: 'broadcast_id' })
  @Index()
  broadcast: Broadcast;

  @Column({ name: 'broadcast_id' })
  broadcastId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Chat)
  @JoinColumn({ name: 'chat_id' })
  @Index()
  chat: Chat;

  @Column({ name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => Bot)
  @JoinColumn({ name: 'bot_id' })
  @Index()
  bot: Bot;

  @Column({ name: 'bot_id' })
  botId: string;

  @Column({
    type: 'enum',
    enum: BroadcastRecipientStatus,
    default: BroadcastRecipientStatus.PENDING,
  })
  status: BroadcastRecipientStatus;

  @Column({ type: 'bigint', nullable: true, name: 'telegram_message_id' })
  telegramMessageId: number | null;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'message_id' })
  @Index()
  message: Message | null;

  @Column({ name: 'message_id', nullable: true })
  messageId: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'sent_at' })
  sentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'delivered_at' })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'read_at' })
  readAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

