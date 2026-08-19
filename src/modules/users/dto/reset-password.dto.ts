import { IsBoolean, IsOptional } from 'class-validator';

export class ResetPasswordDto {
  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;
}
