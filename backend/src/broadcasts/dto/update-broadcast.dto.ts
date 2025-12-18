import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BroadcastSegmentsDto, InlineButtonDto } from './create-broadcast.dto';

export class UpdateBroadcastDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  fileId?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @ValidateNested()
  @Type(() => BroadcastSegmentsDto)
  @IsOptional()
  segments?: BroadcastSegmentsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Array)
  @ValidateIf((o) => o.inlineButtons !== undefined)
  @IsOptional()
  inlineButtons?: InlineButtonDto[][];

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

