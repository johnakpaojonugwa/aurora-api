import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaxRateDto {
  @IsString()
  @IsNotEmpty()
  region: string;

  @IsNumber()
  rate: number;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateTaxDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxRateDto)
  rates: TaxRateDto[];
}
