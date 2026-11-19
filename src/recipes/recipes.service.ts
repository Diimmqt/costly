import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { MaterialUnit, ProductStatus } from '../../generated/prisma/enums.js';
import type { MaterialModel } from '../../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddRecipeItemDto } from './dto/add-recipe-item.dto.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeItemDto } from './dto/update-recipe-item.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import {
  type RecipeEntity,
  type RecipeItemEntity,
  type RecipeItemWithMaterial,
  type RecipeWithRelations,
  mapRecipeEntity,
  mapRecipeItemEntity,
} from './entities/recipe.entity.js';
import { convertUnitQuantity } from './unit-converter.js';

const RECIPE_INCLUDE = {
  product: true,
  items: {
    include: {
      material: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} as const;

interface PreparedRecipeItemData {
  materialId: string;
  quantity: Prisma.Decimal;
  unit: MaterialUnit;
  baseQuantity: Prisma.Decimal;
  baseUnit: MaterialUnit;
  notes: string | null;
}

@Injectable()
export class RecipesService {
  private readonly logger = new Logger(RecipesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(productId: string, dto: CreateRecipeDto): Promise<RecipeEntity> {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException(
        'Recipe must contain at least one material item',
      );
    }

    if (dto.yieldQuantity !== undefined && dto.yieldQuantity <= 0) {
      throw new BadRequestException('Yield quantity must be greater than 0');
    }

    this.assertNoDuplicateMaterialIds(dto.items);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
          include: { recipe: { select: { id: true } } },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID '${productId}' not found`);
        }

        if (product.status !== ProductStatus.ACTIVE || !product.isActive) {
          throw new BadRequestException(
            `Cannot create recipe for inactive product '${product.name}' (${product.code})`,
          );
        }

        if (product.recipe) {
          throw new ConflictException(
            `Product '${product.name}' (${product.code}) already has a recipe`,
          );
        }

        const preparedItems = await this.validateAndPrepareItems(tx, dto.items);

        const created = (await tx.recipe.create({
          data: {
            productId,
            name: dto.name?.trim() || `Recipe - ${product.name}`,
            notes: dto.notes?.trim() ?? null,
            yieldQuantity: new Prisma.Decimal(dto.yieldQuantity ?? 1),
            yieldUnit: dto.yieldUnit?.trim() || 'portion',
            isActive: true,
            items: {
              create: preparedItems,
            },
          },
          include: RECIPE_INCLUDE,
        })) as RecipeWithRelations;

        return mapRecipeEntity(created);
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async findByProduct(productId: string): Promise<RecipeEntity> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID '${productId}' not found`);
      }

      const recipe = (await this.prisma.recipe.findUnique({
        where: { productId },
        include: RECIPE_INCLUDE,
      })) as RecipeWithRelations | null;

      if (!recipe) {
        throw new NotFoundException(
          `Recipe for product '${product.name}' (${product.code}) not found`,
        );
      }

      return mapRecipeEntity(recipe);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async updateByProduct(
    productId: string,
    dto: UpdateRecipeDto,
  ): Promise<RecipeEntity> {
    if (dto.yieldQuantity !== undefined && dto.yieldQuantity <= 0) {
      throw new BadRequestException('Yield quantity must be greater than 0');
    }

    if (dto.items !== undefined) {
      if (!Array.isArray(dto.items) || dto.items.length === 0) {
        throw new BadRequestException(
          'Recipe must contain at least one material item',
        );
      }
      this.assertNoDuplicateMaterialIds(dto.items);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID '${productId}' not found`);
        }

        const existingRecipe = await tx.recipe.findUnique({
          where: { productId },
        });

        if (!existingRecipe) {
          throw new NotFoundException(
            `Recipe for product '${product.name}' (${product.code}) not found`,
          );
        }

        const updateData: Prisma.RecipeUpdateInput = {};

        if (dto.name !== undefined) {
          updateData.name = dto.name !== null ? dto.name.trim() : null;
        }
        if (dto.notes !== undefined) {
          updateData.notes = dto.notes !== null ? dto.notes.trim() : null;
        }
        if (dto.yieldQuantity !== undefined) {
          updateData.yieldQuantity = new Prisma.Decimal(dto.yieldQuantity);
        }
        if (dto.yieldUnit !== undefined) {
          updateData.yieldUnit = dto.yieldUnit.trim() || 'portion';
        }
        if (dto.isActive !== undefined) {
          updateData.isActive = dto.isActive;
        }

        if (dto.items !== undefined) {
          const preparedItems = await this.validateAndPrepareItems(
            tx,
            dto.items,
          );
          await tx.recipeItem.deleteMany({
            where: { recipeId: existingRecipe.id },
          });
          updateData.items = {
            create: preparedItems,
          };
        }

        const updated = (await tx.recipe.update({
          where: { id: existingRecipe.id },
          data: updateData,
          include: RECIPE_INCLUDE,
        })) as RecipeWithRelations;

        return mapRecipeEntity(updated);
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async removeByProduct(productId: string): Promise<RecipeEntity> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID '${productId}' not found`);
      }

      const existingRecipe = (await this.prisma.recipe.findUnique({
        where: { productId },
        include: RECIPE_INCLUDE,
      })) as RecipeWithRelations | null;

      if (!existingRecipe) {
        throw new NotFoundException(
          `Recipe for product '${product.name}' (${product.code}) not found`,
        );
      }

      if (this.hasRelatedData(existingRecipe)) {
        throw new ConflictException(
          `Cannot delete recipe for product '${product.name}' (${product.code}) because it has related HPP calculation history or production records. Please deactivate the recipe instead.`,
        );
      }

      await this.prisma.recipe.delete({
        where: { id: existingRecipe.id },
      });

      return mapRecipeEntity(existingRecipe);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async addItem(
    productId: string,
    dto: AddRecipeItemDto,
  ): Promise<RecipeItemEntity> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Usage quantity must be greater than 0');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID '${productId}' not found`);
        }

        const recipe = await tx.recipe.findUnique({
          where: { productId },
        });

        if (!recipe) {
          throw new NotFoundException(
            `Recipe for product '${product.name}' (${product.code}) not found`,
          );
        }

        const material = await tx.material.findUnique({
          where: { id: dto.materialId },
        });

        if (!material) {
          throw new NotFoundException(
            `Material with ID '${dto.materialId}' not found`,
          );
        }

        const duplicate = await tx.recipeItem.findUnique({
          where: {
            recipeId_materialId: {
              recipeId: recipe.id,
              materialId: dto.materialId,
            },
          },
        });

        if (duplicate) {
          throw new ConflictException(
            `Material '${material.name}' (${material.code}) already exists in this recipe`,
          );
        }

        const conversion = convertUnitQuantity(
          dto.quantity,
          dto.unit,
          material.unit,
        );

        const created = (await tx.recipeItem.create({
          data: {
            recipeId: recipe.id,
            materialId: dto.materialId,
            quantity: conversion.quantity,
            unit: dto.unit,
            baseQuantity: conversion.convertedQuantity,
            baseUnit: material.unit,
            notes: dto.notes?.trim() ?? null,
          },
          include: {
            material: true,
          },
        })) as RecipeItemWithMaterial;

        return mapRecipeItemEntity(created);
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async updateItem(
    productId: string,
    itemId: string,
    dto: UpdateRecipeItemDto,
  ): Promise<RecipeItemEntity> {
    if (
      dto.quantity === undefined &&
      dto.unit === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException(
        'At least one field (quantity, unit, or notes) must be provided',
      );
    }

    if (dto.quantity !== undefined && dto.quantity <= 0) {
      throw new BadRequestException('Usage quantity must be greater than 0');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID '${productId}' not found`);
        }

        const recipe = await tx.recipe.findUnique({
          where: { productId },
        });

        if (!recipe) {
          throw new NotFoundException(
            `Recipe for product '${product.name}' (${product.code}) not found`,
          );
        }

        const existingItem = (await tx.recipeItem.findUnique({
          where: { id: itemId },
          include: { material: true },
        })) as RecipeItemWithMaterial | null;

        if (!existingItem || existingItem.recipeId !== recipe.id) {
          throw new NotFoundException(
            `Recipe item with ID '${itemId}' not found in product recipe`,
          );
        }

        const nextQuantity =
          dto.quantity !== undefined
            ? new Prisma.Decimal(dto.quantity)
            : new Prisma.Decimal(existingItem.quantity);
        const nextUnit = dto.unit ?? existingItem.unit;

        const conversion = convertUnitQuantity(
          nextQuantity,
          nextUnit,
          existingItem.material.unit,
        );

        const updated = (await tx.recipeItem.update({
          where: { id: itemId },
          data: {
            quantity: conversion.quantity,
            unit: nextUnit,
            baseQuantity: conversion.convertedQuantity,
            baseUnit: existingItem.material.unit,
            ...(dto.notes !== undefined
              ? { notes: dto.notes !== null ? dto.notes.trim() : null }
              : {}),
          },
          include: { material: true },
        })) as RecipeItemWithMaterial;

        return mapRecipeItemEntity(updated);
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async removeItem(
    productId: string,
    itemId: string,
  ): Promise<RecipeItemEntity> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID '${productId}' not found`);
        }

        const recipe = await tx.recipe.findUnique({
          where: { productId },
        });

        if (!recipe) {
          throw new NotFoundException(
            `Recipe for product '${product.name}' (${product.code}) not found`,
          );
        }

        const existingItem = (await tx.recipeItem.findUnique({
          where: { id: itemId },
          include: { material: true },
        })) as RecipeItemWithMaterial | null;

        if (!existingItem || existingItem.recipeId !== recipe.id) {
          throw new NotFoundException(
            `Recipe item with ID '${itemId}' not found in product recipe`,
          );
        }

        const deleted = (await tx.recipeItem.delete({
          where: { id: itemId },
          include: { material: true },
        })) as RecipeItemWithMaterial;

        return mapRecipeItemEntity(deleted);
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  private assertNoDuplicateMaterialIds(items: AddRecipeItemDto[]): void {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.materialId)) {
        throw new ConflictException(
          `Duplicate material '${item.materialId}' is not allowed within the same recipe`,
        );
      }
      seen.add(item.materialId);
    }
  }

  private async validateAndPrepareItems(
    tx: Prisma.TransactionClient,
    items: AddRecipeItemDto[],
  ): Promise<PreparedRecipeItemData[]> {
    const materialIds = items.map((item) => item.materialId);
    const materials = await tx.material.findMany({
      where: { id: { in: materialIds } },
    });

    const materialMap = new Map<string, MaterialModel>();
    for (const mat of materials) {
      materialMap.set(mat.id, mat);
    }

    const missingIds = materialIds.filter((id) => !materialMap.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundException(
        `Material(s) not found: ${missingIds.join(', ')}`,
      );
    }

    return items.map((item) => {
      if (item.quantity <= 0) {
        throw new BadRequestException('Usage quantity must be greater than 0');
      }

      const material = materialMap.get(item.materialId)!;
      const conversion = convertUnitQuantity(
        item.quantity,
        item.unit,
        material.unit,
      );

      return {
        materialId: item.materialId,
        quantity: conversion.quantity,
        unit: item.unit,
        baseQuantity: conversion.convertedQuantity,
        baseUnit: material.unit,
        notes: item.notes?.trim() ?? null,
      };
    });
  }

  private hasRelatedData(recipe: unknown): boolean {
    if (!recipe || typeof recipe !== 'object') {
      return false;
    }

    const record = recipe as Record<string, unknown>;
    if (record._count && typeof record._count === 'object') {
      const counts = record._count as Record<string, unknown>;
      for (const [key, value] of Object.entries(counts)) {
        if (key !== 'items' && typeof value === 'number' && value > 0) {
          return true;
        }
      }
    }

    for (const key of ['hppCalculations', 'productions', 'transactions']) {
      if (Array.isArray(record[key]) && record[key].length > 0) {
        return true;
      }
    }

    return false;
  }

  private handleDatabaseError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
    ) {
      const prismaCode = (error as { code: string }).code;

      if (prismaCode === 'P2002') {
        return new ConflictException(
          'Duplicate recipe or duplicate material in the same recipe is not allowed',
        );
      }

      if (prismaCode === 'P2025') {
        return new NotFoundException('Requested recipe record was not found');
      }

      if (prismaCode === 'P2003' || prismaCode === 'P2014') {
        return new ConflictException(
          'Operation violates related data integrity constraint. If deleting a recipe with HPP or production history, deactivate it instead.',
        );
      }
    }

    this.logger.error(
      'Unexpected database error in RecipesService',
      error instanceof Error ? error.stack : String(error),
    );
    return new InternalServerErrorException(
      'An unexpected database error occurred while processing recipe data',
    );
  }
}
