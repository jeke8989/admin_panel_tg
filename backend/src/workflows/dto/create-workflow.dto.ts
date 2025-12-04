import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowNodeDto } from './workflow-node.dto';

export class CreateWorkflowConnectionDto {
  @IsString()
  sourceNodeId: string;

  @IsString()
  targetNodeId: string;

  @IsString()
  @IsOptional()
  sourceHandle?: string;

  @IsString()
  @IsOptional()
  targetHandle?: string;
}

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes: WorkflowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowConnectionDto)
  connections: CreateWorkflowConnectionDto[];
}

