import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type {
  ApiResponse,
  HppCalculationEntity,
} from './entities/hpp.entity.js';
import { HppService } from './hpp.service.js';

@Controller('products/:productId/hpp')
export class ProductHppController {
  constructor(private readonly hppService: HppService) {}

  @Get('latest')
  async findLatest(
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<ApiResponse<HppCalculationEntity>> {
    const data = await this.hppService.findLatestByProduct(productId);
    return {
      success: true,
      message: 'Latest HPP calculation retrieved successfully',
      data,
    };
  }
}
