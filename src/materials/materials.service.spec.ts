import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client.js';
import {
  MaterialCategory,
  MaterialUnit,
  StockMovementType,
  StockStatus,
} from '../../generated/prisma/enums.js';
import type {
  MaterialModel,
  StockMovementModel,
} from '../../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MaterialsService } from './materials.service.js';

const BASE_DATE = new Date('2026-11-17T08:00:00.000Z');

function createMockMaterial(
  overrides: Partial<MaterialModel> = {},
): MaterialModel {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    code: 'BB-001',
    name: 'Biji Kopi Arabika',
    category: MaterialCategory.MAIN,
    unit: MaterialUnit.KILOGRAM,
    purchasePrice: new Prisma.Decimal(120000),
    stock: new Prisma.Decimal(25),
    minStock: new Prisma.Decimal(5),
    stockStatus: StockStatus.AVAILABLE,
    isLowStock: false,
    description: 'Biji kopi arabika Gayo grade A',
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

function createMockMovement(
  overrides: Partial<StockMovementModel> = {},
): StockMovementModel {
  return {
    id: '660e8400-e29b-41d4-a716-446655440001',
    materialId: '550e8400-e29b-41d4-a716-446655440000',
    type: StockMovementType.IN,
    quantity: new Prisma.Decimal(10),
    previousStock: new Prisma.Decimal(15),
    newStock: new Prisma.Decimal(25),
    unitPrice: new Prisma.Decimal(120000),
    reference: 'PO-2026-001',
    notes: 'Restock mingguan',
    createdAt: BASE_DATE,
    ...overrides,
  };
}

describe('MaterialsService', () => {
  let service: MaterialsService;
  let mockPrisma: {
    material: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    stockMovement: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockPrisma = {
      material: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(
        async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
          callback(mockPrisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  describe('computeStockState (Low Stock Indicator & Stock Status)', () => {
    it('should return AVAILABLE and isLowStock=false when stock > minStock', () => {
      const state = service.computeStockState(
        new Prisma.Decimal(10),
        new Prisma.Decimal(5),
      );
      expect(state).toEqual({
        stockStatus: StockStatus.AVAILABLE,
        isLowStock: false,
      });
    });

    it('should return LOW_STOCK and isLowStock=true when stock equals minStock (> 0)', () => {
      const state = service.computeStockState(
        new Prisma.Decimal(5),
        new Prisma.Decimal(5),
      );
      expect(state).toEqual({
        stockStatus: StockStatus.LOW_STOCK,
        isLowStock: true,
      });
    });

    it('should return LOW_STOCK and isLowStock=true when 0 < stock < minStock', () => {
      const state = service.computeStockState(
        new Prisma.Decimal(2.5),
        new Prisma.Decimal(5),
      );
      expect(state).toEqual({
        stockStatus: StockStatus.LOW_STOCK,
        isLowStock: true,
      });
    });

    it('should return OUT_OF_STOCK and isLowStock=true when stock is 0', () => {
      const state = service.computeStockState(
        new Prisma.Decimal(0),
        new Prisma.Decimal(5),
      );
      expect(state).toEqual({
        stockStatus: StockStatus.OUT_OF_STOCK,
        isLowStock: true,
      });
    });
  });

  describe('create (CRUD - Create Material)', () => {
    it('should create a material with initial stock and record an INITIAL stock movement', async () => {
      const createdMaterial = createMockMaterial();
      mockPrisma.material.create.mockResolvedValue(createdMaterial);
      mockPrisma.stockMovement.create.mockResolvedValue(
        createMockMovement({ type: StockMovementType.INITIAL }),
      );

      const result = await service.create({
        code: 'BB-001',
        name: 'Biji Kopi Arabika',
        category: MaterialCategory.MAIN,
        unit: MaterialUnit.KILOGRAM,
        purchasePrice: 120000,
        stock: 25,
        minStock: 5,
        description: 'Biji kopi arabika Gayo grade A',
      });

      expect(mockPrisma.material.create).toHaveBeenCalledOnce();
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledOnce();
      expect(result).toEqual({
        id: createdMaterial.id,
        code: 'BB-001',
        name: 'Biji Kopi Arabika',
        category: MaterialCategory.MAIN,
        unit: MaterialUnit.KILOGRAM,
        purchasePrice: 120000,
        stock: 25,
        minStock: 5,
        stockStatus: StockStatus.AVAILABLE,
        isLowStock: false,
        description: 'Biji kopi arabika Gayo grade A',
        createdAt: BASE_DATE,
        updatedAt: BASE_DATE,
      });
    });

    it('should create a material with 0 initial stock without creating a stock movement', async () => {
      const zeroStockMaterial = createMockMaterial({
        stock: new Prisma.Decimal(0),
        minStock: new Prisma.Decimal(5),
        stockStatus: StockStatus.OUT_OF_STOCK,
        isLowStock: true,
      });
      mockPrisma.material.create.mockResolvedValue(zeroStockMaterial);

      const result = await service.create({
        code: 'BB-002',
        name: 'Cup Plastik 16oz',
        category: MaterialCategory.PACKAGING,
        unit: MaterialUnit.PCS,
        purchasePrice: 850,
        stock: 0,
        minStock: 50,
      });

      expect(mockPrisma.material.create).toHaveBeenCalledOnce();
      expect(mockPrisma.stockMovement.create).not.toHaveBeenCalled();
      expect(result.stockStatus).toBe(StockStatus.OUT_OF_STOCK);
      expect(result.isLowStock).toBe(true);
    });

    it('should throw ConflictException (409) when material code is duplicated', async () => {
      mockPrisma.material.create.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`code`)',
      });

      await expect(
        service.create({
          code: 'BB-001',
          name: 'Biji Kopi Duplikat',
          category: MaterialCategory.MAIN,
          unit: MaterialUnit.KILOGRAM,
          purchasePrice: 100000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when purchasePrice, stock, or minStock is negative', async () => {
      await expect(
        service.create({
          code: 'BB-NEG',
          name: 'Invalid Price',
          category: MaterialCategory.MAIN,
          unit: MaterialUnit.GRAM,
          purchasePrice: -100,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          code: 'BB-NEG',
          name: 'Invalid Stock',
          category: MaterialCategory.MAIN,
          unit: MaterialUnit.GRAM,
          purchasePrice: 100,
          stock: -5,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          code: 'BB-NEG',
          name: 'Invalid MinStock',
          category: MaterialCategory.MAIN,
          unit: MaterialUnit.GRAM,
          purchasePrice: 100,
          minStock: -1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll (Search, Filter, Pagination, and Sorting)', () => {
    it('should return paginated materials with default parameters', async () => {
      const material = createMockMaterial();
      mockPrisma.material.findMany.mockResolvedValue([material]);
      mockPrisma.material.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(mockPrisma.material.findMany).toHaveBeenCalledWith({
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

    it('should apply search (by name or code), category, stockStatus, lowStock filters, pagination, and sorting', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      mockPrisma.material.count.mockResolvedValue(25);

      const result = await service.findAll({
        search: 'Kopi',
        category: MaterialCategory.MAIN,
        unit: MaterialUnit.KILOGRAM,
        stockStatus: StockStatus.LOW_STOCK,
        lowStock: true,
        page: 2,
        limit: 10,
        sortBy: 'purchasePrice',
        sortOrder: 'asc',
      });

      expect(mockPrisma.material.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'Kopi', mode: 'insensitive' } },
            { code: { contains: 'Kopi', mode: 'insensitive' } },
          ],
          category: MaterialCategory.MAIN,
          unit: MaterialUnit.KILOGRAM,
          stockStatus: StockStatus.LOW_STOCK,
          isLowStock: true,
        },
        skip: 10,
        take: 10,
        orderBy: { purchasePrice: 'asc' },
      });
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });

  describe('findOne & update & remove (CRUD - Detail, Update, Delete)', () => {
    it('should return material detail when found', async () => {
      const material = createMockMaterial();
      mockPrisma.material.findUnique.mockResolvedValue(material);

      const result = await service.findOne(material.id);
      expect(result.id).toBe(material.id);
      expect(result.code).toBe('BB-001');
    });

    it('should throw NotFoundException (404) when material does not exist', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update material, recalculate low stock status, and record ADJUSTMENT movement if stock changed', async () => {
      const existing = createMockMaterial({
        stock: new Prisma.Decimal(25),
        minStock: new Prisma.Decimal(5),
      });
      const updated = createMockMaterial({
        name: 'Biji Kopi Arabika Premium',
        stock: new Prisma.Decimal(4),
        minStock: new Prisma.Decimal(5),
        stockStatus: StockStatus.LOW_STOCK,
        isLowStock: true,
      });

      mockPrisma.material.findUnique.mockResolvedValue(existing);
      mockPrisma.material.update.mockResolvedValue(updated);
      mockPrisma.stockMovement.create.mockResolvedValue(
        createMockMovement({ type: StockMovementType.ADJUSTMENT }),
      );

      const result = await service.update(existing.id, {
        name: 'Biji Kopi Arabika Premium',
        stock: 4,
      });

      expect(result.name).toBe('Biji Kopi Arabika Premium');
      expect(result.stock).toBe(4);
      expect(result.stockStatus).toBe(StockStatus.LOW_STOCK);
      expect(result.isLowStock).toBe(true);
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledOnce();
    });

    it('should delete material when found and throw NotFoundException when missing', async () => {
      const existing = createMockMaterial();
      mockPrisma.material.findUnique.mockResolvedValueOnce(existing);
      mockPrisma.material.delete.mockResolvedValueOnce(existing);

      const deleted = await service.remove(existing.id);
      expect(deleted.id).toBe(existing.id);

      mockPrisma.material.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove(existing.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('stockIn & stockOut & getStockHistory (Stock Management)', () => {
    it('should add stock, update purchasePrice if unitPrice is provided, and create an IN movement', async () => {
      const existing = createMockMaterial({
        stock: new Prisma.Decimal(3),
        minStock: new Prisma.Decimal(5),
        stockStatus: StockStatus.LOW_STOCK,
        isLowStock: true,
      });
      const updated = createMockMaterial({
        stock: new Prisma.Decimal(13),
        minStock: new Prisma.Decimal(5),
        purchasePrice: new Prisma.Decimal(125000),
        stockStatus: StockStatus.AVAILABLE,
        isLowStock: false,
      });
      const movement = createMockMovement({
        type: StockMovementType.IN,
        quantity: new Prisma.Decimal(10),
        previousStock: new Prisma.Decimal(3),
        newStock: new Prisma.Decimal(13),
        unitPrice: new Prisma.Decimal(125000),
      });

      mockPrisma.material.findUnique.mockResolvedValue(existing);
      mockPrisma.material.update.mockResolvedValue(updated);
      mockPrisma.stockMovement.create.mockResolvedValue(movement);

      const result = await service.stockIn(existing.id, {
        quantity: 10,
        unitPrice: 125000,
        reference: 'PO-2026-002',
        notes: 'Restock kopi',
      });

      expect(result.material.stock).toBe(13);
      expect(result.material.purchasePrice).toBe(125000);
      expect(result.material.stockStatus).toBe(StockStatus.AVAILABLE);
      expect(result.material.isLowStock).toBe(false);
      expect(result.movement.type).toBe(StockMovementType.IN);
      expect(result.movement.quantity).toBe(10);
      expect(result.movement.previousStock).toBe(3);
      expect(result.movement.newStock).toBe(13);
    });

    it('should deduct stock, trigger low stock indicator when reaching minStock, and create an OUT movement', async () => {
      const existing = createMockMaterial({
        stock: new Prisma.Decimal(10),
        minStock: new Prisma.Decimal(5),
        stockStatus: StockStatus.AVAILABLE,
        isLowStock: false,
      });
      const updated = createMockMaterial({
        stock: new Prisma.Decimal(5),
        minStock: new Prisma.Decimal(5),
        stockStatus: StockStatus.LOW_STOCK,
        isLowStock: true,
      });
      const movement = createMockMovement({
        type: StockMovementType.OUT,
        quantity: new Prisma.Decimal(5),
        previousStock: new Prisma.Decimal(10),
        newStock: new Prisma.Decimal(5),
      });

      mockPrisma.material.findUnique.mockResolvedValue(existing);
      mockPrisma.material.update.mockResolvedValue(updated);
      mockPrisma.stockMovement.create.mockResolvedValue(movement);

      const result = await service.stockOut(existing.id, {
        quantity: 5,
        reference: 'PROD-001',
        notes: 'Pemakaian produksi batch 1',
      });

      expect(result.material.stock).toBe(5);
      expect(result.material.stockStatus).toBe(StockStatus.LOW_STOCK);
      expect(result.material.isLowStock).toBe(true);
      expect(result.movement.type).toBe(StockMovementType.OUT);
    });

    it('should reject stockOut when requested quantity exceeds available stock (preventing negative stock)', async () => {
      const existing = createMockMaterial({
        stock: new Prisma.Decimal(4),
      });
      mockPrisma.material.findUnique.mockResolvedValue(existing);

      await expect(
        service.stockOut(existing.id, {
          quantity: 5,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.material.update).not.toHaveBeenCalled();
      expect(mockPrisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('should retrieve paginated stock history for a material', async () => {
      const existing = createMockMaterial();
      const movement = createMockMovement();

      mockPrisma.material.findUnique.mockResolvedValue(existing);
      mockPrisma.stockMovement.findMany.mockResolvedValue([movement]);
      mockPrisma.stockMovement.count.mockResolvedValue(1);

      const result = await service.getStockHistory(existing.id, {
        type: StockMovementType.IN,
        page: 1,
        limit: 10,
      });

      expect(result.material.id).toBe(existing.id);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].type).toBe(StockMovementType.IN);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('Database Error Handling', () => {
    it('should translate Prisma P2025 to NotFoundException and P2003 to BadRequestException', async () => {
      mockPrisma.material.findUnique.mockRejectedValueOnce({ code: 'P2025' });
      await expect(
        service.findOne('550e8400-e29b-41d4-a716-446655440000'),
      ).rejects.toThrow(NotFoundException);

      mockPrisma.material.findUnique.mockRejectedValueOnce({ code: 'P2003' });
      await expect(
        service.findOne('550e8400-e29b-41d4-a716-446655440000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should translate unexpected database errors to InternalServerErrorException (500)', async () => {
      mockPrisma.material.findMany.mockRejectedValueOnce(
        new Error('Connection terminated unexpectedly'),
      );

      await expect(service.findAll({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
