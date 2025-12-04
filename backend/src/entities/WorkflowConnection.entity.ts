import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BotWorkflow } from './BotWorkflow.entity';

@Entity('workflow_connections')
export class WorkflowConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => BotWorkflow, (workflow) => workflow.connections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: BotWorkflow;

  @Column({ name: 'source_node_id' })
  sourceNodeId: string;

  @Column({ name: 'target_node_id' })
  targetNodeId: string;

  @Column({ name: 'source_handle', nullable: true })
  sourceHandle: string | null;

  @Column({ name: 'target_handle', nullable: true })
  targetHandle: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

