import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CalculateHppDto } from './dto/calculate-hpp.dto.js';
import { QueryHppDto } from './dto/query-hpp.dto.js';
import type {
  ApiResponse,
  HppCalculationEntity,
  HppPreviewEntity,
} from './entities/hpp.entity.js';
import { HppService } from './hpp.service.js';

@Controller('hpp')
export class HppController {
  constructor(private readonly hppService: HppService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculate(
    @Body() dto: CalculateHppDto,
  ): Promise<ApiResponse<HppPreviewEntity>> {
    const data = await this.hppService.calculate(dto);
    return {
      success: true,
      message: 'HPP calculated successfully (preview)',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CalculateHppDto,
  ): Promise<ApiResponse<HppCalculationEntity>> {
    const data = await this.hppService.create(dto);
    return {
      success: true,
      message: 'HPP calculation saved successfully',
      data,
    };
  }

  @Get()
  async findAll(
    @Query() query: QueryHppDto,
  ): Promise<ApiResponse<HppCalculationEntity[]>> {
    const result = await this.hppService.findAll(query);
    return {
      success: true,
      message: 'HPP calculation history retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<HppCalculationEntity>> {
    const data = await this.hppService.findOne(id);
    return {
      success: true,
      message: 'HPP calculation retrieved successfully',
      data,
    };
  }
}
