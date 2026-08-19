import { IsString, IsNotEmpty, IsEnum, IsNumber, Min } from 'class-validator';
import { CouponType } from './create-coupon.dto';

export class GenerateCouponsDto {
  @IsNumber()
  @Min(1)
  count: number;

  @IsString()
  @IsNotEmpty()
  prefix: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsNumber()
  @Min(0)
  value: number;
}
