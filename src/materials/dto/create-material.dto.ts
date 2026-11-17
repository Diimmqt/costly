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

export class CreateMaterialDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Material code is required' })
  @MaxLength(50)
  code!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Material name is required' })
  @MaxLength(150)
  name!: string;

  @IsEnum(MaterialCategory, {
    message: `Category must be one of: ${Object.values(MaterialCategory).join(', ')}`,
  })
  category!: MaterialCategory;

  @IsEnum(MaterialUnit, {
    message: `Unit must be one of: ${Object.values(MaterialUnit).join(', ')}`,
  })
  unit!: MaterialUnit;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Purchase price must not be negative' })
  purchasePrice!: number;

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
  description?: string;
}
