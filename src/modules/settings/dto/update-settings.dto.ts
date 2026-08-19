import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  storeName: string;

  @IsString()
  @IsOptional()
  storeLogo?: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsNotEmpty()
  defaultCurrency: string;
}
