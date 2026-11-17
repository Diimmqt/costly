import { Test, TestingModule } from '@nestjs/testing';
import {
  ProductCategory,
  ProductStatus,
} from '../../generated/prisma/enums.js';
import type {
  PaginationMeta,
  ProductEntity,
} from './entities/product.entity.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

const MOCK_PRODUCT: ProductEntity = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  code: 'PRD-001',
  name: 'Es Kopi Susu Gula Aren',
  category: ProductCategory.BEVERAGE,
  description: 'Es kopi susu arabika dengan gula aren organik 250ml',
  sellingPrice: 22000,
  status: ProductStatus.ACTIVE,
  isActive: true,
  createdAt: new Date('2026-11-17T10:00:00.000Z'),
  updatedAt: new Date('2026-11-17T10:00:00.000Z'),
};

const MOCK_META: PaginationMeta = {
  page: 1,
  limit: 10,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockService: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      findAll: vi.fn().mockResolvedValue({
        data: [MOCK_PRODUCT],
        meta: MOCK_META,
      }),
      findOne: vi.fn().mockResolvedValue(MOCK_PRODUCT),
      create: vi.fn().mockResolvedValue(MOCK_PRODUCT),
      update: vi.fn().mockResolvedValue(MOCK_PRODUCT),
      updateStatus: vi.fn().mockResolvedValue({
        ...MOCK_PRODUCT,
        status: ProductStatus.INACTIVE,
        isActive: false,
      }),
      remove: vi.fn().mockResolvedValue(MOCK_PRODUCT),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('GET /products should return formatted list response with pagination meta', async () => {
    const res = await controller.findAll({ page: 1, limit: 10 });
    expect(res).toEqual({
      success: true,
      message: 'Products retrieved successfully',
      data: [MOCK_PRODUCT],
      meta: MOCK_META,
    });
  });

  it('GET /products/:id should return formatted detail response', async () => {
    const res = await controller.findOne(MOCK_PRODUCT.id);
    expect(res).toEqual({
      success: true,
      message: 'Product retrieved successfully',
      data: MOCK_PRODUCT,
    });
  });

  it('POST /products should return formatted created response', async () => {
    const res = await controller.create({
      code: 'PRD-001',
      name: 'Es Kopi Susu Gula Aren',
      category: ProductCategory.BEVERAGE,
      sellingPrice: 22000,
    });
    expect(res).toEqual({
      success: true,
      message: 'Product created successfully',
      data: MOCK_PRODUCT,
    });
  });

  it('PATCH /products/:id should return formatted updated response', async () => {
    const res = await controller.update(MOCK_PRODUCT.id, {
      name: 'Es Kopi Susu Gula Aren',
    });
    expect(res).toEqual({
      success: true,
      message: 'Product updated successfully',
      data: MOCK_PRODUCT,
    });
  });

  it('PATCH /products/:id/status should return formatted status update response', async () => {
    const res = await controller.updateStatus(MOCK_PRODUCT.id, {
      status: ProductStatus.INACTIVE,
    });
    expect(res.success).toBe(true);
    expect(res.data.status).toBe(ProductStatus.INACTIVE);
    expect(res.data.isActive).toBe(false);
  });

  it('DELETE /products/:id should return formatted deleted response', async () => {
    const res = await controller.remove(MOCK_PRODUCT.id);
    expect(res).toEqual({
      success: true,
      message: 'Product deleted successfully',
      data: MOCK_PRODUCT,
    });
  });
});
