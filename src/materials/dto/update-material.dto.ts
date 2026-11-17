import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MaterialCategory,
  MaterialUnit,
} from '../../../generated/prisma/enums.js';

export class UpdateMaterialDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Material code cannot be empty' })
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Material name cannot be empty' })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(MaterialCategory, {
    message: `Category must be one of: ${Object.values(MaterialCategory).join(', ')}`,
  })
  category?: MaterialCategory;

  @IsOptional()
  @IsEnum(MaterialUnit, {
    message: `Unit must be one of: ${Object.values(MaterialUnit).join(', ')}`,
  })
  unit?: MaterialUnit;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Purchase price must not be negative' })
  purchasePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0, { message: 'Stock must not be negative' })
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0, { message: 'Minimum stock must not be negative' })
  minStock?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}
