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
import { Admin } from './Admin.entity';
import { MessageType } from './Message.entity';
import { BroadcastRecipient } from './BroadcastRecipient.entity';

export enum BroadcastStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('broadcasts')
export class Broadcast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

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

  @Column({ type: 'text', nullable: true, name: 'file_url' })
  fileUrl: string | null;

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @Column({ type: 'jsonb', nullable: true })
  segments: {
    startParams?: string[];
    botIds?: string[];
    lastInteractionAfter?: string;
    lastInteractionBefore?: string;
  } | null;

  @Column({
    type: 'enum',
    enum: BroadcastStatus,
    default: BroadcastStatus.DRAFT,
  })
  status: BroadcastStatus;

  @ManyToOne(() => Admin)
  @JoinColumn({ name: 'created_by' })
  @Index()
  createdBy: Admin;

  @Column({ name: 'created_by' })
  createdById: string;

  @Column({ type: 'timestamp', nullable: true, name: 'scheduled_at' })
  scheduledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'sent_at' })
  sentAt: Date | null;

  @Column({ type: 'integer', default: 0, name: 'total_recipients' })
  totalRecipients: number;

  @Column({ type: 'integer', default: 0, name: 'sent_count' })
  sentCount: number;

  @Column({ type: 'integer', default: 0, name: 'delivered_count' })
  deliveredCount: number;

  @Column({ type: 'integer', default: 0, name: 'read_count' })
  readCount: number;

  @OneToMany(() => BroadcastRecipient, (recipient) => recipient.broadcast, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  recipients: BroadcastRecipient[];

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

