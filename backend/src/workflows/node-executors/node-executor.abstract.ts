import { Injectable } from '@nestjs/common';
import { WorkflowNode } from '../../entities/WorkflowNode.entity';

@Injectable()
export abstract class NodeExecutor {
  abstract execute(node: WorkflowNode, context: any): Promise<any>;
}




