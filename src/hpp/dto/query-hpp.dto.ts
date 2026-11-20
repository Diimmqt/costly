import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const HPP_SORT_FIELDS = [
  'calculatedAt',
  'createdAt',
  'totalMaterialCost',
  'totalAdditionalCost',
  'totalHpp',
  'hppPerUnit',
  'productionQuantity',
  'productName',
] as const;

export type HppSortField = (typeof HPP_SORT_FIELDS)[number];

export class QueryHppDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  search?: string;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

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

  @IsOptional()
  @IsIn(HPP_SORT_FIELDS)
  sortBy?: HppSortField = 'calculatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
