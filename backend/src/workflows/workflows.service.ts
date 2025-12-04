import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotWorkflow } from '../entities/BotWorkflow.entity';
import { WorkflowNode } from '../entities/WorkflowNode.entity';
import { WorkflowConnection } from '../entities/WorkflowConnection.entity';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(BotWorkflow)
    private workflowsRepository: Repository<BotWorkflow>,
    @InjectRepository(WorkflowNode)
    private nodesRepository: Repository<WorkflowNode>,
    @InjectRepository(WorkflowConnection)
    private connectionsRepository: Repository<WorkflowConnection>,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
  ) {}

  async findAll(botId: string): Promise<BotWorkflow[]> {
    return this.workflowsRepository.find({
      where: { botId },
      relations: ['nodes', 'connections'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<BotWorkflow> {
    const workflow = await this.workflowsRepository.findOne({
      where: { id },
      relations: ['nodes', 'connections'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    return workflow;
  }

  async create(botId: string, createWorkflowDto: CreateWorkflowDto): Promise<BotWorkflow> {
    const { nodes, connections, ...workflowData } = createWorkflowDto;

    const workflow = this.workflowsRepository.create({
      ...workflowData,
      botId,
    });

    const savedWorkflow = await this.workflowsRepository.save(workflow);

    if (nodes && nodes.length > 0) {
      const nodeEntities = nodes.map((node) =>
        this.nodesRepository.create({
          ...node,
          id: undefined, // Let DB generate ID or use provided one if we want to sync IDs from frontend?
          // Actually, if frontend generates IDs (which ReactFlow does), we might want to use them or map them.
          // For simplicity, let's assume we store the config and structure.
          // But ReactFlow IDs are strings like '1', '2'. DB IDs are UUIDs.
          // We should probably rely on the frontend provided IDs for the session, but persist them as UUIDs?
          // Or we can just store them as is if we changed ID column to not be UUID?
          // Plan says ID is UUID.
          // Let's assume we generate new UUIDs for DB, but we need to map connections.
          // This is complicated.
          // Better approach: Since we are replacing the whole workflow on save usually (or create),
          // we can just wipe nodes and connections and recreate them.
          // But for CREATE, we definitely need to map connection source/target to the new node IDs.
          
          // Let's defer mapping logic. For now, let's just save.
          // If we want to support ReactFlow, we usually save the JSON structure or we need to be careful with IDs.
          // Let's assume the frontend sends us the structure and we save it.
          // If the frontend sends UUIDs, we can use them.
          // If the frontend sends temporary IDs, we need to map them.
          
          // Strategy: Save workflow first. Then save nodes. Then save connections.
          // We need to keep a map of frontend ID -> backend ID.
          
          // However, if we simply defined `id` in the DTO, we might try to use it.
          // But `PrimaryGeneratedColumn('uuid')` usually expects us to let DB generate it.
          // Unless we allow client-side UUID generation.
          
          // Let's assume for now we just create them and if the DTO has IDs they are ignored or used if they are valid UUIDs?
          // Let's stick to generating new IDs to be safe.
          
          workflow: savedWorkflow,
          type: node.type,
          position: node.position,
          config: node.config,
        }),
      );
      
      // Wait, connections reference node IDs. If we generate new node IDs, connections will break.
      // We must map them.
    }
    
    // Actually, to make it easier, let's just save the graph structure in a JSON column?
    // The plan explicitly says "Entity for scenarios and nodes" and separate tables.
    // So we must handle the relational mapping.
    
    // Let's implement a proper save with ID mapping.
    return this.saveWorkflowWithNodes(savedWorkflow, nodes, connections);
  }
  
  private async saveWorkflowWithNodes(
    workflow: BotWorkflow,
    nodesDto: any[],
    connectionsDto: any[],
  ): Promise<BotWorkflow> {
    const idMap = new Map<string, string>(); // oldId -> newId

    // 1. Save Nodes
    if (nodesDto) {
      for (const nodeDto of nodesDto) {
        const node = this.nodesRepository.create({
          workflow,
          type: nodeDto.type,
          position: nodeDto.position,
          config: nodeDto.config,
        });
        const savedNode = await this.nodesRepository.save(node);
        idMap.set(nodeDto.id, savedNode.id);
      }
    }

    // 2. Save Connections
    if (connectionsDto) {
      const connections = connectionsDto.map((conn) => {
        const sourceNodeId = idMap.get(conn.sourceNodeId);
        const targetNodeId = idMap.get(conn.targetNodeId);

        if (!sourceNodeId || !targetNodeId) {
            // If we can't find the node, maybe it was deleted or invalid?
            // Or maybe the frontend sent mismatched data.
            // For now, skip invalid connections.
            return null;
        }

        return this.connectionsRepository.create({
          workflow,
          sourceNodeId,
          targetNodeId,
          sourceHandle: conn.sourceHandle,
          targetHandle: conn.targetHandle,
        });
      }).filter(c => c !== null);

      if (connections.length > 0) {
        await this.connectionsRepository.save(connections);
      }
    }

    return this.findOne(workflow.id);
  }

  async update(id: string, updateWorkflowDto: UpdateWorkflowDto): Promise<BotWorkflow> {
    const workflow = await this.findOne(id);
    
    const { nodes, connections, ...workflowData } = updateWorkflowDto;

    // Update workflow properties
    Object.assign(workflow, workflowData);
    await this.workflowsRepository.save(workflow);

    // If nodes are provided, we replace the entire graph (simplest approach for now)
    if (nodes) {
      // Delete existing connections and nodes
      await this.connectionsRepository.delete({ workflowId: id });
      await this.nodesRepository.delete({ workflowId: id });

      // Re-create nodes and connections
      // Note: we can't use the private method easily because it assumes a new workflow object passed in some ways
      // but actually it just takes the entity.
      return this.saveWorkflowWithNodes(workflow, nodes, connections || []);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.workflowsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }
  }

  async toggleActive(id: string, isActive: boolean): Promise<BotWorkflow> {
    const workflow = await this.findOne(id);
    workflow.isActive = isActive;
    return this.workflowsRepository.save(workflow);
  }

  async uploadFileToTelegram(
    botId: string,
    file: Express.Multer.File,
  ): Promise<{ fileId: string; fileType: string; fileUrl?: string | null }> {
    if (!file) {
      throw new NotFoundException('Файл не предоставлен');
    }

    try {
      return await this.telegramService.uploadFileToTelegram(botId, file);
    } catch (error) {
      console.error('[WorkflowsService] Error uploading file to Telegram:', error);
      if (error instanceof Error) {
        // Преобразуем обычные ошибки в HTTP исключения
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('не найден')) {
          throw new NotFoundException(error.message);
        }
        if (errorMessage.includes('чат') || errorMessage.includes('chat')) {
             throw new BadRequestException(error.message);
        }
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async getFileUrl(botId: string, fileId: string): Promise<{ fileUrl: string | null }> {
    const fileUrl = await this.telegramService.getFileUrl(botId, fileId);
    return { fileUrl };
  }
}

