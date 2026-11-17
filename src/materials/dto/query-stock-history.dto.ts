import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { StockMovementType } from '../../../generated/prisma/enums.js';

export class QueryStockHistoryDto {
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
