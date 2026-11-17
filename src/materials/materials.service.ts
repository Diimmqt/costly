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
import {
  StockMovementType,
  StockStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { QueryMaterialsDto } from './dto/query-materials.dto.js';
import { QueryStockHistoryDto } from './dto/query-stock-history.dto.js';
import { StockInDto } from './dto/stock-in.dto.js';
import { StockOutDto } from './dto/stock-out.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import {
  type MaterialEntity,
  type PaginationMeta,
  type StockMovementEntity,
  mapMaterialEntity,
  mapStockMovementEntity,
} from './entities/material.entity.js';

export interface StockOperationResult {
  material: MaterialEntity;
  movement: StockMovementEntity;
}

export interface StockHistoryResult {
  material: MaterialEntity;
  movements: StockMovementEntity[];
  meta: PaginationMeta;
}

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes stockStatus and isLowStock indicator based on current stock and minStock.
   * A material is considered low stock when stock <= minStock.
   */
  computeStockState(
    stock: Prisma.Decimal,
    minStock: Prisma.Decimal,
  ): { stockStatus: StockStatus; isLowStock: boolean } {
    const isLowStock = stock.lessThanOrEqualTo(minStock);
    let stockStatus: StockStatus;

    if (stock.lessThanOrEqualTo(0)) {
      stockStatus = StockStatus.OUT_OF_STOCK;
    } else if (isLowStock) {
      stockStatus = StockStatus.LOW_STOCK;
    } else {
      stockStatus = StockStatus.AVAILABLE;
    }

    return { stockStatus, isLowStock };
  }

  async create(dto: CreateMaterialDto): Promise<MaterialEntity> {
    if (dto.purchasePrice < 0) {
      throw new BadRequestException('Purchase price must not be negative');
    }
    if ((dto.stock ?? 0) < 0) {
      throw new BadRequestException('Stock must not be negative');
    }
    if ((dto.minStock ?? 0) < 0) {
      throw new BadRequestException('Minimum stock must not be negative');
    }

    const purchasePriceDec = new Prisma.Decimal(dto.purchasePrice);
    const stockDec = new Prisma.Decimal(dto.stock ?? 0);
    const minStockDec = new Prisma.Decimal(dto.minStock ?? 0);
    const { stockStatus, isLowStock } = this.computeStockState(
      stockDec,
      minStockDec,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const material = await tx.material.create({
          data: {
            code: dto.code.trim(),
            name: dto.name.trim(),
            category: dto.category,
            unit: dto.unit,
            purchasePrice: purchasePriceDec,
            stock: stockDec,
            minStock: minStockDec,
            stockStatus,
            isLowStock,
            description: dto.description?.trim() ?? null,
          },
        });

        if (stockDec.greaterThan(0)) {
          await tx.stockMovement.create({
            data: {
              materialId: material.id,
              type: StockMovementType.INITIAL,
              quantity: stockDec,
              previousStock: new Prisma.Decimal(0),
              newStock: stockDec,
              unitPrice: purchasePriceDec,
              notes: 'Initial stock on material creation',
            },
          });
        }

        return mapMaterialEntity(material);
      });
    } catch (error) {
      throw this.handleDatabaseError(error, dto.code);
    }
  }

  async findAll(
    query: QueryMaterialsDto = {},
  ): Promise<{ data: MaterialEntity[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.MaterialWhereInput = {};

    if (query.search && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.unit) {
      where.unit = query.unit;
    }

    if (query.stockStatus) {
      where.stockStatus = query.stockStatus;
    }

    if (typeof query.lowStock === 'boolean') {
      where.isLowStock = query.lowStock;
    }

    try {
      const [materials, total] = await Promise.all([
        this.prisma.material.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.material.count({ where }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        data: materials.map(mapMaterialEntity),
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

  async findOne(id: string): Promise<MaterialEntity> {
    try {
      const material = await this.prisma.material.findUnique({
        where: { id },
      });

      if (!material) {
        throw new NotFoundException(`Material with ID '${id}' not found`);
      }

      return mapMaterialEntity(material);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<MaterialEntity> {
    if (dto.purchasePrice !== undefined && dto.purchasePrice < 0) {
      throw new BadRequestException('Purchase price must not be negative');
    }
    if (dto.stock !== undefined && dto.stock < 0) {
      throw new BadRequestException('Stock must not be negative');
    }
    if (dto.minStock !== undefined && dto.minStock < 0) {
      throw new BadRequestException('Minimum stock must not be negative');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.material.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new NotFoundException(`Material with ID '${id}' not found`);
        }

        const previousStock = new Prisma.Decimal(existing.stock);
        const newStock =
          dto.stock !== undefined
            ? new Prisma.Decimal(dto.stock)
            : previousStock;
        const newMinStock =
          dto.minStock !== undefined
            ? new Prisma.Decimal(dto.minStock)
            : new Prisma.Decimal(existing.minStock);

        const { stockStatus, isLowStock } = this.computeStockState(
          newStock,
          newMinStock,
        );

        const updateData: Prisma.MaterialUpdateInput = {
          stockStatus,
          isLowStock,
        };

        if (dto.code !== undefined) updateData.code = dto.code.trim();
        if (dto.name !== undefined) updateData.name = dto.name.trim();
        if (dto.category !== undefined) updateData.category = dto.category;
        if (dto.unit !== undefined) updateData.unit = dto.unit;
        if (dto.purchasePrice !== undefined) {
          updateData.purchasePrice = new Prisma.Decimal(dto.purchasePrice);
        }
        if (dto.stock !== undefined) updateData.stock = newStock;
        if (dto.minStock !== undefined) updateData.minStock = newMinStock;
        if (dto.description !== undefined) {
          updateData.description =
            dto.description !== null ? dto.description.trim() : null;
        }

        const updated = await tx.material.update({
          where: { id },
          data: updateData,
        });

        if (dto.stock !== undefined && !newStock.equals(previousStock)) {
          const diff = newStock.minus(previousStock).abs();
          await tx.stockMovement.create({
            data: {
              materialId: id,
              type: StockMovementType.ADJUSTMENT,
              quantity: diff,
              previousStock,
              newStock,
              unitPrice: updated.purchasePrice,
              notes: 'Direct stock adjustment via material update',
            },
          });
        }

        return mapMaterialEntity(updated);
      });
    } catch (error) {
      throw this.handleDatabaseError(error, dto.code);
    }
  }

  async remove(id: string): Promise<MaterialEntity> {
    try {
      const existing = await this.prisma.material.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Material with ID '${id}' not found`);
      }

      const deleted = await this.prisma.material.delete({
        where: { id },
      });

      return mapMaterialEntity(deleted);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async stockIn(id: string, dto: StockInDto): Promise<StockOperationResult> {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Stock-in quantity must be greater than 0');
    }
    if (dto.unitPrice !== undefined && dto.unitPrice < 0) {
      throw new BadRequestException('Unit price must not be negative');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.material.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new NotFoundException(`Material with ID '${id}' not found`);
        }

        const previousStock = new Prisma.Decimal(existing.stock);
        const quantityDec = new Prisma.Decimal(dto.quantity);
        const newStock = previousStock.plus(quantityDec);
        const minStockDec = new Prisma.Decimal(existing.minStock);

        const { stockStatus, isLowStock } = this.computeStockState(
          newStock,
          minStockDec,
        );

        const unitPriceDec =
          dto.unitPrice !== undefined
            ? new Prisma.Decimal(dto.unitPrice)
            : new Prisma.Decimal(existing.purchasePrice);

        const updatedMaterial = await tx.material.update({
          where: { id },
          data: {
            stock: newStock,
            stockStatus,
            isLowStock,
            ...(dto.unitPrice !== undefined
              ? { purchasePrice: unitPriceDec }
              : {}),
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            materialId: id,
            type: StockMovementType.IN,
            quantity: quantityDec,
            previousStock,
            newStock,
            unitPrice: unitPriceDec,
            reference: dto.reference?.trim() ?? null,
            notes: dto.notes?.trim() ?? null,
          },
        });

        return {
          material: mapMaterialEntity(updatedMaterial),
          movement: mapStockMovementEntity(movement),
        };
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async stockOut(id: string, dto: StockOutDto): Promise<StockOperationResult> {
    if (dto.quantity <= 0) {
      throw new BadRequestException(
        'Stock-out quantity must be greater than 0',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.material.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new NotFoundException(`Material with ID '${id}' not found`);
        }

        const previousStock = new Prisma.Decimal(existing.stock);
        const quantityDec = new Prisma.Decimal(dto.quantity);

        if (previousStock.lessThan(quantityDec)) {
          throw new BadRequestException(
            `Insufficient stock for material '${existing.name}'. Available: ${Number(previousStock)}, requested: ${dto.quantity}`,
          );
        }

        const newStock = previousStock.minus(quantityDec);
        const minStockDec = new Prisma.Decimal(existing.minStock);

        const { stockStatus, isLowStock } = this.computeStockState(
          newStock,
          minStockDec,
        );

        const updatedMaterial = await tx.material.update({
          where: { id },
          data: {
            stock: newStock,
            stockStatus,
            isLowStock,
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            materialId: id,
            type: StockMovementType.OUT,
            quantity: quantityDec,
            previousStock,
            newStock,
            unitPrice: existing.purchasePrice,
            reference: dto.reference?.trim() ?? null,
            notes: dto.notes?.trim() ?? null,
          },
        });

        return {
          material: mapMaterialEntity(updatedMaterial),
          movement: mapStockMovementEntity(movement),
        };
      });
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async getStockHistory(
    id: string,
    query: QueryStockHistoryDto = {},
  ): Promise<StockHistoryResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    try {
      const material = await this.prisma.material.findUnique({
        where: { id },
      });

      if (!material) {
        throw new NotFoundException(`Material with ID '${id}' not found`);
      }

      const where: Prisma.StockMovementWhereInput = {
        materialId: id,
        ...(query.type ? { type: query.type } : {}),
      };

      const [movements, total] = await Promise.all([
        this.prisma.stockMovement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.stockMovement.count({ where }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        material: mapMaterialEntity(material),
        movements: movements.map(mapStockMovementEntity),
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

  private handleDatabaseError(error: unknown, codeHint?: string): HttpException {
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
        const message = codeHint
          ? `Material with code '${codeHint}' already exists`
          : 'Material with the given unique code already exists';
        return new ConflictException(message);
      }

      if (prismaCode === 'P2025') {
        return new NotFoundException('Requested material record was not found');
      }

      if (prismaCode === 'P2003') {
        return new BadRequestException(
          'Operation violates related data constraint',
        );
      }
    }

    this.logger.error(
      'Unexpected database error in MaterialsService',
      error instanceof Error ? error.stack : String(error),
    );
    return new InternalServerErrorException(
      'An unexpected database error occurred while processing material data',
    );
  }
}
