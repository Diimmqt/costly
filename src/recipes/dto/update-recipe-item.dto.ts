import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { MaterialUnit } from '../../../generated/prisma/enums.js';

export class UpdateRecipeItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({ message: 'Usage quantity must be greater than 0' })
  quantity?: number;

  @IsOptional()
  @IsEnum(MaterialUnit, {
    message: `Unit must be one of: ${Object.values(MaterialUnit).join(', ')}`,
  })
  unit?: MaterialUnit;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
