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

export class CreateProductDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Product code is required' })
  @MaxLength(50)
  code!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  @MaxLength(150)
  name!: string;

  @IsEnum(ProductCategory, {
    message: `Category must be one of: ${Object.values(ProductCategory).join(', ')}`,
  })
  category!: ProductCategory;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  description?: string;

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
