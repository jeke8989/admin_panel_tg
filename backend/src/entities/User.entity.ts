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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true, name: 'telegram_id' })
  @Index()
  telegramId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'last_name' })
  lastName: string | null;

  @Column({ type: 'text', nullable: true, name: 'avatar_url' })
  avatarUrl: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_bot' })
  isBot: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'start_param' })
  startParam: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'language_code' })
  languageCode: string | null;

  @OneToMany(() => Chat, (chat) => chat.user)
  chats: Chat[];

  @OneToMany(() => Message, (message) => message.sender)
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

