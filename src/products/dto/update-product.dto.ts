import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ProductCategory,
  ProductStatus,
} from '../../../generated/prisma/enums.js';

export class UpdateProductDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Product code cannot be empty' })
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Product name cannot be empty' })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(ProductCategory, {
    message: `Category must be one of: ${Object.values(ProductCategory).join(', ')}`,
  })
  category?: ProductCategory;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @ValidateIf(
    (_obj: unknown, value: unknown) => value !== null && value !== undefined,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Selling price must not be negative' })
  sellingPrice?: number | null;

  @IsOptional()
  @IsEnum(ProductStatus, {
    message: `Status must be one of: ${Object.values(ProductStatus).join(', ')}`,
  })
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
