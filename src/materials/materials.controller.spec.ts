import { Test, TestingModule } from '@nestjs/testing';
import {
  MaterialCategory,
  MaterialUnit,
  StockMovementType,
  StockStatus,
} from '../../generated/prisma/enums.js';
import type {
  MaterialEntity,
  PaginationMeta,
  StockMovementEntity,
} from './entities/material.entity.js';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';

const MOCK_MATERIAL: MaterialEntity = {
  id: '550e8400-e29b-41d4-a716-446655440000',
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
  createdAt: new Date('2026-11-17T08:00:00.000Z'),
  updatedAt: new Date('2026-11-17T08:00:00.000Z'),
};

const MOCK_MOVEMENT: StockMovementEntity = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  materialId: MOCK_MATERIAL.id,
  type: StockMovementType.IN,
  quantity: 10,
  previousStock: 15,
  newStock: 25,
  unitPrice: 120000,
  reference: 'PO-2026-001',
  notes: 'Restock mingguan',
  createdAt: new Date('2026-11-17T08:00:00.000Z'),
};

const MOCK_META: PaginationMeta = {
  page: 1,
  limit: 10,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

describe('MaterialsController', () => {
  let controller: MaterialsController;
  let mockService: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    stockIn: ReturnType<typeof vi.fn>;
    stockOut: ReturnType<typeof vi.fn>;
    getStockHistory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      findAll: vi.fn().mockResolvedValue({
        data: [MOCK_MATERIAL],
        meta: MOCK_META,
      }),
      findOne: vi.fn().mockResolvedValue(MOCK_MATERIAL),
      create: vi.fn().mockResolvedValue(MOCK_MATERIAL),
      update: vi.fn().mockResolvedValue(MOCK_MATERIAL),
      remove: vi.fn().mockResolvedValue(MOCK_MATERIAL),
      stockIn: vi.fn().mockResolvedValue({
        material: MOCK_MATERIAL,
        movement: MOCK_MOVEMENT,
      }),
      stockOut: vi.fn().mockResolvedValue({
        material: { ...MOCK_MATERIAL, stock: 20 },
        movement: {
          ...MOCK_MOVEMENT,
          type: StockMovementType.OUT,
          quantity: 5,
          previousStock: 25,
          newStock: 20,
        },
      }),
      getStockHistory: vi.fn().mockResolvedValue({
        material: MOCK_MATERIAL,
        movements: [MOCK_MOVEMENT],
        meta: MOCK_META,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaterialsController],
      providers: [
        {
          provide: MaterialsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<MaterialsController>(MaterialsController);
  });

  it('GET /materials should return formatted list response with pagination meta', async () => {
    const res = await controller.findAll({ page: 1, limit: 10 });
    expect(res).toEqual({
      success: true,
      message: 'Materials retrieved successfully',
      data: [MOCK_MATERIAL],
      meta: MOCK_META,
    });
  });

  it('GET /materials/:id should return formatted detail response', async () => {
    const res = await controller.findOne(MOCK_MATERIAL.id);
    expect(res).toEqual({
      success: true,
      message: 'Material retrieved successfully',
      data: MOCK_MATERIAL,
    });
  });

  it('POST /materials should return formatted created response', async () => {
    const res = await controller.create({
      code: 'BB-001',
      name: 'Biji Kopi Arabika',
      category: MaterialCategory.MAIN,
      unit: MaterialUnit.KILOGRAM,
      purchasePrice: 120000,
      stock: 25,
      minStock: 5,
    });
    expect(res).toEqual({
      success: true,
      message: 'Material created successfully',
      data: MOCK_MATERIAL,
    });
  });

  it('PATCH /materials/:id should return formatted updated response', async () => {
    const res = await controller.update(MOCK_MATERIAL.id, {
      name: 'Biji Kopi Arabika',
    });
    expect(res).toEqual({
      success: true,
      message: 'Material updated successfully',
      data: MOCK_MATERIAL,
    });
  });

  it('DELETE /materials/:id should return formatted deleted response', async () => {
    const res = await controller.remove(MOCK_MATERIAL.id);
    expect(res).toEqual({
      success: true,
      message: 'Material deleted successfully',
      data: MOCK_MATERIAL,
    });
  });

  it('POST /materials/:id/stock-in should return formatted stock-in response', async () => {
    const res = await controller.stockIn(MOCK_MATERIAL.id, { quantity: 10 });
    expect(res.success).toBe(true);
    expect(res.data.material.id).toBe(MOCK_MATERIAL.id);
    expect(res.data.movement.type).toBe(StockMovementType.IN);
  });

  it('POST /materials/:id/stock-out should return formatted stock-out response', async () => {
    const res = await controller.stockOut(MOCK_MATERIAL.id, { quantity: 5 });
    expect(res.success).toBe(true);
    expect(res.data.material.stock).toBe(20);
    expect(res.data.movement.type).toBe(StockMovementType.OUT);
  });

  it('GET /materials/:id/stock-history should return formatted history response with meta', async () => {
    const res = await controller.getStockHistory(MOCK_MATERIAL.id, {
      page: 1,
      limit: 10,
    });
    expect(res).toEqual({
      success: true,
      message: 'Stock history retrieved successfully',
      data: {
        material: MOCK_MATERIAL,
        movements: [MOCK_MOVEMENT],
      },
      meta: MOCK_META,
    });
  });
});
