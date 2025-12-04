import { IsString, IsObject, IsNumber } from 'class-validator';

export class WorkflowNodeDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsObject()
  position: { x: number; y: number };

  @IsObject()
  config: any;
}

