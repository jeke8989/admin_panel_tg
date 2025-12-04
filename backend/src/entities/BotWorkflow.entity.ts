import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Bot } from './Bot.entity';
import { WorkflowNode } from './WorkflowNode.entity';
import { WorkflowConnection } from './WorkflowConnection.entity';

@Entity('bot_workflows')
export class BotWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bot_id' })
  botId: string;

  @ManyToOne(() => Bot, (bot) => bot.workflows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bot_id' })
  bot: Bot;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_active' })
  isActive: boolean;

  @OneToMany(() => WorkflowNode, (node) => node.workflow)
  nodes: WorkflowNode[];

  @OneToMany(() => WorkflowConnection, (connection) => connection.workflow)
  connections: WorkflowConnection[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

