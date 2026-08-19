import { IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';

export class RefundOrderDto {
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  amount?: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
