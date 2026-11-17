import { IsBoolean, IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { ProductStatus } from '../../../generated/prisma/enums.js';

export class UpdateProductStatusDto {
  @ValidateIf(
    (obj: UpdateProductStatusDto) =>
      obj.isActive === undefined || obj.status !== undefined,
  )
  @IsEnum(ProductStatus, {
    message: `Status must be one of: ${Object.values(ProductStatus).join(', ')}`,
  })
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
