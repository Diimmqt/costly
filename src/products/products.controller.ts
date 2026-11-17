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
import { CreateProductDto } from './dto/create-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import type {
  ApiResponse,
  ProductEntity,
} from './entities/product.entity.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query() query: QueryProductsDto,
  ): Promise<ApiResponse<ProductEntity[]>> {
    const result = await this.productsService.findAll(query);
    return {
      success: true,
      message: 'Products retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<ProductEntity>> {
    const data = await this.productsService.findOne(id);
    return {
      success: true,
      message: 'Product retrieved successfully',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<ApiResponse<ProductEntity>> {
    const data = await this.productsService.create(createProductDto);
    return {
      success: true,
      message: 'Product created successfully',
      data,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ApiResponse<ProductEntity>> {
    const data = await this.productsService.update(id, updateProductDto);
    return {
      success: true,
      message: 'Product updated successfully',
      data,
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
  ): Promise<ApiResponse<ProductEntity>> {
    const data = await this.productsService.updateStatus(
      id,
      updateProductStatusDto,
    );
    return {
      success: true,
      message: 'Product status updated successfully',
      data,
    };
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponse<ProductEntity>> {
    const data = await this.productsService.remove(id);
    return {
      success: true,
      message: 'Product deleted successfully',
      data,
    };
  }
}
