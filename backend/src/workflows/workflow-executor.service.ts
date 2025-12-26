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
    // Ищем сценарии, которые:
    // - привязаны к конкретному боту (botId === botId)
    // - или универсальные сценарии, где botIds содержит текущий botId
    const allWorkflows = await this.workflowsRepository.find({
      where: { isActive: true },
      relations: ['nodes', 'connections'],
    });

    // Фильтруем сценарии: 
    // 1. Если botIds заполнен - используем его (новый способ, приоритет)
    // 2. Иначе используем botId (старый способ)
    const workflows = allWorkflows.filter(workflow => {
      const botIdsArray = Array.isArray(workflow.botIds) ? workflow.botIds : [];
      
      // Если botIds заполнен - используем его (приоритет над botId)
      if (botIdsArray.length > 0) {
        const isIncluded = botIdsArray.includes(botId);
        this.logger.debug(`Workflow ${workflow.name} - checking botIds: ${JSON.stringify(workflow.botIds)}, botId: ${botId}, included: ${isIncluded}`);
        return isIncluded;
      }
      
      // Если botIds пустой - проверяем старый botId
      if (workflow.botId === botId) {
        this.logger.debug(`Workflow ${workflow.name} matched by legacy botId: ${workflow.botId}`);
        return true;
      }
      
      return false;
    });

    // Приоритизация сценариев: сначала те, где есть trigger-command с startParamPrefix (спец /start w_*), потом остальные
    const hasPrefixTrigger = (wf: BotWorkflow) =>
      wf.nodes?.some((n) => n.type === 'trigger-command' && n.config?.startParamPrefix) ? 1 : 0;
    workflows.sort((a, b) => hasPrefixTrigger(b) - hasPrefixTrigger(a));

    this.logger.log(`Executing workflows for bot ${botId}, triggerType: ${triggerType}, found ${workflows.length} active workflows out of ${allWorkflows.length} total`);
    
    if (workflows.length === 0) {
      this.logger.warn(`No workflows found for bot ${botId}. Total active workflows: ${allWorkflows.length}`);
      allWorkflows.forEach(w => {
        this.logger.warn(`Workflow: ${w.name}, botId: ${w.botId}, botIds: ${JSON.stringify(w.botIds)}, isActive: ${w.isActive}`);
      });
    } else {
      workflows.forEach(w => {
        this.logger.log(`Matched workflow: ${w.name}, botId: ${w.botId}, botIds: ${JSON.stringify(w.botIds)}`);
      });
    }

    let executed = false;
    for (const workflow of workflows) {
      // 2. Find trigger nodes
      const triggerNodes = workflow.nodes.filter(n => n.type.startsWith('trigger-'));
      // Приоритизируем команды с префиксом параметра (startParamPrefix), чтобы спец. /start w_* ловились до общего /start
      const sortedTriggerNodes = [...triggerNodes].sort((a, b) => {
        const aPref = a.config?.startParamPrefix ? 1 : 0;
        const bPref = b.config?.startParamPrefix ? 1 : 0;
        return bPref - aPref;
      });
      
      this.logger.debug(`Workflow ${workflow.name} has ${sortedTriggerNodes.length} trigger nodes`);
      
      for (const node of sortedTriggerNodes) {
        // 3. Check if trigger matches
        const isTriggered = await this.triggerExecutor.execute(node, { ...context, triggerType });
        
        this.logger.debug(`Trigger node ${node.type} (id: ${node.id}) check result: ${isTriggered}`);
        
        if (isTriggered) {
          this.logger.log(`Executing workflow ${workflow.name} triggered by ${node.type}`);
          await this.executeNodeChain(node, workflow, context);
          executed = true;
          break; // Stop after first matching trigger inside this workflow
        }
      }
      if (executed) break; // Stop after first matched workflow
    }
  }

  private async executeNodeChain(startNode: WorkflowNode, workflow: BotWorkflow, context: any) {
    this.logger.log(`Starting executeNodeChain from node ${startNode.type} (${startNode.id})`);
    this.logger.debug(`Workflow has ${workflow.nodes.length} nodes and ${workflow.connections.length} connections`);
    
    // Queue of { node, input }
    const queue = [{ node: startNode, input: null }];
    
    while (queue.length > 0) {
      const { node } = queue.shift()!;
      
      this.logger.debug(`Processing node: ${node.type} (${node.id})`);
      
      // Execute node logic (skip trigger as it's already checked, but for others)
      let result: any = true;
      if (!node.type.startsWith('trigger-')) {
        if (node.type.startsWith('action-')) {
            this.logger.log(`Executing action node: ${node.type}`);
            try {
              await this.actionExecutor.execute(node, context);
              this.logger.log(`Action ${node.type} executed successfully`);
            } catch (error) {
              this.logger.error(`Action ${node.type} failed: ${error.message}`, error.stack);
            }
        } else if (node.type.startsWith('condition-')) {
            result = await this.conditionExecutor.execute(node, context);
            this.logger.debug(`Condition ${node.type} result: ${result}`);
        }
      }
      
      // Find next nodes
      const outgoingConnections = workflow.connections.filter(c => c.sourceNodeId === node.id);
      this.logger.debug(`Found ${outgoingConnections.length} outgoing connections from node ${node.id}`);
      
      if (outgoingConnections.length === 0) {
        this.logger.debug(`No outgoing connections from node ${node.id}, checking all connections...`);
        workflow.connections.forEach(c => {
          this.logger.debug(`Connection: source=${c.sourceNodeId}, target=${c.targetNodeId}`);
        });
      }
      
      for (const conn of outgoingConnections) {
        // Handle condition handles (true/false)
        if (node.type.startsWith('condition-')) {
             if (conn.sourceHandle === 'true' && result === true) {
                 const nextNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
                 if (nextNode) {
                   this.logger.debug(`Following true branch to ${nextNode.type}`);
                   queue.push({ node: nextNode, input: result });
                 }
             } else if (conn.sourceHandle === 'false' && result === false) {
                 const nextNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
                 if (nextNode) {
                   this.logger.debug(`Following false branch to ${nextNode.type}`);
                   queue.push({ node: nextNode, input: result });
                 }
             }
        } else {
             const nextNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
             if (nextNode) {
               this.logger.debug(`Following connection to ${nextNode.type} (${nextNode.id})`);
               queue.push({ node: nextNode, input: result });
             }
        }
      }
    }
    
    this.logger.log(`Finished executeNodeChain`);
  }
}

