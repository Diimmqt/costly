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
} from '@nestjs/common';
import { AddRecipeItemDto } from './dto/add-recipe-item.dto.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeItemDto } from './dto/update-recipe-item.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import type {
  ApiResponse,
  RecipeEntity,
  RecipeItemEntity,
} from './entities/recipe.entity.js';
import { RecipesService } from './recipes.service.js';

@Controller('products/:productId/recipe')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  async findByProduct(
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<ApiResponse<RecipeEntity>> {
    const data = await this.recipesService.findByProduct(productId);
    return {
      success: true,
      message: 'Recipe retrieved successfully',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() createRecipeDto: CreateRecipeDto,
  ): Promise<ApiResponse<RecipeEntity>> {
    const data = await this.recipesService.create(productId, createRecipeDto);
    return {
      success: true,
      message: 'Recipe created successfully',
      data,
    };
  }

  @Patch()
  async update(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
  ): Promise<ApiResponse<RecipeEntity>> {
    const data = await this.recipesService.updateByProduct(
      productId,
      updateRecipeDto,
    );
    return {
      success: true,
      message: 'Recipe updated successfully',
      data,
    };
  }

  @Delete()
  async remove(
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<ApiResponse<RecipeEntity>> {
    const data = await this.recipesService.removeByProduct(productId);
    return {
      success: true,
      message: 'Recipe deleted successfully',
      data,
    };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  async addItem(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() addRecipeItemDto: AddRecipeItemDto,
  ): Promise<ApiResponse<RecipeItemEntity>> {
    const data = await this.recipesService.addItem(productId, addRecipeItemDto);
    return {
      success: true,
      message: 'Recipe item added successfully',
      data,
    };
  }

  @Patch('items/:itemId')
  async updateItem(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() updateRecipeItemDto: UpdateRecipeItemDto,
  ): Promise<ApiResponse<RecipeItemEntity>> {
    const data = await this.recipesService.updateItem(
      productId,
      itemId,
      updateRecipeItemDto,
    );
    return {
      success: true,
      message: 'Recipe item updated successfully',
      data,
    };
  }

  @Delete('items/:itemId')
  async removeItem(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<ApiResponse<RecipeItemEntity>> {
    const data = await this.recipesService.removeItem(productId, itemId);
    return {
      success: true,
      message: 'Recipe item removed successfully',
      data,
    };
  }
}
