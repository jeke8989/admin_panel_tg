import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Chat } from './Chat.entity';
import { User } from './User.entity';
import { MessageRead } from './MessageRead.entity';
import { MessageReaction } from './MessageReaction.entity';
import { Bot } from './Bot.entity';

export enum MessageType {
  TEXT = 'text',
  PHOTO = 'photo',
  VIDEO = 'video',
  VOICE = 'voice',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  STICKER = 'sticker',
  VIDEO_NOTE = 'video_note',
  ANIMATION = 'animation',
  LOCATION = 'location',
  CONTACT = 'contact',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, (chat) => chat.messages)
  @JoinColumn({ name: 'chat_id' })
  @Index()
  chat: Chat;

  @Column({ name: 'chat_id' })
  chatId: string;

  @ManyToOne(() => Bot, (bot) => bot.messages)
  @JoinColumn({ name: 'bot_id' })
  @Index()
  bot: Bot;

  @Column({ name: 'bot_id' })
  botId: string;

  @ManyToOne(() => User, (user) => user.messages)
  @JoinColumn({ name: 'sender_id' })
  @Index()
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ type: 'boolean', default: false, name: 'is_from_admin' })
  isFromAdmin: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_from_bot' })
  isFromBot: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_delivered' })
  isDelivered: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_read' })
  isRead: boolean;

  @Column({ type: 'bigint', name: 'telegram_message_id' })
  @Index()
  telegramMessageId: number;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
    name: 'message_type',
  })
  messageType: MessageType;

  @Column({ type: 'text', nullable: true, name: 'file_id' })
  fileId: string | null;

  @Column({ type: 'text', nullable: true, name: 'file_unique_id' })
  fileUniqueId: string | null;

  @Column({ type: 'text', nullable: true, name: 'file_path' })
  filePath: string | null;

  @Column({ type: 'text', nullable: true, name: 'file_url' })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'file_name' })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @OneToMany(() => MessageRead, (messageRead) => messageRead.message, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  reads: MessageRead[];

  @OneToMany(() => MessageReaction, (reaction) => reaction.message, {
    cascade: true,
    eager: true,
  })
  reactions: MessageReaction[];

  @Column({ name: 'reply_to_message_id', nullable: true })
  replyToMessageId: string | null;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'reply_to_message_id' })
  replyToMessage: Message | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

