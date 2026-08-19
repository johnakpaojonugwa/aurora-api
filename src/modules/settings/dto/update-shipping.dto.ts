import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ShippingRuleDto {
  @IsString()
  @IsNotEmpty()
  region: string;

  @IsNumber()
  rate: number;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateShippingDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  freeShippingThreshold?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingRuleDto)
  rules: ShippingRuleDto[];
}
