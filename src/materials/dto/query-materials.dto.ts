import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  MaterialCategory,
  MaterialUnit,
  StockStatus,
} from '../../../generated/prisma/enums.js';

export const MATERIAL_SORT_FIELDS = [
  'name',
  'code',
  'category',
  'unit',
  'purchasePrice',
  'stock',
  'minStock',
  'stockStatus',
  'createdAt',
  'updatedAt',
] as const;

export type MaterialSortField = (typeof MATERIAL_SORT_FIELDS)[number];

export class QueryMaterialsDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(MaterialCategory)
  category?: MaterialCategory;

  @IsOptional()
  @IsEnum(MaterialUnit)
  unit?: MaterialUnit;

  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  lowStock?: boolean;

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
  @IsIn(MATERIAL_SORT_FIELDS)
  sortBy?: MaterialSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
