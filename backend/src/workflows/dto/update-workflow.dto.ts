import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkflowDto, CreateWorkflowConnectionDto } from './create-workflow.dto';
import { WorkflowNodeDto } from './workflow-node.dto';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes?: WorkflowNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowConnectionDto)
  connections?: CreateWorkflowConnectionDto[];
}
