import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BroadcastSegmentsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  startParams?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  botIds?: string[];
}

export class CreateBroadcastDto {
  @IsString()
  name: string;

  @IsString()
  text: string;

  @ValidateNested()
  @Type(() => BroadcastSegmentsDto)
  @IsOptional()
  segments?: BroadcastSegmentsDto;

  @IsBoolean()
  @IsOptional()
  sendImmediately?: boolean;
}

