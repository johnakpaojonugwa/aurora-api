import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyMfaDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  token: string;
}
