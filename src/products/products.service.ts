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
  ProductCategory,
  ProductStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import {
  type PaginationMeta,
  type ProductEntity,
  mapProductEntity,
} from './entities/product.entity.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Keeps ProductStatus enum and boolean isActive synchronized.
   */
  resolveStatusState(
    status?: ProductStatus,
    isActive?: boolean,
    fallbackStatus: ProductStatus = ProductStatus.ACTIVE,
  ): { status: ProductStatus; isActive: boolean } {
    if (
      status !== undefined &&
      !Object.values(ProductStatus).includes(status)
    ) {
      throw new BadRequestException(
        `Status must be one of: ${Object.values(ProductStatus).join(', ')}`,
      );
    }

    if (status !== undefined && isActive !== undefined) {
      const expectedActive = status === ProductStatus.ACTIVE;
      if (expectedActive !== isActive) {
        throw new BadRequestException(
          `Conflicting status '${status}' and isActive '${String(isActive)}'`,
        );
      }
    }

    if (status !== undefined) {
      return {
        status,
        isActive: status === ProductStatus.ACTIVE,
      };
    }

    if (isActive !== undefined) {
      return {
        status: isActive ? ProductStatus.ACTIVE : ProductStatus.INACTIVE,
        isActive,
      };
    }

    return {
      status: fallbackStatus,
      isActive: fallbackStatus === ProductStatus.ACTIVE,
    };
  }

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    if (!dto.code || dto.code.trim().length === 0) {
      throw new BadRequestException('Product code is required');
    }
    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('Product name is required');
    }
    if (!Object.values(ProductCategory).includes(dto.category)) {
      throw new BadRequestException(
        `Category must be one of: ${Object.values(ProductCategory).join(', ')}`,
      );
    }
    if (
      dto.sellingPrice !== undefined &&
      dto.sellingPrice !== null &&
      dto.sellingPrice < 0
    ) {
      throw new BadRequestException('Selling price must not be negative');
    }

    const { status, isActive } = this.resolveStatusState(
      dto.status,
      dto.isActive,
      ProductStatus.ACTIVE,
    );

    const sellingPriceDec =
      dto.sellingPrice !== undefined && dto.sellingPrice !== null
        ? new Prisma.Decimal(dto.sellingPrice)
        : null;

    try {
      const product = await this.prisma.product.create({
        data: {
          code: dto.code.trim(),
          name: dto.name.trim(),
          category: dto.category,
          description: dto.description?.trim() ?? null,
          sellingPrice: sellingPriceDec,
          status,
          isActive,
        },
      });

      return mapProductEntity(product);
    } catch (error) {
      throw this.handleDatabaseError(error, dto.code);
    }
  }

  async findAll(
    query: QueryProductsDto = {},
  ): Promise<{ data: ProductEntity[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.ProductWhereInput = {};

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

    if (query.status) {
      where.status = query.status;
    }

    if (typeof query.isActive === 'boolean') {
      where.isActive = query.isActive;
    }

    try {
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.product.count({ where }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        data: products.map(mapProductEntity),
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

  async findOne(id: string): Promise<ProductEntity> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID '${id}' not found`);
      }

      return mapProductEntity(product);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    if (dto.code !== undefined && dto.code.trim().length === 0) {
      throw new BadRequestException('Product code cannot be empty');
    }
    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BadRequestException('Product name cannot be empty');
    }
    if (
      dto.category !== undefined &&
      !Object.values(ProductCategory).includes(dto.category)
    ) {
      throw new BadRequestException(
        `Category must be one of: ${Object.values(ProductCategory).join(', ')}`,
      );
    }
    if (
      dto.sellingPrice !== undefined &&
      dto.sellingPrice !== null &&
      dto.sellingPrice < 0
    ) {
      throw new BadRequestException('Selling price must not be negative');
    }

    try {
      const existing = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Product with ID '${id}' not found`);
      }

      const updateData: Prisma.ProductUpdateInput = {};

      if (dto.code !== undefined) updateData.code = dto.code.trim();
      if (dto.name !== undefined) updateData.name = dto.name.trim();
      if (dto.category !== undefined) updateData.category = dto.category;
      if (dto.description !== undefined) {
        updateData.description =
          dto.description !== null ? dto.description.trim() : null;
      }
      if (dto.sellingPrice !== undefined) {
        updateData.sellingPrice =
          dto.sellingPrice !== null
            ? new Prisma.Decimal(dto.sellingPrice)
            : null;
      }

      if (dto.status !== undefined || dto.isActive !== undefined) {
        const resolved = this.resolveStatusState(
          dto.status,
          dto.isActive,
          existing.status,
        );
        updateData.status = resolved.status;
        updateData.isActive = resolved.isActive;
      }

      const updated = await this.prisma.product.update({
        where: { id },
        data: updateData,
      });

      return mapProductEntity(updated);
    } catch (error) {
      throw this.handleDatabaseError(error, dto.code);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateProductStatusDto,
  ): Promise<ProductEntity> {
    if (dto.status === undefined && dto.isActive === undefined) {
      throw new BadRequestException(
        'Either status or isActive must be provided to update product status',
      );
    }

    const { status, isActive } = this.resolveStatusState(
      dto.status,
      dto.isActive,
    );

    try {
      const existing = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Product with ID '${id}' not found`);
      }

      const updated = await this.prisma.product.update({
        where: { id },
        data: { status, isActive },
      });

      return mapProductEntity(updated);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  async remove(id: string): Promise<ProductEntity> {
    try {
      const existing = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Product with ID '${id}' not found`);
      }

      if (this.hasRelatedData(existing)) {
        throw new ConflictException(
          `Cannot delete product '${existing.name}' (${existing.code}) because it has related HPP calculation history or transactions. Please deactivate the product instead.`,
        );
      }

      const deleted = await this.prisma.product.delete({
        where: { id },
      });

      return mapProductEntity(deleted);
    } catch (error) {
      throw this.handleDatabaseError(error);
    }
  }

  /**
   * Checks whether a product object carries non-empty relation counts or related records
   * (e.g., HPP calculations, recipes, or transactions).
   */
  private hasRelatedData(product: unknown): boolean {
    if (!product || typeof product !== 'object') {
      return false;
    }

    const record = product as Record<string, unknown>;
    if (record._count && typeof record._count === 'object') {
      const counts = record._count as Record<string, unknown>;
      for (const value of Object.values(counts)) {
        if (typeof value === 'number' && value > 0) {
          return true;
        }
      }
    }

    for (const key of ['hppCalculations', 'recipes', 'transactions']) {
      if (Array.isArray(record[key]) && record[key].length > 0) {
        return true;
      }
    }

    return false;
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
          ? `Product with code '${codeHint}' already exists`
          : 'Product with the given unique code already exists';
        return new ConflictException(message);
      }

      if (prismaCode === 'P2025') {
        return new NotFoundException('Requested product record was not found');
      }

      if (prismaCode === 'P2003' || prismaCode === 'P2014') {
        return new ConflictException(
          'Cannot delete product because it is referenced by existing HPP calculation history or transactions. Please deactivate the product instead.',
        );
      }
    }

    this.logger.error(
      'Unexpected database error in ProductsService',
      error instanceof Error ? error.stack : String(error),
    );
    return new InternalServerErrorException(
      'An unexpected database error occurred while processing product data',
    );
  }
}
