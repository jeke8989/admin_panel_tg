import { Injectable } from '@nestjs/common';
import { NodeExecutor } from './node-executor.abstract';
import { WorkflowNode } from '../../entities/WorkflowNode.entity';

@Injectable()
export class ConditionExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: any): Promise<boolean> {
    const { config } = node;
    // Implement condition logic
    // e.g. check variable, check message content
    return true; // Default to true path
  }
}

