import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BotWorkflow } from './BotWorkflow.entity';

@Entity('workflow_nodes')
export class WorkflowNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => BotWorkflow, (workflow) => workflow.nodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: BotWorkflow;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'jsonb' })
  position: { x: number; y: number };

  @Column({ type: 'jsonb', default: {} })
  config: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

