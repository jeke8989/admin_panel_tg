import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotWorkflow } from '../entities/BotWorkflow.entity';
import { WorkflowNode } from '../entities/WorkflowNode.entity';
import { WorkflowConnection } from '../entities/WorkflowConnection.entity';
import { TriggerExecutor } from './node-executors/trigger-executor';
import { ActionExecutor } from './node-executors/action-executor';
import { ConditionExecutor } from './node-executors/condition-executor';

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);

  constructor(
    @InjectRepository(BotWorkflow)
    private workflowsRepository: Repository<BotWorkflow>,
    private triggerExecutor: TriggerExecutor,
    private actionExecutor: ActionExecutor,
    private conditionExecutor: ConditionExecutor,
  ) {}

  async executeWorkflow(botId: string, triggerType: string, context: any) {
    // 1. Find active workflows for this bot
    const workflows = await this.workflowsRepository.find({
      where: { botId, isActive: true },
      relations: ['nodes', 'connections'],
    });

    this.logger.log(`Executing workflows for bot ${botId}, triggerType: ${triggerType}, found ${workflows.length} active workflows`);

    for (const workflow of workflows) {
      // 2. Find trigger nodes
      const triggerNodes = workflow.nodes.filter(n => n.type.startsWith('trigger-'));
      
      this.logger.debug(`Workflow ${workflow.name} has ${triggerNodes.length} trigger nodes`);
      
      for (const node of triggerNodes) {
        // 3. Check if trigger matches
        const isTriggered = await this.triggerExecutor.execute(node, { ...context, triggerType });
        
        this.logger.debug(`Trigger node ${node.type} (id: ${node.id}) check result: ${isTriggered}`);
        
        if (isTriggered) {
          this.logger.log(`Executing workflow ${workflow.name} triggered by ${node.type}`);
          await this.executeNodeChain(node, workflow, context);
          break; // Stop after first matching trigger to avoid duplicate executions
        }
      }
    }
  }

  private async executeNodeChain(startNode: WorkflowNode, workflow: BotWorkflow, context: any) {
    let currentNode = startNode;
    
    // Simple BFS or just following the single path for now (assuming linear or branching without merging complex logic yet)
    // We need a queue for BFS if we support parallel execution, but sequential is easier to debug.
    
    // Queue of { node, input }
    const queue = [{ node: startNode, input: null }];
    
    while (queue.length > 0) {
      const { node } = queue.shift()!;
      
      // Execute node logic (skip trigger as it's already checked, but for others)
      let result: any = true;
      if (!node.type.startsWith('trigger-')) {
        if (node.type.startsWith('action-')) {
            await this.actionExecutor.execute(node, context);
        } else if (node.type.startsWith('condition-')) {
            result = await this.conditionExecutor.execute(node, context);
        }
      }
      
      // Find next nodes
      const outgoingConnections = workflow.connections.filter(c => c.sourceNodeId === node.id);
      
      for (const conn of outgoingConnections) {
        // Handle condition handles (true/false)
        if (node.type.startsWith('condition-')) {
             if (conn.sourceHandle === 'true' && result === true) {
                 const nextNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
                 if (nextNode) queue.push({ node: nextNode, input: result });
             } else if (conn.sourceHandle === 'false' && result === false) {
                 const nextNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
                 if (nextNode) queue.push({ node: nextNode, input: result });
             }
        } else {
             const nextNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
             if (nextNode) queue.push({ node: nextNode, input: result });
        }
      }
    }
  }
}

