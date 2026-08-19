import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum UserStatusEnum {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class UpdateUserStatusByEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(UserStatusEnum)
  @IsNotEmpty()
  status: UserStatusEnum;
}
