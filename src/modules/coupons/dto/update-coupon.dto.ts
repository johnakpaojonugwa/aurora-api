import { IsOptional, IsString, IsEnum, IsNumber, IsDate, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CouponType } from './create-coupon.dto';

export class UpdateCouponDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsEnum(CouponType)
  @IsOptional()
  type?: CouponType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrder?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  validFrom?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  validUntil?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
