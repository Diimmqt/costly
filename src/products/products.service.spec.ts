import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client.js';
import {
  ProductCategory,
  ProductStatus,
} from '../../generated/prisma/enums.js';
import type { ProductModel } from '../../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from './products.service.js';

const BASE_DATE = new Date('2026-11-17T10:00:00.000Z');

function createMockProduct(
  overrides: Partial<ProductModel> = {},
): ProductModel {
  return {
    id: '770e8400-e29b-41d4-a716-446655440000',
    code: 'PRD-001',
    name: 'Es Kopi Susu Gula Aren',
    category: ProductCategory.BEVERAGE,
    description: 'Es kopi susu arabika dengan gula aren organik 250ml',
    sellingPrice: new Prisma.Decimal(22000),
    status: ProductStatus.ACTIVE,
    isActive: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

describe('ProductsService', () => {
  let service: ProductsService;
  let mockPrisma: {
    product: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      product: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create (CRUD - Create Product & Validation)', () => {
    it('should create an active product with Decimal sellingPrice', async () => {
      const created = createMockProduct();
      mockPrisma.product.create.mockResolvedValue(created);

      const result = await service.create({
        code: 'PRD-001',
        name: 'Es Kopi Susu Gula Aren',
        category: ProductCategory.BEVERAGE,
        description: 'Es kopi susu arabika dengan gula aren organik 250ml',
        sellingPrice: 22000,
      });

      expect(mockPrisma.product.create).toHaveBeenCalledOnce();
      expect(result).toEqual({
        id: created.id,
        code: 'PRD-001',
        name: 'Es Kopi Susu Gula Aren',
        category: ProductCategory.BEVERAGE,
        description: 'Es kopi susu arabika dengan gula aren organik 250ml',
        sellingPrice: 22000,
        status: ProductStatus.ACTIVE,
        isActive: true,
        createdAt: BASE_DATE,
        updatedAt: BASE_DATE,
      });
    });

    it('should create a product without sellingPrice (null) and inactive status', async () => {
      const created = createMockProduct({
        code: 'PRD-002',
        name: 'Croissant Butter',
        category: ProductCategory.SNACK,
        sellingPrice: null,
        status: ProductStatus.INACTIVE,
        isActive: false,
      });
      mockPrisma.product.create.mockResolvedValue(created);

      const result = await service.create({
        code: 'PRD-002',
        name: 'Croissant Butter',
        category: ProductCategory.SNACK,
        status: ProductStatus.INACTIVE,
      });

      expect(result.sellingPrice).toBeNull();
      expect(result.status).toBe(ProductStatus.INACTIVE);
      expect(result.isActive).toBe(false);
    });

    it('should throw ConflictException (409) when product code already exists', async () => {
      mockPrisma.product.create.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`code`)',
      });

      await expect(
        service.create({
          code: 'PRD-001',
          name: 'Produk Duplikat',
          category: ProductCategory.BEVERAGE,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException (400) on negative sellingPrice, empty code/name, or conflicting status', async () => {
      await expect(
        service.create({
          code: 'PRD-NEG',
          name: 'Negative Price Product',
          category: ProductCategory.FOOD,
          sellingPrice: -5000,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          code: '   ',
          name: 'Empty Code',
          category: ProductCategory.FOOD,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          code: 'PRD-CONFLICT',
          name: 'Conflicting Status',
          category: ProductCategory.FOOD,
          status: ProductStatus.ACTIVE,
          isActive: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll (Search, Filter, Pagination, and Sorting)', () => {
    it('should return paginated products with default query parameters', async () => {
      const product = createMockProduct();
      mockPrisma.product.findMany.mockResolvedValue([product]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should apply search (name/code), category, status, isActive, pagination, and sorting', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(15);

      const result = await service.findAll({
        search: 'Kopi',
        category: ProductCategory.BEVERAGE,
        status: ProductStatus.ACTIVE,
        isActive: true,
        page: 2,
        limit: 5,
        sortBy: 'sellingPrice',
        sortOrder: 'asc',
      });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'Kopi', mode: 'insensitive' } },
            { code: { contains: 'Kopi', mode: 'insensitive' } },
          ],
          category: ProductCategory.BEVERAGE,
          status: ProductStatus.ACTIVE,
          isActive: true,
        },
        skip: 5,
        take: 5,
        orderBy: { sellingPrice: 'asc' },
      });
      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 15,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });

  describe('findOne & update (Detail & Update Product)', () => {
    it('should return product detail when found and throw NotFoundException (404) when not found', async () => {
      const product = createMockProduct();
      mockPrisma.product.findUnique.mockResolvedValueOnce(product);

      const found = await service.findOne(product.id);
      expect(found.id).toBe(product.id);
      expect(found.code).toBe('PRD-001');

      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne(product.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update product details and synchronize status', async () => {
      const existing = createMockProduct();
      const updated = createMockProduct({
        name: 'Es Kopi Susu Gula Aren Large',
        sellingPrice: new Prisma.Decimal(26000),
      });

      mockPrisma.product.findUnique.mockResolvedValue(existing);
      mockPrisma.product.update.mockResolvedValue(updated);

      const result = await service.update(existing.id, {
        name: 'Es Kopi Susu Gula Aren Large',
        sellingPrice: 26000,
      });

      expect(result.name).toBe('Es Kopi Susu Gula Aren Large');
      expect(result.sellingPrice).toBe(26000);
    });
  });

  describe('updateStatus (Activate & Deactivate Product)', () => {
    it('should deactivate an active product via status=INACTIVE', async () => {
      const existing = createMockProduct({
        status: ProductStatus.ACTIVE,
        isActive: true,
      });
      const deactivated = createMockProduct({
        status: ProductStatus.INACTIVE,
        isActive: false,
      });

      mockPrisma.product.findUnique.mockResolvedValue(existing);
      mockPrisma.product.update.mockResolvedValue(deactivated);

      const result = await service.updateStatus(existing.id, {
        status: ProductStatus.INACTIVE,
      });

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { status: ProductStatus.INACTIVE, isActive: false },
      });
      expect(result.status).toBe(ProductStatus.INACTIVE);
      expect(result.isActive).toBe(false);
    });

    it('should activate an inactive product via isActive=true', async () => {
      const existing = createMockProduct({
        status: ProductStatus.INACTIVE,
        isActive: false,
      });
      const activated = createMockProduct({
        status: ProductStatus.ACTIVE,
        isActive: true,
      });

      mockPrisma.product.findUnique.mockResolvedValue(existing);
      mockPrisma.product.update.mockResolvedValue(activated);

      const result = await service.updateStatus(existing.id, {
        isActive: true,
      });

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { status: ProductStatus.ACTIVE, isActive: true },
      });
      expect(result.status).toBe(ProductStatus.ACTIVE);
      expect(result.isActive).toBe(true);
    });

    it('should throw BadRequestException if neither status nor isActive is provided', async () => {
      const existing = createMockProduct();
      await expect(service.updateStatus(existing.id, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove & Relational Data Protection (Delete Product)', () => {
    it('should delete product when it has no related HPP calculations or transactions', async () => {
      const existing = createMockProduct();
      mockPrisma.product.findUnique.mockResolvedValue(existing);
      mockPrisma.product.delete.mockResolvedValue(existing);

      const result = await service.remove(existing.id);
      expect(result.id).toBe(existing.id);
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({
        where: { id: existing.id },
      });
    });

    it('should block deletion with ConflictException (409) when product carries related HPP/transaction counts', async () => {
      const productWithRelations = {
        ...createMockProduct(),
        _count: { hppCalculations: 2, transactions: 0 },
      };
      mockPrisma.product.findUnique.mockResolvedValue(productWithRelations);

      await expect(service.remove(productWithRelations.id)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });

    it('should block deletion with ConflictException (409) when database throws P2003 foreign key constraint', async () => {
      const existing = createMockProduct();
      mockPrisma.product.findUnique.mockResolvedValue(existing);
      mockPrisma.product.delete.mockRejectedValue({
        code: 'P2003',
        message: 'Foreign key constraint failed on the field',
      });

      await expect(service.remove(existing.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should translate unexpected database errors to InternalServerErrorException (500)', async () => {
      mockPrisma.product.findMany.mockRejectedValueOnce(
        new Error('Database timeout'),
      );

      await expect(service.findAll({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
