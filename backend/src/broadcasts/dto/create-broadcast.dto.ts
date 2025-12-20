import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TagType } from '../../entities/Tag.entity';

export class BroadcastSegmentsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  startParams?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  botIds?: string[];

  @IsArray()
  @IsOptional()
  tagTypes?: (TagType | null)[];
}

export class InlineButtonDto {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  callback_data?: string;
}

export class CreateBroadcastDto {
  @IsString()
  name: string;

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

  @IsBoolean()
  @IsOptional()
  sendImmediately?: boolean;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

