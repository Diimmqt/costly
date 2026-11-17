import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { QueryMaterialsDto } from './dto/query-materials.dto.js';
import { QueryStockHistoryDto } from './dto/query-stock-history.dto.js';
import { StockInDto } from './dto/stock-in.dto.js';
import { StockOutDto } from './dto/stock-out.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import type {
  ApiResponse,
  MaterialEntity,
  StockMovementEntity,
} from './entities/material.entity.js';
import {
  MaterialsService,
  type StockOperationResult,
} from './materials.service.js';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  async findAll(
    @Query() query: QueryMaterialsDto,
  ): Promise<ApiResponse<MaterialEntity[]>> {
    const result = await this.materialsService.findAll(query);
    return {
      success: true,
      message: 'Materials retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<MaterialEntity>> {
    const data = await this.materialsService.findOne(id);
    return {
      success: true,
      message: 'Material retrieved successfully',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createMaterialDto: CreateMaterialDto,
  ): Promise<ApiResponse<MaterialEntity>> {
    const data = await this.materialsService.create(createMaterialDto);
    return {
      success: true,
      message: 'Material created successfully',
      data,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateMaterialDto: UpdateMaterialDto,
  ): Promise<ApiResponse<MaterialEntity>> {
    const data = await this.materialsService.update(id, updateMaterialDto);
    return {
      success: true,
      message: 'Material updated successfully',
      data,
    };
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<MaterialEntity>> {
    const data = await this.materialsService.remove(id);
    return {
      success: true,
      message: 'Material deleted successfully',
      data,
    };
  }

  @Post(':id/stock-in')
  @HttpCode(HttpStatus.OK)
  async stockIn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() stockInDto: StockInDto,
  ): Promise<ApiResponse<StockOperationResult>> {
    const data = await this.materialsService.stockIn(id, stockInDto);
    return {
      success: true,
      message: 'Stock added successfully',
      data,
    };
  }

  @Post(':id/stock-out')
  @HttpCode(HttpStatus.OK)
  async stockOut(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() stockOutDto: StockOutDto,
  ): Promise<ApiResponse<StockOperationResult>> {
    const data = await this.materialsService.stockOut(id, stockOutDto);
    return {
      success: true,
      message: 'Stock deducted successfully',
      data,
    };
  }

  @Get(':id/stock-history')
  async getStockHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QueryStockHistoryDto,
  ): Promise<
    ApiResponse<{
      material: MaterialEntity;
      movements: StockMovementEntity[];
    }>
  > {
    const result = await this.materialsService.getStockHistory(id, query);
    return {
      success: true,
      message: 'Stock history retrieved successfully',
      data: {
        material: result.material,
        movements: result.movements,
      },
      meta: result.meta,
    };
  }
}
