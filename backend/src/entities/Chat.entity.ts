import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './User.entity';
import { Message } from './Message.entity';
import { ChatUnreadCount } from './ChatUnreadCount.entity';
import { Bot } from './Bot.entity';
import { Tag } from './Tag.entity';

export enum ChatType {
  PRIVATE = 'private',
  GROUP = 'group',
  SUPERGROUP = 'supergroup',
  CHANNEL = 'channel',
}

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', name: 'telegram_chat_id' })
  @Index()
  telegramChatId: number;

  @ManyToOne(() => Bot, (bot) => bot.chats)
  @JoinColumn({ name: 'bot_id' })
  @Index()
  bot: Bot;

  @Column({ name: 'bot_id' })
  botId: string;

  @Column({
    type: 'enum',
    enum: ChatType,
    default: ChatType.PRIVATE,
    name: 'chat_type',
  })
  chatType: ChatType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @ManyToOne(() => User, (user) => user.chats)
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'last_message_id' })
  lastMessage: Message | null;

  @Column({ name: 'last_message_id', nullable: true })
  lastMessageId: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_message_at' })
  @Index() // Индекс для быстрой сортировки чатов по времени последнего сообщения
  lastMessageAt: Date | null;

  @Column({ type: 'boolean', default: false, name: 'is_bot_blocked' })
  isBotBlocked: boolean;

  @OneToMany(() => Message, (message) => message.chat, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  messages: Message[];

  @OneToMany(() => ChatUnreadCount, (unreadCount) => unreadCount.chat, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  unreadCounts: ChatUnreadCount[];

  @ManyToMany(() => Tag, (tag) => tag.chats)
  @JoinTable({
    name: 'chat_tags',
    joinColumn: { name: 'chat_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

