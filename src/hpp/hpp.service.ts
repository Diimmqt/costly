import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AdditionalCostCategory,
  MaterialCategory,
  MaterialUnit,
  ProductCategory,
  ProductStatus,
} from '../../generated/prisma/enums.js';
import type {
  MaterialModel,
  ProductModel,
  RecipeItemModel,
  RecipeModel,
} from '../../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { convertUnitQuantity } from '../recipes/unit-converter.js';
import {
  AdditionalCostItemDto,
  CalculateHppDto,
} from './dto/calculate-hpp.dto.js';
import { QueryHppDto } from './dto/query-hpp.dto.js';
import {
  HPP_ROUNDING_RULE,
  type HppCalculationEntity,
  type HppCalculationWithRelations,
  type HppPreviewEntity,
  type PaginationMeta,
  mapHppCalculationEntity,
} from './entities/hpp.entity.js';

const HPP_INCLUDE = {
  materialSnapshots: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  additionalCosts: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} as const;

type ProductWithRecipeAndMaterials = ProductModel & {
  recipe:
    | (RecipeModel & {
        items: Array<RecipeItemModel & { material: MaterialModel | null }>;
      })
    | null;
};

interface PreparedMaterialSnapshotData {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialCategory: MaterialCategory;
  usageQuantity: Prisma.Decimal;
  usageUnit: MaterialUnit;
  baseQuantity: Prisma.Decimal;
  baseUnit: MaterialUnit;
  unitPrice: Prisma.Decimal;
  subtotalCost: Prisma.Decimal;
  notes: string | null;
}

interface PreparedAdditionalCostData {
  category: AdditionalCostCategory;
  name: string;
  amount: Prisma.Decimal;
  notes: string | null;
}

interface ComputedHppData {
  productId: string;
  recipeId: string;
  productCode: string;
  productName: string;
  productCategory: ProductCategory;
  productSellingPrice: Prisma.Decimal | null;
  recipeName: string | null;
  recipeYieldQuantity: Prisma.Decimal;
  recipeYieldUnit: string;
  productionQuantity: Prisma.Decimal;
  totalMaterialCost: Prisma.Decimal;
  totalAdditionalCost: Prisma.Decimal;
  totalHpp: Prisma.Decimal;
  hppPerUnit: Prisma.Decimal;
  roundingRule: string;
  notes: string | null;
  calculatedAt: Date;
  materialSnapshots: PreparedMaterialSnapshotData[];
  additionalCosts: PreparedAdditionalCostData[];
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class HppService {
  private readonly logger = new Logger(HppService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates HPP without persisting to database (preview mode).
   */
  async calculate(dto: CalculateHppDto): Promise<HppPreviewEntity> {
    this.validateInput(dto);

    try {
      const computed = await this.computeForProduct(this.prisma, dto);
      return this.toPreviewEntity(computed);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  /**
   * Calculates HPP and atomically persists calculation summary, material snapshots,
   * and additional costs inside a database transaction.
   */
  async create(dto: CalculateHppDto): Promise<HppCalculationEntity> {
    this.validateInput(dto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const computed = await this.computeForProduct(tx, dto);

        const created = (await tx.hppCalculation.create({
          data: {
            productId: computed.productId,
            recipeId: computed.recipeId,
            productCode: computed.productCode,
            productName: computed.productName,
            productCategory: computed.productCategory,
            productSellingPrice: computed.productSellingPrice,
            recipeName: computed.recipeName,
            recipeYieldQuantity: computed.recipeYieldQuantity,
            recipeYieldUnit: computed.recipeYieldUnit,
            productionQuantity: computed.productionQuantity,
            totalMaterialCost: computed.totalMaterialCost,
            totalAdditionalCost: computed.totalAdditionalCost,
            totalHpp: computed.totalHpp,
            hppPerUnit: computed.hppPerUnit,
            roundingRule: computed.roundingRule,
            notes: computed.notes,
            calculatedAt: computed.calculatedAt,
            materialSnapshots: {
              create: computed.materialSnapshots,
            },
            additionalCosts: {
              create: computed.additionalCosts,
            },
          },
          include: HPP_INCLUDE,
        })) as HppCalculationWithRelations;

        return mapHppCalculationEntity(created);
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  /**
   * Lists saved HPP calculation history with product filter, search,
   * date range filter, pagination, and sorting.
   */
  async findAll(
    query: QueryHppDto = {},
  ): Promise<{ data: HppCalculationEntity[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'calculatedAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.HppCalculationWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { productCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const dateFilter = this.parseDateRange(query.dateFrom, query.dateTo);
    if (dateFilter) {
      where.calculatedAt = dateFilter;
    }

    try {
      const [records, total] = await Promise.all([
        this.prisma.hppCalculation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: HPP_INCLUDE,
        }),
        this.prisma.hppCalculation.count({ where }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        data: (records as HppCalculationWithRelations[]).map(
          mapHppCalculationEntity,
        ),
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  /**
   * Retrieves a single HPP calculation history detail by ID.
   */
  async findOne(id: string): Promise<HppCalculationEntity> {
    try {
      const calculation = (await this.prisma.hppCalculation.findUnique({
        where: { id },
        include: HPP_INCLUDE,
      })) as HppCalculationWithRelations | null;

      if (!calculation) {
        throw new NotFoundException(
          `HPP calculation with ID '${id}' not found`,
        );
      }

      return mapHppCalculationEntity(calculation);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  /**
   * Retrieves the latest saved HPP calculation for a specific product.
   */
  async findLatestByProduct(productId: string): Promise<HppCalculationEntity> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID '${productId}' not found`);
      }

      const latest = (await this.prisma.hppCalculation.findFirst({
        where: { productId },
        orderBy: [{ calculatedAt: 'desc' }, { createdAt: 'desc' }],
        include: HPP_INCLUDE,
      })) as HppCalculationWithRelations | null;

      if (!latest) {
        throw new NotFoundException(
          `No HPP calculation history found for product '${product.name}' (${product.code})`,
        );
      }

      return mapHppCalculationEntity(latest);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  private validateInput(dto: CalculateHppDto): void {
    if (!dto.productId || dto.productId.trim().length === 0) {
      throw new BadRequestException('Product ID is required');
    }

    if (dto.productionQuantity !== undefined) {
      if (
        !Number.isFinite(dto.productionQuantity) ||
        dto.productionQuantity <= 0
      ) {
        throw new BadRequestException(
          'Production quantity must be greater than 0',
        );
      }
    }

    if (dto.additionalCosts !== undefined) {
      if (!Array.isArray(dto.additionalCosts)) {
        throw new BadRequestException('Additional costs must be an array');
      }

      for (const cost of dto.additionalCosts) {
        this.validateAdditionalCostItem(cost);
      }
    }
  }

  private validateAdditionalCostItem(cost: AdditionalCostItemDto): void {
    if (!cost.name || cost.name.trim().length === 0) {
      throw new BadRequestException('Additional cost name is required');
    }

    if (!Number.isFinite(cost.amount) || cost.amount < 0) {
      throw new BadRequestException(
        `Additional cost '${cost.name.trim()}' amount must not be negative`,
      );
    }

    if (
      cost.category !== undefined &&
      !Object.values(AdditionalCostCategory).includes(cost.category)
    ) {
      throw new BadRequestException(
        `Additional cost category must be one of: ${Object.values(AdditionalCostCategory).join(', ')}`,
      );
    }
  }

  private async computeForProduct(
    db: PrismaService | Prisma.TransactionClient,
    dto: CalculateHppDto,
  ): Promise<ComputedHppData> {
    const product = (await db.product.findUnique({
      where: { id: dto.productId },
      include: {
        recipe: {
          include: {
            items: {
              include: {
                material: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
    })) as ProductWithRecipeAndMaterials | null;

    if (!product) {
      throw new NotFoundException(
        `Product with ID '${dto.productId}' not found`,
      );
    }

    if (product.status !== ProductStatus.ACTIVE || !product.isActive) {
      throw new BadRequestException(
        `Cannot calculate HPP for inactive product '${product.name}' (${product.code})`,
      );
    }

    const recipe = product.recipe;
    if (!recipe) {
      throw new BadRequestException(
        `Product '${product.name}' (${product.code}) does not have a recipe`,
      );
    }

    if (!recipe.isActive) {
      throw new BadRequestException(
        `Recipe for product '${product.name}' (${product.code}) is inactive`,
      );
    }

    if (!recipe.items || recipe.items.length === 0) {
      throw new BadRequestException(
        `Recipe for product '${product.name}' (${product.code}) must contain at least one material item`,
      );
    }

    const productionQuantityDec =
      dto.productionQuantity !== undefined
        ? new Prisma.Decimal(dto.productionQuantity)
        : new Prisma.Decimal(recipe.yieldQuantity);

    if (
      !productionQuantityDec.isFinite() ||
      productionQuantityDec.lessThanOrEqualTo(0)
    ) {
      throw new BadRequestException(
        'Production quantity must be greater than 0',
      );
    }

    let totalMaterialCost = new Prisma.Decimal(0);
    const materialSnapshots: PreparedMaterialSnapshotData[] = [];

    for (const item of recipe.items) {
      const material = item.material;
      if (!material) {
        throw new BadRequestException(
          `Recipe item '${item.id}' references a missing material`,
        );
      }

      const usageQtyDec = new Prisma.Decimal(item.quantity);
      if (!usageQtyDec.isFinite() || usageQtyDec.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          `Recipe item for material '${material.name}' (${material.code}) has an invalid usage quantity`,
        );
      }

      const unitPriceDec = new Prisma.Decimal(material.purchasePrice);
      if (!unitPriceDec.isFinite() || unitPriceDec.lessThan(0)) {
        throw new BadRequestException(
          `Material '${material.name}' (${material.code}) has an invalid purchase price`,
        );
      }

      // Always re-convert dynamically against material's live unit so stale baseUnit/baseQuantity
      // or cross-dimension unit mismatches are caught reliably.
      const conversion = convertUnitQuantity(
        usageQtyDec,
        item.unit,
        material.unit,
      );

      const subtotalCost = conversion.convertedQuantity
        .mul(unitPriceDec)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      totalMaterialCost = totalMaterialCost.plus(subtotalCost);

      materialSnapshots.push({
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        materialCategory: material.category,
        usageQuantity: usageQtyDec,
        usageUnit: item.unit,
        baseQuantity: conversion.convertedQuantity,
        baseUnit: material.unit,
        unitPrice: unitPriceDec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        subtotalCost,
        notes: item.notes ?? null,
      });
    }

    totalMaterialCost = totalMaterialCost.toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );

    let totalAdditionalCost = new Prisma.Decimal(0);
    const additionalCosts: PreparedAdditionalCostData[] = [];

    for (const cost of dto.additionalCosts ?? []) {
      const amountDec = new Prisma.Decimal(cost.amount).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );
      totalAdditionalCost = totalAdditionalCost.plus(amountDec);

      additionalCosts.push({
        category: cost.category ?? AdditionalCostCategory.OTHER,
        name: cost.name.trim(),
        amount: amountDec,
        notes: cost.notes?.trim() ?? null,
      });
    }

    totalAdditionalCost = totalAdditionalCost.toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );

    const totalHpp = totalMaterialCost
      .plus(totalAdditionalCost)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // Rounding rule: ROUND_HALF_UP to 2 decimal places (commercial standard for currency).
    const hppPerUnit = totalHpp
      .div(productionQuantityDec)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    return {
      productId: product.id,
      recipeId: recipe.id,
      productCode: product.code,
      productName: product.name,
      productCategory: product.category,
      productSellingPrice:
        product.sellingPrice !== null
          ? new Prisma.Decimal(product.sellingPrice)
          : null,
      recipeName: recipe.name,
      recipeYieldQuantity: new Prisma.Decimal(recipe.yieldQuantity),
      recipeYieldUnit: recipe.yieldUnit,
      productionQuantity: productionQuantityDec,
      totalMaterialCost,
      totalAdditionalCost,
      totalHpp,
      hppPerUnit,
      roundingRule: HPP_ROUNDING_RULE,
      notes: dto.notes?.trim() ?? null,
      calculatedAt: new Date(),
      materialSnapshots,
      additionalCosts,
    };
  }

  private toPreviewEntity(computed: ComputedHppData): HppPreviewEntity {
    return {
      isSaved: false,
      productId: computed.productId,
      recipeId: computed.recipeId,
      productCode: computed.productCode,
      productName: computed.productName,
      productCategory: computed.productCategory,
      productSellingPrice:
        computed.productSellingPrice !== null
          ? Number(computed.productSellingPrice)
          : null,
      recipeName: computed.recipeName,
      recipeYieldQuantity: Number(computed.recipeYieldQuantity),
      recipeYieldUnit: computed.recipeYieldUnit,
      productionQuantity: Number(computed.productionQuantity),
      totalMaterialCost: Number(computed.totalMaterialCost),
      totalAdditionalCost: Number(computed.totalAdditionalCost),
      totalHpp: Number(computed.totalHpp),
      hppPerUnit: Number(computed.hppPerUnit),
      roundingRule: computed.roundingRule,
      notes: computed.notes,
      calculatedAt: computed.calculatedAt,
      materialSnapshots: computed.materialSnapshots.map((s) => ({
        materialId: s.materialId,
        materialCode: s.materialCode,
        materialName: s.materialName,
        materialCategory: s.materialCategory,
        usageQuantity: Number(s.usageQuantity),
        usageUnit: s.usageUnit,
        baseQuantity: Number(s.baseQuantity),
        baseUnit: s.baseUnit,
        unitPrice: Number(s.unitPrice),
        subtotalCost: Number(s.subtotalCost),
        notes: s.notes,
      })),
      additionalCosts: computed.additionalCosts.map((c) => ({
        category: c.category,
        name: c.name,
        amount: Number(c.amount),
        notes: c.notes,
      })),
    };
  }

  private parseDateRange(
    dateFrom?: string,
    dateTo?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) {
      return undefined;
    }

    const filter: Prisma.DateTimeFilter = {};
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom) {
      fromDate = DATE_ONLY_REGEX.test(dateFrom)
        ? new Date(`${dateFrom}T00:00:00.000Z`)
        : new Date(dateFrom);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException(`Invalid dateFrom value '${dateFrom}'`);
      }
      filter.gte = fromDate;
    }

    if (dateTo) {
      toDate = DATE_ONLY_REGEX.test(dateTo)
        ? new Date(`${dateTo}T23:59:59.999Z`)
        : new Date(dateTo);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException(`Invalid dateTo value '${dateTo}'`);
      }
      filter.lte = toDate;
    }

    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException(
        'dateFrom must be earlier than or equal to dateTo',
      );
    }

    return filter;
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

      if (prismaCode === 'P2025') {
        return new NotFoundException(
          'Requested HPP calculation record was not found',
        );
      }

      if (prismaCode === 'P2003' || prismaCode === 'P2014') {
        return new BadRequestException(
          'Operation violates related data integrity constraint',
        );
      }
    }

    this.logger.error(
      'Unexpected database error in HppService',
      error instanceof Error ? error.stack : String(error),
    );
    return new InternalServerErrorException(
      'An unexpected database error occurred while processing HPP calculation',
    );
  }
}
