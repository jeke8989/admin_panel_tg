import { IsString, IsOptional } from 'class-validator';

export class UpdateBotSettingsDto {
  @IsString()
  @IsOptional()
  notificationGroupId?: string | null;
}
