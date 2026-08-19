import { IsString, IsOptional } from 'class-validator';

export class SuspendUserDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
