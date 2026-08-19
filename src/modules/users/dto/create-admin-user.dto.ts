import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsEnum,
  MinLength,
} from 'class-validator';

export enum AdminManagerRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
}

export class CreateAdminUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AdminManagerRole)
  role: AdminManagerRole;
}
