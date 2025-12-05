import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsUniversalController } from './workflows-universal.controller';
import { BotWorkflow } from '../entities/BotWorkflow.entity';
import { WorkflowNode } from '../entities/WorkflowNode.entity';
import { WorkflowConnection } from '../entities/WorkflowConnection.entity';
import { Message } from '../entities/Message.entity';
import { Chat } from '../entities/Chat.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { WorkflowExecutorService } from './workflow-executor.service';
import { TriggerExecutor } from './node-executors/trigger-executor';
import { ActionExecutor } from './node-executors/action-executor';
import { ConditionExecutor } from './node-executors/condition-executor';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotWorkflow, WorkflowNode, WorkflowConnection, Message, Chat]),
    forwardRef(() => TelegramModule),
  ],
  controllers: [WorkflowsController, WorkflowsUniversalController],
  providers: [
    WorkflowsService,
    WorkflowExecutorService,
    TriggerExecutor,
    ActionExecutor,
    ConditionExecutor,
  ],
  exports: [WorkflowsService, WorkflowExecutorService],
})
export class WorkflowsModule {}

