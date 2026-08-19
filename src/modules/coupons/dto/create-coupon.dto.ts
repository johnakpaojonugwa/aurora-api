import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDate,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minOrder?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  usageLimit?: number;

  @Type(() => Date)
  @IsDate()
  validFrom: Date;

  @Type(() => Date)
  @IsDate()
  validUntil: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
