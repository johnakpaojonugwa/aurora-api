import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminProductSeoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  slug: string;
}

export class AdminProductVariationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNotEmpty()
  attributes: Record<string, string>;

  @IsNumber()
  @Min(0)
  stock: number;
}

export class AdminCreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  comparePrice?: number;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsArray()
  @IsString({ each: true })
  images: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductVariationDto)
  variations: AdminProductVariationDto[];

  @IsBoolean()
  isActive: boolean;

  @ValidateNested()
  @Type(() => AdminProductSeoDto)
  seo: AdminProductSeoDto;
}
