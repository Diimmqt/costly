import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MaterialUnit } from '../../../generated/prisma/enums.js';

export class AddRecipeItemDto {
  @IsUUID('4', { message: 'Material ID must be a valid UUID' })
  materialId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({ message: 'Usage quantity must be greater than 0' })
  quantity!: number;

  @IsEnum(MaterialUnit, {
    message: `Unit must be one of: ${Object.values(MaterialUnit).join(', ')}`,
  })
  unit!: MaterialUnit;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  notes?: string;
}
